import { Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import {
  store as factory,
  type ReadStore as ReadSource,
  type WriteStore as WriteSource,
} from "chain-store";

const adapt = <State>($store: ReadSource<State> | WriteSource<State>) => {
  const map = $store.map;

  return Object.assign($store, {
    use: <Selected = State>(mapper?: (state: State) => Selected) => {
      const [state, setState] = createSignal<Selected>(
        (mapper ? mapper($store.get()) : $store.get()) as Selected,
      );

      createEffect(() => {
        onCleanup(
          (mapper ? $store.map(mapper) : $store).subscribe(
            (value: Selected | State) => setState(() => value as Selected),
          ),
        );
      });

      return state;
    },
    map: <Selected>(mapper: (state: State) => Selected): ReadStore<Selected> =>
      adapt(map(mapper)) as ReadStore<Selected>,
  });
};

export interface ReadStore<State> extends ReadSource<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
  ): Accessor<Selected>;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export interface WriteStore<State> extends WriteSource<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
  ): Accessor<Selected>;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export type Store<State> = ReadStore<State> | WriteStore<State>;
export type { Action, Task, Unit, Command, Disposer } from "../types";

export const store = <State>(initialState: State) =>
  adapt(factory(initialState)) as WriteStore<State>;
export { chain } from "chain-store";
