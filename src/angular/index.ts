import { effect, signal, type Signal } from "@angular/core";
import type { Store } from "../types";

const getter = <State>($store: Store<State> | (() => Store<State>)) =>
  typeof $store === "function" ? $store() : $store;

export function useStore<State>(
  $store: Store<State> | (() => Store<State>),
  deps: Signal<unknown>[] = [],
): Signal<State> {
  const state = signal<State>(getter($store).get());

  effect(
    (onCleanup) => {
      for (const dep of deps) dep();

      const store = getter($store);
      onCleanup(store.watch(state.set));
    },
    { allowSignalWrites: true },
  );

  return state.asReadonly();
}

export type {
  Action,
  Task,
  WriteStore,
  ReadStore,
  Store,
  Unit,
  Command,
  Disposer,
} from "../types";

export * from "../index.js";
