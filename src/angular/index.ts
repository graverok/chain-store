import { DestroyRef, inject, signal, type Signal } from "@angular/core";
import { store as factory } from "chain-store";
import type {
  Store as Source,
  StorePart as SourcePart,
  Unit,
} from "chain-store";

const adapt = <State>($store: SourcePart<State> | Source<State>) => {
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
    map: <Selected>(mapper: (state: State) => Selected): StorePart<Selected> =>
      adapt(map(mapper)),
  });
};

export interface StorePart<State> extends SourcePart<State> {
  use<Selected = State>(mapper?: (state: State) => Selected): Signal<Selected>;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
}
export interface Store<State> extends Source<State> {
  use<Selected = State>(mapper?: (state: State) => Selected): Signal<Selected>;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
  on<Params extends State, Ext = void>(unit: Unit<Params, Ext>): Store<State>;
  on<Params, Ext = void>(
    unit: Unit<Params, Ext>,
    fn: (state: State, params: Params, ext: Ext) => State,
  ): Store<State>;
  off(unit?: Unit): Store<State>;
}
export type { Action, Task, Unit, Disposer, Call } from "chain-store";

export const store = <State>(initialState: State) =>
  adapt(factory(initialState)) as Store<State>;
export { chain } from "chain-store";
