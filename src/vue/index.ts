import {
  readonly,
  ref,
  watch,
  type WatchSource,
  type Ref,
  type DeepReadonly,
} from "vue";
import {
  store as factory,
  type ReadStore as ReadSource,
  type WriteStore as WriteSource,
} from "chain-store";

const adapt = <State>($store: ReadSource<State> | WriteSource<State>) => {
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
        (_, __, onCleanup) => {
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
    map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected> {
      return adapt(map(mapper)) as ReadStore<Selected>;
    },
  });
};

export interface ReadStore<State> extends ReadSource<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: WatchSource<unknown>[],
  ): DeepReadonly<Ref<Selected>>;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export interface WriteStore<State> extends WriteSource<State> {
  use<Selected = State>(
    mapper?: (state: State) => Selected,
    deps?: WatchSource<unknown>[],
  ): DeepReadonly<Ref<Selected>>;
  map<Selected>(mapper: (state: State) => Selected): ReadStore<Selected>;
}
export type Store<State> = ReadStore<State> | WriteStore<State>;
export type { Action, Task, Unit, Command, Disposer } from "chain-store";

export const store = <State>(initialState: State) =>
  adapt(factory(initialState)) as WriteStore<State>;
export { chain } from "chain-store";
