import { Call, Commands, Watcher } from "./utils";

export type Disposer = VoidFunction;

export interface Unit<P = any, X = void> {
  watch(watcher: (p: P, x: X) => void): Disposer;
}

export type Command<I, O> = (params: I extends Promise<infer U> ? U : I) => O;

export interface Action<Input = void, Output = Input>
  extends
    Call<Input, { val: () => Output }>,
    Unit<Output>,
    Commands<Input, Output> {}

export interface Task<Input, Params = Input, Result = unknown>
  extends Call<Input, { val(): Promise<Result> }>, Unit<Params> {
  done: Unit<Result, Params>;
  fail: Unit<Error, Params>;
  end: Unit<Params>;
}

export interface ReadStore<State> extends Unit<State> {
  get(): State;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
  subscribe(watcher: Watcher): Disposer;
}

export interface WriteStore<State> extends ReadStore<State> {
  on<U, P = void>(
    unit: Unit<U, P>,
    fn: (state: State, u: U, p: P) => State,
  ): WriteStore<State>;
  set(state: State): void;
  off(unit?: Unit): WriteStore<State>;
}

export type Store<State> = ReadStore<State> | WriteStore<State>;
