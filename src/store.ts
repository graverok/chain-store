import {
  Action,
  Args,
  AsyncAction,
  ChainFn,
  Store,
  Subscription,
  Unit,
} from "./types";

const initAction = <Input>(
  callers: ((input: Input) => unknown)[],
  config?: { filter?: ChainFn<Input, boolean> },
) => {
  const emitter = createEmitter<Input>();

  const exec = (params: Input) => {
    emitter.emit("watch")(params);
    return;
  };

  const call = async (input: Input) => {
    if (!config?.filter) return exec(input);
    try {
      (await config.filter(input)) && exec(input);
    } catch {
      return;
    }
  };

  callers.push(call);

  const action = (input: Input) => {
    callers.forEach((caller) => caller(input));
    return;
  };

  return Object.assign(action, {
    ...emitter.init("watch"),
    map: <Mapped, Err = Error>(
      fn: ChainFn<Input, Mapped>,
      match?: (params: Input, pending: Input) => boolean,
    ) => {
      if (!config?.filter)
        return initAsyncAction(callers, { target: fn, match }) as AsyncAction<
          Input,
          Mapped,
          Input,
          Err
        >;

      return initAsyncAction(callers, {
        target: fn,
        match,
        map: async (input: Input) => {
          const blocked = !(await (config.filter as ChainFn<Input, boolean>)(
            input,
          ));
          if (blocked) throw new Error();
          return input;
        },
      }) as AsyncAction<Input, Mapped, Input, Err>;
    },
    filter: (fn: ChainFn<Input, boolean>) => {
      if (!config?.filter) return initAction(callers, { filter: fn });

      return initAction(callers, {
        filter: async (input: Input) => {
          const blocked = !(await (config.filter as ChainFn<Input, boolean>)(
            input,
          ));
          return !blocked && fn(input);
        },
      }) as Action<Input>;
    },
  }) as Action<Input>;
};

type Events = {
  done: <R, P>(result: R, params: P) => void;
  fail: <E, P>(error: E, params: P) => void;
  finish: <P>(params: P) => void;
};

const initAsyncAction = <Input, Result, Err = Error, Params = Input>(
  callers: ((input: Input, events?: Events) => unknown)[],
  config: {
    target: ChainFn<Params, Result>;
    match?: (a: Params, b: Params) => boolean;
    map?: ChainFn<Input, Params | [Params, boolean]>;
    filter?: ChainFn<Result, boolean>;
  },
) => {
  const emitter = createEmitter<Params>();
  const matcher = createMatcher(config.target, config.match);

  const exec = async (
    payload: [Params, boolean],
    events?: Events,
    ignore?: boolean,
  ) => {
    !payload[1] && emitter.emit("watch")(payload[0]);
    const [promise, params, matched] = matcher(payload);

    try {
      const result = await promise;
      const blocked =
        config.filter &&
        !(await (config.filter as ChainFn<Result, boolean>)(result));
      if (blocked) return;
      !matched && !ignore && emitter.emit("done")(result, params);
      events?.done(result, params);
    } catch (err) {
      !matched && !ignore && emitter.emit("fail")(err as Err, params);
      events?.fail(err as Err, params);
    } finally {
      !matched && !ignore && emitter.emit("finally")(params);
      events?.finish(params);
    }
  };

  const call = async (input: Input, events?: Events) => {
    if (!config.map) return exec([input as unknown as Params, false], events);

    try {
      const params = await config.map(input);
      exec(Array.isArray(params) ? params : [params, false], events);
    } catch {
      return;
    }
  };

  callers.push(call);

  const action = (input: Input) => {
    const stored: { params?: Params; result?: Result; error?: Err } = {};
    const { events, methods } = asyncActionResolver(stored);

    callers.forEach((caller) => {
      call === caller ? call(input, events as Events) : caller(input);
    });

    return methods;
  };

  return Object.assign(action, {
    ...emitter.init("watch"),
    done: emitter.init("done"),
    fail: emitter.init("fail"),
    finish: emitter.init("finish"),
    filter: (fn: ChainFn<Result, boolean>) => {
      return initAsyncAction(callers, {
        ...config,
        filter: !config.filter
          ? fn
          : async (input: Result) =>
              (await (config.filter as ChainFn<Result, boolean>)(input)) &&
              fn(input),
      }) as AsyncAction<Input, Result, Params, Err>;
    },
    map: <Mapped>(
      fn: ChainFn<Result, Mapped>,
      match?: (params: Result, pending: Result) => boolean,
    ) => {
      const matcher = createMatcher(config.target, config.match);

      return initAsyncAction(callers, {
        target: fn,
        match,
        map: async (input: Input) => {
          const params = config.map
            ? await config.map(input)
            : (input as unknown as Params);

          const [promise, , matched] = await matcher(params);
          const result = await promise;

          const blocked = config.filter && !(await config.filter(result));
          if (blocked) throw new Error();
          return matched ? [result, true] : result;
        },
      }) as AsyncAction<Input, Mapped, Result, Err>;
    },
  }) as AsyncAction<Input, Result, Params, Err>;
};

export const createAction = <Input>() => {
  return initAction<Input>([]);
};

export const createStore = <State>(initialState: State) => {
  const disposers: [Unit<unknown>, Subscription][] = [];
  const mappers: [(state: State) => unknown, (payload: unknown) => void][] = [];
  const emitter = createEmitter<State>();

  let state = initialState;

  const off = <U>(action: Unit<U>) => {
    const index = disposers.findIndex(([_action]) => _action === action);
    if (index > -1) {
      disposers[index]?.[1]?.dispose();
      disposers.splice(index, 1);
    }
  };

  const store = {
    on: <U>(
      action: Unit<U>,
      updater: (state: State, ...args: Args<U>) => State,
    ) => {
      off(action);

      disposers.push([
        action,
        action.watch((...args) => {
          const parts = mappers.map(([mapper]) => mapper(state));
          const nextState = updater(state, ...args);
          if (nextState !== state) {
            state = nextState;
            emitter.emit("watch")(state);
          }
          mappers.forEach(([mapper, watcher], index) => {
            const mapped = mapper(state);
            mapped !== parts[index] && watcher(mapped);
          });
        }),
      ]);

      return store;
    },
    off: <U>(action: Unit<U>) => {
      off(action);
      return store;
    },
    map: <PartState>(mapper: (state: State) => PartState) => ({
      getState: () => mapper(state),
      watch: (watcher: (payload: PartState) => void) => {
        mappers.push([mapper, watcher as (payload: unknown) => void]);
        return {
          dispose: () => {
            const index = mappers.findIndex((data) => data[0] === mapper);
            mappers.splice(index, 1);
          },
        };
      },
    }),
    getState: () => state,
    watch: (watcher: (payload: State) => void) => {
      emitter.init("watch").watch(watcher as (...args: Args<State>) => void);
    },
  };

  return store as Store<State>;
};

const asyncActionResolver = <Params, Result, Error>(stored: {
  params?: Params;
  result?: Result;
  error?: Error;
}) => {
  const methods: {
    done?: (result: Result, params: Params) => void;
    fail?: (error: Error, params: Params) => void;
    finish?: (params: Params) => void;
  } = {};

  const events = {
    done: (result: Result, params: Params) => {
      stored.result = result;
      stored.params = params;
      methods.done?.(result, params);
    },
    fail: (error: Error, params: Params) => {
      stored.error = error;
      stored.params = params;
      methods.fail?.(error, params);
    },
    finish: (params: Params) => {
      stored.params = params;
      methods.finish?.(params);
    },
  };

  return {
    events,
    methods: {
      done: !methods.done
        ? (fn: (result: Result, params: Params) => void) => {
            methods.done = fn;
            if (stored.result && stored.params)
              fn(stored.result, stored.params);
            return asyncActionResolver(stored).methods;
          }
        : void 0,
      fail: !methods.fail
        ? (fn: (error: Error, params: Params) => void) => {
            methods.fail = fn;
            if (stored.error && stored.params) fn(stored.error, stored.params);
            return asyncActionResolver(stored).methods;
          }
        : void 0,
      finish: !methods.finish
        ? (fn: (params: Params) => void) => {
            methods.finish = fn;
            if (stored.params) fn(stored.params);
            return asyncActionResolver(stored).methods;
          }
        : void 0,
    },
  };
};

const createEmitter = <T>() => {
  const subscribers: Record<string, ((...args: Args<T>) => void)[]> = {};

  const unsubscribe = (name: string, watcher: (...args: Args<T>) => void) => {
    if (!subscribers[name]?.includes(watcher)) return;
    subscribers[name] = subscribers[name].filter(
      (_watcher) => _watcher !== watcher,
    );
  };

  const subscribe = (name: string, watcher: (...args: Args<T>) => void) => {
    if (subscribers[name]?.includes(watcher)) return;
    subscribers[name] = [...(subscribers[name] ?? []), watcher];
  };

  return {
    init: (name: string): Unit<T> => ({
      watch: (watcher: (...args: Args<T>) => void) => {
        subscribe(name, watcher);
        return {
          dispose: () => unsubscribe(name, watcher),
        };
      },
    }),
    emit:
      (name: string) =>
      <P>(...args: Args<P>) => {
        subscribers[name]?.forEach((watcher) =>
          watcher(...(args as unknown as Args<T>)),
        );
      },
  };
};

const createMatcher = <Params, Result>(
  target: ChainFn<Params, Result>,
  fn?: (a: Params, b: Params) => boolean,
) => {
  let pending: [Params, Promise<Result>][] = [];

  return (payload: Params | [Params, boolean]) => {
    const [params, prevMatched] = Array.isArray(payload)
      ? payload
      : [payload, false];
    const matched = fn && pending.find(([prev]) => fn(params, prev));

    const promise = matched?.[1] ?? target(params);
    if (!matched && promise instanceof Promise) {
      pending.push([params, promise]);
      promise
        .finally(() => {
          const index = pending.findIndex((p) => p[1] === promise);
          pending.splice(index, 1);
        })
        .catch(() => void 0);
    }

    return [
      promise,
      matched?.[0] ?? params,
      Boolean(matched || prevMatched),
    ] as [Promise<Result>, Params, boolean];
  };
};
