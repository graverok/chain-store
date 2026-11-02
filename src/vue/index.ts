import {
  readonly,
  ref,
  watch,
  type WatchSource,
  type Ref,
  type DeepReadonly,
} from "vue";
import { store as factory } from "chain-store";
import type { Store as Source, StorePart as SourcePart } from "chain-store";

const adapt = <State>($store: Source<State> | SourcePart<State>) => {
  const map = $store.map;

  return Object.assign($store, {
    use<Selected = State>(
      mapper?: (state: State) => Selected,
      deps: WatchSource<unknown>[] = [],
    ): DeepReadonly<Ref<Selected>> {
      const state = ref<Selected>(
        (mapper ? mapper($store.get()) : $store.get()) as Selected,
      ) as Ref<Selected>;

      watch(
        deps,
        (_: unknown, __: unknown, onCleanup: (fn: () => void) => unknown) => {
          onCleanup(
            (mapper ? $store.map(mapper) : $store).subscribe(
              (value: State | Selected) => {
                state.value = value as Selected;
              },
            ),
          );
        },
        { immediate: true },
      );

      return readonly(state);
    },
    map: <Selected>(mapper: (state: State) => Selected): StorePart<Selected> =>
      adapt(map(mapper)),
  });
};

export interface StorePart<State> extends SourcePart<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: WatchSource<unknown>[],
  ): DeepReadonly<Ref<Selected>>;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
}
export interface Store<State> extends Source<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: WatchSource<unknown>[],
  ): DeepReadonly<Ref<Selected>>;
  map<Selected>(mapper: (state: State) => Selected): StorePart<Selected>;
}
export type { Action, Task, Unit, Disposer, Call } from "chain-store";

export const store = <State>(initialState: State) =>
  adapt(factory(initialState)) as Store<State>;
export { chain } from "chain-store";
