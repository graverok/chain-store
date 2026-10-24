import { useState, useEffect } from "preact/hooks";
import { ReadStore } from "../types";

export const useStore = <State>(
  $store: ReadStore<State>,
  deps: readonly any[] = [$store],
) => {
  const [state, setState] = useState<State>($store.get());

  useEffect(() => {
    setState(() => $store.get());
    return $store.watch((state) => setState(() => state));
  }, deps);

  return state;
};

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
