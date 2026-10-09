import {
  Action,
  AsyncAction,
  Args,
  ChainFn,
  Store,
  Subscription,
  Unit,
  ActionPromiseMethods,
  AsyncActionOptions,
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
    target: <Result, Err>(
      fn: ChainFn<Output, Result>,
      options?: AsyncActionOptions,
    ) => {
      if (!config?.filter)
        return initAsyncAction<Input, Result, Output, Err>(callers, {
          map: config?.map,
          target: fn,
          options,
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
        options,
      });
    },
  }) as Action<Input, Output>;
};

const initAsyncAction = <Input, Result, Params = Input, Err = Error>(
  callers: ((input: Input) => void)[],
  config: {
    target: ChainFn<Params, Result>;
    map?: ChainFn<Input, Params>;
    options?: AsyncActionOptions;
  },
) => {
  const emitter = createEmitter<Params>();
  const pending: Promise<Result>[] = [];

  const exec = async (
    params: Params,
    events?: ActionPromiseMethods<Params, Result, Err>,
  ) => {
    const promise = config.target(params);

    if (!(promise instanceof Promise)) {
      emitter.emit("watch")(params);
      emitter.emit("done")(promise, params);
      events?.done(promise, params);
      return;
    }

    const matched = pending.includes(promise);
    const skipDuplicates = config.options?.skipDuplicates !== false;
    !matched && skipDuplicates && pending.push(promise);
    (!matched || !skipDuplicates) && emitter.emit("watch")(params);

    try {
      const result = await promise;
      (!matched || !skipDuplicates) && emitter.emit("done")(result, params);
      events?.done(result, params);
    } catch (err) {
      (!matched || !skipDuplicates) && emitter.emit("fail")(err as Err, params);
      events?.fail(err as Err, params);
    } finally {
      if (!matched || !skipDuplicates) {
        emitter.emit("finally")(params);
      } else {
        const index = pending.findIndex((p) => p === promise);
        index >= 0 && pending.splice(index, 1);
      }
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
    const { events, methods } = resolver();

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

const resolver = <Params, Result, Error>(initialConfig?: {
  stored: { params?: Params; result?: Result; error?: Error };
  state: "pending" | "done" | "fail";
  controller: ActionPromiseState;
  set: (state: "pending" | "done" | "fail") => void;
}) => {
  const methods: {
    done?: (result: Result, params: Params) => void;
    fail?: (error: Error, params: Params) => void;
    finish?: (params: Params) => void;
  } = {};

  const config: {
    stored: { params?: Params; result?: Result; error?: Error };
    state: "pending" | "done" | "fail";
    controller: ActionPromiseState;
    set: (state: "pending" | "done" | "fail") => void;
  } = initialConfig ?? {
    state: "pending",
    stored: {},
    set: (s: "done" | "fail" | "pending") => {
      config.state = s;
    },
    controller: new ActionPromiseState(() => config.state),
  };

  const events = {
    done: (result: Result, params: Params) => {
      config.stored.result = result;
      config.set("done");
      methods.done?.(result, params);
    },
    fail: (error: Error, params: Params) => {
      config.stored.error = error;
      config.set("fail");
      methods.fail?.(error, params);
    },
    finish: (params: Params) => {
      config.stored.params = params;
      methods.finish?.(params);
    },
  };

  const init = <K extends keyof typeof methods>(
    key: K,
    ...argsKey: (keyof typeof config.stored)[]
  ) =>
    methods[key]
      ? void 0
      : <U extends unknown[]>(fn: (...args: U) => void) => {
          //@ts-expect-error
          methods[key] = fn;
          config.state !== "pending" &&
            fn(...(argsKey.map((k) => config.stored[k]) as U));
          return resolver(config).methods;
        };

  return {
    events,
    methods: Object.assign(config.controller, {
      done: init("done", "result", "params"),
      fail: init("fail", "error", "params"),
      finish: init("finish", "params"),
    }),
  };
};

class ActionPromiseState {
  constructor(private getState: () => "pending" | "done" | "fail") {}

  get state() {
    return this.getState();
  }
}

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
