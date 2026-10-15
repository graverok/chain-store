import { Args, Call, Commands } from "./utils";

export type Disposer = VoidFunction;

export interface Unit<Params> {
  watch: (watcher: (...args: Args<Params>) => void) => Disposer;
}

export type Command<Input, Output> = (
  params: Awaited<Input>,
) => Output | Promise<Output>;

export interface Action<Input = void, Output = Input>
  extends Call<Input, { val: () => Output }>,
    Unit<Output>,
    Commands<Input, Output> {}

export interface Target<Input, Params = Input, Result = unknown, Err = Error>
  extends Call<Input, { val: () => Promise<Result> }>,
    Unit<Params> {
  done: {
    watch: (watcher: (result: Result, params: Params) => void) => Disposer;
  };
  fail: {
    watch: (watcher: (error: Err, params: Params) => void) => Disposer;
  };
  end: {
    watch: (watcher: (params: Params) => void) => Disposer;
  };
}

export interface ReadStore<State> {
  watch: (watcher: (state: State) => void) => Disposer;
  get: () => State;
  map: <Part>(mapper: (state: State) => Part) => ReadStore<Part>;
}

export interface Store<State> extends ReadStore<State> {
  on: <T>(
    action: Unit<T>,
    fn: (state: State, ...args: Args<T>) => State,
  ) => Store<State>;
  set: (state: State) => void;
  off: <T>(action?: Unit<T>) => Store<State>;
}
