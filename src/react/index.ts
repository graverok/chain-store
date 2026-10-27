import { useState, useEffect, DependencyList } from "react";
import { Store } from "../types";

export const useStore = <State>(
  $store: Store<State>,
  deps: DependencyList = [$store],
) => {
  const [state, setState] = useState<State>($store.get());
  useEffect(() => $store.subscribe((state) => setState(() => state)), deps);
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
