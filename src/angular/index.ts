import { effect, signal, type Signal } from "@angular/core";
import type { ReadStore } from "../types";

const getter = <State>($store: ReadStore<State> | (() => ReadStore<State>)) =>
  typeof $store === "function" ? $store() : $store;

export function useStore<State>(
  $store: ReadStore<State> | (() => ReadStore<State>),
  deps: Signal<unknown>[] = [],
): Signal<State> {
  const state = signal<State>(getter($store).get());

  effect(
    (onCleanup) => {
      for (const dep of deps) dep();

      const store = getter($store);
      onCleanup(store.watch(state.set));
      state.set(store.get());
    },
    { allowSignalWrites: true },
  );

  return state.asReadonly();
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
