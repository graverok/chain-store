import { Emitter, subscriber, type Watcher } from "./lib";
import { Disposer, Store, StorePart, Unit } from "./types";

export const store = <State>(initialState: State) =>
  createStore<State>(initialState);

const createStore = <State, Parent extends unknown | void = void>(
  initialState: State,
  propagate?: (set: (state: State) => void) => () => void,
): Parent extends void ? Store<State> : StorePart<State> => {
  let disposers: Map<Unit<unknown, unknown>, Disposer> | void;
  let parts: Set<() => void>;
  const emitter = [] as Emitter;
  let state = initialState;

  const set = (next: State) => {
    const diff = next !== state;
    state = next;
    diff && emitter[1]?.(state);
    parts?.forEach((p) => p());
  };

  const store = {
    get: () => state,
    ...subscriber(emitter),
    subscribe: (watcher: Watcher) => {
      watcher(state);
      return store.watch(watcher);
    },
    map: <Selector>(map: (state: State) => Selector) =>
      createStore<Selector, State>(map(state), (set) => {
        const updater = () => set(map(state));
        (parts = parts ?? new Set()) && parts.add(updater);
        return () => parts.delete(updater);
      }),
    off:
      propagate?.(set) ??
      ((unit?: Unit) => {
        if (unit) {
          disposers?.get(unit)?.();
          disposers?.delete(unit);
        } else {
          disposers?.forEach((d) => d());
          disposers?.clear();
        }
        return store;
      }),
    ...(!propagate && {
      on: <P extends State, X>(
        unit: Unit<P, X>,
        updater: (state: State, payload: P, ext: X) => State = (_, payload) =>
          payload as State,
      ) => {
        disposers?.get(unit)?.();
        (disposers = disposers ?? new Map()) &&
          disposers.set(
            unit,
            unit.watch((...args) => set(updater(state, ...args))),
          );

        return store;
      },
      set,
    }),
  } as unknown as Parent extends void ? Store<State> : StorePart<State>;

  return store;
};
