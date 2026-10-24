import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  type Accessor,
} from "solid-js";
import type { ReadStore } from "../types";

const getter = <State>($store: ReadStore<State> | (() => ReadStore<State>)) =>
  typeof $store === "function" ? $store() : $store;

export function useStore<State>(
  $store: ReadStore<State> | (() => ReadStore<State>),
  deps: Accessor<unknown>[] = [],
): Accessor<State> {
  const [state, setState] = createSignal<State>(getter($store).get());

  createEffect(
    on(
      deps,
      () => {
        const store = getter($store);
        onCleanup(store.watch((state) => setState(() => state)));
        setState(() => store.get());
      },
      { defer: false },
    ),
  );

  return state as Accessor<State>;
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
