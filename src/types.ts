import { Call, Commands } from "./utils.ts";

export type Disposer = VoidFunction;

export interface Unit<P = any, X = void> {
  watch: (watcher: (p: P, x: X) => void) => Disposer;
}

export type Command<I, O> = (params: Awaited<I>) => O | Promise<O>;

export interface Action<Input = void, Output = Input>
  extends Call<Input, { val: () => Output }>,
    Unit<Output>,
    Commands<Input, Output> {}

export interface Target<Input, Params = Input, Result = unknown, Err = Error>
  extends Call<Input, { val: () => Promise<Result> }>,
    Unit<Params> {
  done: Unit<Result, Params>;
  fail: Unit<Err, Params>;
  end: Unit<Params>;
}

export interface ReadStore<State> extends Unit<State> {
  get: () => State;
  map: <Part>(mapper: (state: State) => Part) => ReadStore<Part>;
}

export interface Store<State> extends ReadStore<State> {
  on: <U, P = void>(
    unit: Unit<U, P>,
    fn: (state: State, u: U, p: P) => State,
  ) => Store<State>;
  set: (state: State) => void;
  off: (unit?: Unit) => Store<State>;
}
