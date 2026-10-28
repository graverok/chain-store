import { useState, useEffect } from "preact/hooks";
import { store as factory } from "../index.js";
import { ReadStore as ReadSource, WriteStore as WriteSource } from "../types";

const reactor = <State>($store: ReadSource<State> | WriteSource<State>) => {
  const map = $store.map;

  return Object.assign($store, {
    use: <Selected = State>(
      mapper?: (state: State) => Selected,
      deps: unknown[] = [],
    ) => {
      const [state, setState] = useState<Selected>(
        (mapper ? mapper($store.get()) : $store.get()) as Selected,
      );

      useEffect(
        () =>
          (mapper ? $store.map(mapper) : $store).subscribe(
            (value: Selected | State) => setState(() => value as Selected),
          ),
        deps,
      );

      return state;
    },
    map: <Selected>(mapper: (state: State) => Selected): ReadStore<Selected> =>
      reactor(map(mapper)) as ReadStore<Selected>,
  });
};

export interface ReadStore<State> extends ReadSource<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: unknown[],
  ): Selected;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export interface WriteStore<State> extends WriteSource<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: unknown[],
  ): Selected;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export type Store<State> = ReadStore<State> | WriteStore<State>;
export type { Action, Task, Unit, Command, Disposer } from "../types";

export { chain } from "../index.js";
export const store = <State>(initialState: State) =>
  reactor(factory(initialState)) as WriteStore<State>;
