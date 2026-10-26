import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  type Accessor,
} from "solid-js";
import type { Store } from "../types";

const getter = <State>($store: Store<State> | (() => Store<State>)) =>
  typeof $store === "function" ? $store() : $store;

export function useStore<State>(
  $store: Store<State> | (() => Store<State>),
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
  Task,
  WriteStore,
  ReadStore,
  Store,
  Unit,
  Command,
  Disposer,
} from "../types";

export * from "../index.js";
