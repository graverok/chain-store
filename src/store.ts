import {
  Action,
  AsyncAction,
  Args,
  ChainFn,
  Store,
  Subscription,
  Unit,
  ActionPromiseEvents,
  AsyncActionOptions,
  ActionPromise,
} from "./types";

export const createAction = <Input>() => initAction<Input>();

export const createStore = <State>(initialState: State) => {
  const disposers: [Unit<unknown>, Subscription][] = [];
  const watchers: [(state: State) => void, (payload: any) => void][] = [];
  let watch: Emitter = {};
  let postponed: VoidFunction[] = [];
  let blocked = false;
  let state = initialState;

  const off = <U>(action: Unit<U>) =>
    splicer(disposers, void 0, (x) => x[0] === action)?.[1].dispose();

  const store = {
    on: <U>(
      action: Unit<U>,
      updater: (state: State, ...args: Args<U>) => State,
    ) => {
      off(action);

      disposers.push([
        action,
        action.watch((...args) => {
          blocked = true;
          const parts = watchers.map(([mapper]) => mapper(state));
          const nextState = updater(state, ...args);
          if (nextState !== state) {
            state = nextState;
            watch.emit?.(state);
          }
          watchers.forEach(([mapper, watcher], index) => {
            const mapped = mapper(state);
            mapped !== parts?.[index] && watcher(mapped);
          });
          blocked = false;
          postponed.forEach((p) => p());
          postponed = [];
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
        watchers.push([mapper, watcher]);
        return {
          dispose: () => {
            const handler = () =>
              splicer(
                watchers,
                void 0,
                ([m, w]) => m === mapper && w === watcher,
              );

            blocked ? postponed.push(handler) : handler();
          },
        };
      },
    }),
    getState: () => state,
    watch: subscribe(watch),
  };

  return store as Store<State>;
};

const initAction = <Input, Output = Input>(
  start?: (input: Input, events?: ActionPromiseEvents) => void,
  init?: (fn: (params: any) => void) => void,
  map?: (params: any) => Output | Promise<Output>,
  filter?: (params: Output) => boolean | Promise<boolean>,
) => {
  let watch: Emitter = {};
  const next: ((output: Output, events?: ActionPromiseEvents) => void)[] = [];

  const exec = (params: Output, events?: ActionPromiseEvents) => {
    watch.emit?.(params);
    next.forEach((call) => call(params, events));
  };

  const call = (input: Input | Output, events?: ActionPromiseEvents) => {
    try {
      if (map) return awaiter(input, map, (res) => exec(res, events));
      if (filter)
        return awaiter(
          input as Output,
          filter,
          (res) => res && exec(input as Output, events),
        );
      exec(input as Output, events);
    } catch {}
  };

  init?.(call);

  const action = (input: Input) => {
    (start ?? call)(input);
    return;
  };

  return Object.assign(action, {
    watch: subscribe(watch),
    map: <Mapped>(map: ChainFn<Output, Mapped>) =>
      initAction(start ?? call, pusher(next), map) as Action<Input, Mapped>,
    filter: (filter: ChainFn<Output, boolean>) =>
      initAction(start ?? call, pusher(next), void 0, filter) as Action<
        Input,
        Output
      >,
    target: <Result, Err>(
      fn: ChainFn<Output, Result>,
      options?: AsyncActionOptions,
    ) =>
      initAsyncAction<Input, Result, Output, Err>(
        start ?? call,
        pusher(next),
        fn,
        options,
      ),
  }) as Action<Input, Output>;
};

const initAsyncAction = <Input, Result, Params = Input, Err = Error>(
  start: (
    input: Input,
    events?: ActionPromiseEvents<Params, Result, Err>,
  ) => void,
  init: (fn: (params: Params) => void) => void,
  target: ChainFn<Params, Result>,
  options?: AsyncActionOptions,
) => {
  let watch: Emitter = {};
  let done: Emitter = {};
  let fail: Emitter = {};
  let finish: Emitter = {};
  const pending: Promise<Result>[] = [];

  const exec = async (
    params: Params,
    events?: ActionPromiseEvents<Params, Result, Err>,
  ) => {
    const promise = target(params);

    if (!(promise instanceof Promise)) {
      watch.emit?.(params);
      done.emit?.(promise, params);
      events?.done(promise, params);
      return;
    }

    const matched = pending.includes(promise);
    const skipDuplicates = options?.skipDuplicates !== false;
    !matched && skipDuplicates && pending.push(promise);
    (!matched || !skipDuplicates) && watch.emit?.(params);

    try {
      const result = await promise;
      (!matched || !skipDuplicates) && done.emit?.(result, params);
      events?.done(result, params);
    } catch (err) {
      (!matched || !skipDuplicates) && fail.emit?.(err as Err, params);
      events?.fail(err as Err, params);
    } finally {
      !matched || !skipDuplicates
        ? finish.emit?.(params)
        : window.requestAnimationFrame(() => {
            splicer(pending, promise);
          });
      events?.finish(params);
    }
  };

  const call = async (
    params: Params,
    events?: ActionPromiseEvents<Params, Result, Err>,
  ) => {
    try {
      await exec(params, events);
    } catch {}
  };

  init(call);

  const action = (input: Input) => {
    const { events, methods } = promiser();
    start(input, events);

    return methods;
  };

  return Object.assign(action, {
    watch: subscribe(watch),
    done: { watch: subscribe(done) },
    fail: { watch: subscribe(fail) },
    finish: { watch: subscribe(finish) },
  }) as AsyncAction<Input, Result, Params, Err>;
};

const awaiter = <O, R>(
  input: O,
  fn: (input: O) => R | Promise<R>,
  resolve: (r: R) => void,
) => {
  if (!fn) return resolve(input as unknown as R);
  const res = fn(input);
  if (!(res instanceof Promise)) return resolve(res);
  res.then(resolve).catch(() => void 0);
};

type PromiseState = "pending" | "done" | "fail";
type PromiseConfig<Params, Result, Error> = {
  stored: (Result | Error | Params)[];
  state: PromiseState;
  controller: ActionPromiseState;
  set: (state: PromiseState) => void;
};

const eventKeys = ["done", "fail", "finish"];

const promiser = <Params, Result, Error>(
  initialConfig?: PromiseConfig<Params, Result, Error>,
) => {
  const methods: {
    done?: (result: Result, params: Params) => void;
    fail?: (error: Error, params: Params) => void;
    finish?: (params: Params) => void;
  } = {};

  const config: PromiseConfig<Params, Result, Error> = initialConfig ?? {
    state: "pending",
    stored: [],
    set: (s: PromiseState) => (config.state = s),
    controller: new ActionPromiseState(() => config.state),
  };

  const events = eventKeys.reduce(
    (acc, key, index) => ({
      ...acc,
      [key]: (a: Result | Error | Params, b?: Params) => {
        config.stored[index] = a;
        if (index < 2) config.set(key as PromiseState);
        //@ts-expect-error
        methods[key]?.(a, b);
      },
    }),
    {} as ActionPromiseEvents<Params, Result, Error>,
  );

  const init = <K extends keyof typeof methods>(key: K, index: number) => ({
    [key]: methods[key]
      ? void 0
      : <U>(fn: (...args: Args<U>) => void) => {
          //@ts-expect-error
          methods[key] = fn;
          config.state !== "pending" &&
            //@ts-expect-error
            fn(config.stored[index], index < 2 ? config.stored[2] : void 0);
          return promiser(config).methods;
        },
  });

  return {
    events,
    methods: Object.assign(
      config.controller,
      eventKeys.reduce(
        (acc, key, index) => ({
          ...acc,
          ...init(key as keyof typeof methods, index),
        }),
        {},
      ),
    ) as unknown as ActionPromise<Params, Result, Error>,
  };
};

class ActionPromiseState {
  constructor(private getState: () => PromiseState) {}

  get state() {
    return this.getState();
  }
}

interface Emitter {
  watch?: (watcher: (...args: Args<any>) => void) => Subscription;
  emit?: (...args: Args<any>) => void;
}

const pusher =
  <U>(arr: U[]) =>
  (a: U) =>
    arr.push(a);

const splicer = <U = unknown>(arr: U[], a?: U, compare?: (b: U) => boolean) => {
  const index = arr.findIndex(compare ?? ((b) => a === b));
  return index >= 0 ? arr.splice(index, 1)[0] : void 0;
};

const subscribe =
  (emitter: Emitter) =>
  (callback: (...args: Args<any>) => void): Subscription => {
    if (emitter?.watch) return emitter.watch(callback);

    const subscribers: ((...args: Args<any>) => void)[] = [];

    const unsubscribe = (watcher: (...args: Args<any>) => void) =>
      splicer(subscribers, watcher);

    const subscribe = (watcher: (...args: Args<any>) => void) =>
      !subscribers.includes(watcher) && subscribers.push(watcher);

    emitter.watch = (watcher: (...args: Args<any>) => void) => {
      subscribe(watcher);
      return {
        dispose: () => unsubscribe(watcher),
      };
    };

    emitter.emit = (...args: Args<any>) =>
      subscribers.forEach((watcher) => watcher(...args));

    return emitter.watch(callback);
  };
