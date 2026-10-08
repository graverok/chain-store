type ActionCall<Params, Result extends unknown = void> = (
  params: Params,
) => Result;

type ActionPromise<
  Params,
  Result,
  Error,
  Methods = ActionPromiseMethods<Params, Result, Error>,
  Remaining extends keyof Methods = keyof Methods,
> = {
  [K in Remaining]: (
    fn: Methods[K],
  ) => ActionPromise<Params, Result, Error, Methods, Exclude<Remaining, K>>;
};

export type ActionPromiseMethods<Params, Result, Error> = {
  done: (result: Result, params: Params) => void;
  fail: (error: Error, params: Params) => void;
  finish: (params: Params) => void;
};

export type Args<Params> = Params extends Array<unknown> ? Params : [Params];

export type ChainFn<Input, Output> = (
  params: Input,
) => Output | Promise<Output>;

export interface Subscription {
  dispose: VoidFunction;
}

export interface Unit<Params> {
  watch: (watcher: (...args: Args<Params>) => void) => Subscription;
}

export interface Action<Input, Output = Input>
  extends ActionCall<Input>,
    Unit<Input> {
  filter: (fn: ChainFn<Output, boolean>) => Action<Input, Output>;
  map: <Mapped>(fn: ChainFn<Output, Mapped>) => Action<Input, Mapped>;
  target: <Result, Err>(
    fn: ChainFn<Output, Result>,
  ) => AsyncAction<Input, Result, Output, Err>;
}

export interface AsyncAction<Input, Result, Params = Input, Err = Error>
  extends ActionCall<Input, ActionPromise<Params, Result, Err>>,
    Unit<Params> {
  done: {
    watch: (watcher: (result: Result, params: Params) => void) => Subscription;
  };
  fail: {
    watch: (watcher: (error: Err, params: Params) => void) => Subscription;
  };
  finish: { watch: (watcher: (params: Params) => void) => Subscription };
}

export interface ReadStore<State> {
  watch: (watcher: (state: State) => void) => Subscription;
  getState: () => State;
}

export interface Store<State> extends ReadStore<State> {
  on: <T>(
    action: Unit<T>,
    f: (state: State, ...args: Args<T>) => State,
  ) => Store<State>;
  off: <T>(action: Unit<T>) => Store<State>;
  map: <Part>(
    mapper: (state: State) => Part,
  ) => Pick<Store<Part>, "watch" | "getState">;
}
