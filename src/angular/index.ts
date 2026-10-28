import { DestroyRef, inject, signal, type Signal } from "@angular/core";
import { store as factory } from "../index.js";
import { ReadStore as ReadSource, WriteStore as WriteSource } from "../types";

function reactor<State>($store: ReadSource<State> | WriteSource<State>) {
  const map = $store.map;

  return Object.assign($store, {
    use<Selected = State>(
      mapper?: (state: State) => Selected,
    ): Signal<Selected> {
      const destroyRef = inject(DestroyRef);
      const state = signal(
        mapper ? mapper($store.get()) : ($store.get() as unknown as Selected),
      );

      destroyRef.onDestroy(
        (mapper ? $store.map(mapper) : $store).subscribe((value: Selected) => {
          state.set(value as Selected);
        }),
      );

      return state.asReadonly();
    },
    map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected> {
      return reactor(map(mapper)) as ReadStore<Selected>;
    },
  });
}

export interface ReadStore<State> extends ReadSource<State> {
  use<Selected = State>(mapper?: (state: State) => Selected): Signal<Selected>;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export interface WriteStore<State> extends WriteSource<State> {
  use<Selected = State>(mapper?: (state: State) => Selected): Signal<Selected>;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export type Store<State> = ReadStore<State> | WriteStore<State>;
export type { Action, Task, Unit, Command, Disposer } from "../types";

export const store = <State>(initialState: State) =>
  reactor(factory(initialState)) as WriteStore<State>;
export { chain } from "../index.js";
