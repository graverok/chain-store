import {
  Action,
  AsyncAction,
  Args,
  ChainFn,
  Store,
  Subscription,
  Unit,
  ActionPromiseMethods,
} from "./types";

export const createAction = <Input>() => initAction<Input>([]);

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

const initAction = <Input, Output = Input>(
  callers: ((input: Input) => void)[],
  config?: {
    filter?: ChainFn<Output, boolean>;
    map?: ChainFn<Input, Output>;
  },
) => {
  const emitter = createEmitter<Input>();

  const exec = (params: Output) => {
    emitter.emit("watch")(params);
    return;
  };

  const call = (input: Input) => {
    try {
      mapper(exec, config)(input);
    } catch {}
  };

  callers.push(call);

  const action = (input: Input) => {
    callers.forEach((caller) => caller(input));
    return;
  };

  return Object.assign(action, {
    ...emitter.init("watch"),
    map: <Mapped>(fn: ChainFn<Output, Mapped>) => {
      return initAction<Input, Mapped>(callers, {
        map:
          config?.filter || config?.map
            ? mapper(fn, config, true)
            : (fn as unknown as ChainFn<Input, Mapped>),
      });
    },
    filter: (fn: ChainFn<Output, boolean>) => {
      return initAction<Input, Output>(callers, {
        ...config,
        filter: config?.filter ? filterer(fn, config.filter) : fn,
      });
    },
    target: <Result, Err>(fn: ChainFn<Output, Result>) => {
      if (!config?.filter)
        return initAsyncAction<Input, Result, Output, Err>(callers, {
          map: config?.map,
          target: fn,
        });

      return initAsyncAction<Input, Result, Output, Err>(callers, {
        map: async (input: Input) => {
          const params = config?.map ? await config.map(input) : input;
          const res = await (config.filter as ChainFn<Output, boolean>)(
            params as Output,
          );
          if (!res) throw new Error();
          return params as Output;
        },
        target: fn,
      });
    },
  }) as Action<Input, Output>;
};

const initAsyncAction = <Input, Result, Params = Input, Err = Error>(
  callers: ((input: Input) => void)[],
  config: {
    target: ChainFn<Params, Result>;
    map?: ChainFn<Input, Params>;
  },
) => {
  const emitter = createEmitter<Params>();

  const exec = async (
    params: Params,
    events?: ActionPromiseMethods<Params, Result, Err>,
  ) => {
    emitter.emit("watch")(params);

    try {
      const result = await config.target(params);
      emitter.emit("done")(result, params);
      events?.done(result, params);
    } catch (err) {
      emitter.emit("fail")(err as Err, params);
      events?.fail(err as Err, params);
    } finally {
      emitter.emit("finally")(params);
      events?.finish(params);
    }
  };

  const call = async (
    input: Input,
    events?: ActionPromiseMethods<Params, Result, Err>,
  ) => {
    if (!config.map) return await exec(input as unknown as Params, events);

    try {
      const params = await config.map(input);
      await exec(params, events);
    } catch {}
  };

  callers.push(call);

  const action = (input: Input) => {
    const stored: { params?: Params; result?: Result; error?: Err } = {};
    const { events, methods } = resolver(stored);

    callers.forEach((caller) => {
      call === caller ? call(input, events) : caller(input);
    });

    return methods;
  };

  return Object.assign(action, {
    ...emitter.init("watch"),
    done: emitter.init("done"),
    fail: emitter.init("fail"),
    finish: emitter.init("finish"),
  }) as AsyncAction<Input, Result, Params, Err>;
};

const filterer =
  <I, O>(fn: ChainFn<I, O>, filter?: ChainFn<I, boolean>, fail?: boolean) =>
  (params: I) => {
    const filtered = filter?.(params) ?? true;
    const exec = (res: boolean) => {
      if (!res && fail) throw new Error();
      return (res && fn(params)) as O;
    };
    return filtered instanceof Promise ? filtered.then(exec) : exec(filtered);
  };

const mapper =
  <I, O, R>(
    fn: ChainFn<O, R>,
    config?: { filter?: ChainFn<O, boolean>; map?: ChainFn<I, O> },
    fail?: boolean,
  ) =>
  (input: I) => {
    const params = config?.map?.(input) ?? (input as unknown as O);
    return params instanceof Promise
      ? params.then(filterer(fn, config?.filter, fail)).catch(() => {
          if (fail) throw new Error();
          return false as R;
        })
      : filterer(fn, config?.filter, fail)(params);
  };

const resolver = <Params, Result, Error>(stored: {
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
    done: (result: Result, params: Params) =>
      (stored.result = result) && methods.done?.(result, params),
    fail: (error: Error, params: Params) =>
      (stored.error = error) && methods.fail?.(error, params),
    finish: (params: Params) =>
      (stored.params = params) && methods.finish?.(params),
  };

  const init = <K extends keyof typeof methods>(
    key: K,
    ...argsKey: (keyof typeof stored)[]
  ) =>
    methods[key]
      ? void 0
      : <U extends unknown[]>(fn: (...args: U) => void) => {
          //@ts-expect-error
          methods[key] = fn;
          fn(...(argsKey.map((k) => stored[k]) as U));
          return resolver(stored).methods;
        };

  return {
    events,
    methods: {
      done: init("done", "result", "params"),
      fail: init("fail", "error", "params"),
      finish: init("finish", "params"),
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
