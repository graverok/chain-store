import { useState, useEffect, DependencyList } from "react";
import { store as factory } from "chain-store";
import type { Store as Source, StorePart as SourcePart } from "chain-store";

const adapt = <State>($store: SourcePart<State> | Source<State>) => {
  const map = $store.map;

  return Object.assign($store, {
    use<Selected = State>(
      mapper?: (state: State) => Selected,
      deps: DependencyList = [],
    ) {
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
    map: <Selected>(mapper: (state: State) => Selected): StorePart<Selected> =>
      adapt(map(mapper)),
  });
};

export interface StorePart<State> extends SourcePart<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: DependencyList,
  ): Selected;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
}
export interface Store<State> extends Source<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: DependencyList,
  ): Selected;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
}
export type { Action, Task, Unit, Disposer, Call } from "chain-store";

export const store = <State>(initialState: State) =>
  adapt(factory(initialState)) as Store<State>;
export { chain } from "chain-store";
