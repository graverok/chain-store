import { useState, useEffect } from "preact/hooks";
import { Store } from "../types";

export const useStore = <State>(
  $store: Store<State>,
  deps: readonly any[] = [$store],
) => {
  const [state, setState] = useState<State>($store.get());

  useEffect(() => $store.watch((state) => setState(() => state)), deps);

  return state;
};

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
