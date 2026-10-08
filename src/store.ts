import {
  Action,
  AsyncAction,
  Args,
  ChainFn,
  Store,
  Subscription,
  Unit,
} from "./types";

const voider = () => void 0;

const resolver = <I, R>(
  input: I,
  fn: ((input: I) => R | Promise<R>) | void,
  resolve: (r: R) => void,
) => {
  if (!fn) return resolve(input as unknown as R);
  const res = fn(input);
  if (!(res instanceof Promise)) return resolve(res);
  res.then(resolve).catch(voider);
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
      resolver(input, config?.map, (params) => {
        resolver(params, config?.filter, (res) => res && exec(params));
      });
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
    map: <Mapped>(fn: ChainFn<Output, Mapped>) => {
      if (!config?.filter && !config?.map)
        return initAction<Input, Mapped>(callers, {
          map: fn as unknown as ChainFn<Input, Mapped>,
        });

      const _filter = (p: Output) => {
        const filtered = config.filter?.(p) ?? true;
        if (filtered instanceof Promise)
          return filtered.then((res) => {
            if (!res) throw new Error();
            return fn(p);
          });
        if (filtered) return fn(p);
        throw new Error();
      };

      return initAction<Input, Mapped>(callers, {
        map: (input: Input) => {
          const params = config.map?.(input) ?? (input as unknown as Output);
          if (params instanceof Promise)
            return params.then((params) => _filter(params));
          return _filter(params);
        },
      });
    },
    filter: (fn: ChainFn<Output, boolean>) => {
      if (!config?.filter)
        return initAction<Input, Output>(callers, {
          ...config,
          filter: fn,
        });

      return initAction<Input, Output>(callers, {
        ...config,
        filter: (output: Output) => {
          const filtered = config.filter?.(output) ?? true;
          if (filtered instanceof Promise)
            return filtered.then((res) => (res ? fn(output) : false));
          return filtered && fn(output);
        },
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

type Events = {
  done: <R, P>(result: R, params: P) => void;
  fail: <E, P>(error: E, params: P) => void;
  finish: <P>(params: P) => void;
};

const initAsyncAction = <Input, Result, Params = Input, Err = Error>(
  callers: ((input: Input) => void)[],
  config: {
    target: ChainFn<Params, Result>;
    map?: ChainFn<Input, Params>;
  },
) => {
  const emitter = createEmitter<Params>();

  const exec = async (params: Params, events?: Events) => {
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

  const call = async (input: Input, events?: Events) => {
    if (!config.map) return await exec(input as unknown as Params, events);

    try {
      const params = await config.map(input);
      await exec(params, events);
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
    done: (result: Result, params: Params) =>
      (stored.result = result) && methods.done?.(result, params),
    fail: (error: Error, params: Params) =>
      (stored.error = error) && methods.fail?.(error, params),
    finish: (params: Params) =>
      (stored.params = params) && methods.finish?.(params),
  };

  const createMethod = <K extends keyof typeof methods>(
    key: K,
    ...argsKey: (keyof typeof stored)[]
  ) => {
    if (methods[key]) return void 0;
    return <U extends unknown[]>(fn: (...args: U) => void) => {
      //@ts-expect-error
      methods[key] = fn;
      fn(...(argsKey.map((k) => stored[k]) as U));
      return asyncActionResolver(stored).methods;
    };
  };

  return {
    events,
    methods: {
      done: createMethod("done", "result", "params"),
      fail: createMethod("fail", "error", "params"),
      finish: createMethod("finish", "params"),
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
