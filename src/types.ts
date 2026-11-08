import { Watcher } from "./lib";

export type Disposer = () => void;

export interface Unit<Params = any, Ext = void> {
  watch(watcher: (params: Params, ext: Ext) => void): Disposer;
}

export interface Call<Input, Output = void> {
  (params: Input | Promise<Input>): Output;
}

export interface Action<Input = void, Output = Input> extends Call<
  Input,
  void
> {
  watch<Param>(
    this: Action<Input, Promise<Param>>,
    watcher: (params: Param) => void,
  ): Disposer;
  watch(watcher: (params: Output) => void): Disposer;
  map<Mapped, Param>(
    this: Action<Input, Promise<Param>>,
    map: (params: Param) => Promise<Mapped> | Mapped,
  ): Action<Input, Mapped>;
  map<Mapped>(
    fn: (params: Output) => Promise<Mapped> | Mapped,
  ): Action<Input, Mapped>;
  filter<Param>(
    this: Action<Input, Promise<Param>>,
    fn: (params: Param) => Promise<boolean> | boolean,
  ): Action<Input, Param>;
  filter(
    fn: (params: Output) => Promise<boolean> | boolean,
  ): Action<Input, Output>;
  task<Result, Param>(
    this: Action<Input, Promise<Param>>,
    fn: (params: Param) => Promise<Result> | Result,
  ): Task<Input, Param, Result>;
  task<Result>(
    fn: (input: Output) => Promise<Result> | Result,
  ): Task<Input, Output, Result>;
}

export interface Task<Input = void, Params = Input, Result = unknown>
  extends Call<Input, Promise<Result>>, Unit<Params> {
  done: Unit<Result, Params>;
  fail: Unit<Error, Params>;
  end: Unit<Params>;
}

export interface StorePart<State> extends Unit<State> {
  get(): State;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
  subscribe(watcher: Watcher): Disposer;
  off: Disposer;
}

export interface Store<State> extends StorePart<State> {
  on<Params extends State, Ext = void>(unit: Unit<Params, Ext>): Store<State>;
  on<Params, Ext = void>(
    unit: Unit<Params, Ext>,
    fn: (state: State, params: Params, ext: Ext) => State,
  ): Store<State>;
  set(state: State): void;
  off(unit?: Unit): Store<State>;
}
