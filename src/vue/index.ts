import {
  watch,
  shallowRef,
  readonly,
  toValue,
  type Ref,
  type WatchSource,
} from "vue";
import { ReadStore } from "../types";

export function useStore<State>(
  $store: ReadStore<State> | (() => ReadStore<State>),
  deps: WatchSource<unknown>[] = [],
) {
  const state = shallowRef<State>(toValue($store).get()) as Ref<State>;

  watch(
    deps,
    (_, __, onCleanup) => {
      const store = toValue($store);

      onCleanup(
        store.watch((value: State) => {
          state.value = value;
        }),
      );

      state.value = store.get();
    },
    { immediate: true },
  );

  return readonly(state);
}

export type {
  Action,
  Command,
  Disposer,
  Store,
  ReadStore,
  Unit,
  Target,
} from "../types";

export * from "../index.js";
