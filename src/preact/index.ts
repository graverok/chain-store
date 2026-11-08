import { useState, useEffect } from "preact/hooks";
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
      deps: unknown[] = [],
    ) {
      const [state, setState] = useState<Selected>(
        (mapper ? mapper($store.get()) : $store.get()) as Selected,
      );

      useEffect(() => {
        const $part = mapper ? $store.map(mapper) : $store;
        const disposers = [
          $part.subscribe((value: Selected | State) =>
            setState(() => value as Selected),
          ),
          mapper && $part.off,
        ];
        return () => disposers.forEach((d) => d?.());
      }, deps);

      return state;
    },
    map: <Selected>(mapper: (state: State) => Selected): StorePart<Selected> =>
      adapt(map(mapper)),
  });
};

export interface StorePart<State> extends SourcePart<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: unknown[],
  ): Selected;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
}
export interface Store<State> extends Source<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: unknown[],
  ): Selected;
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
