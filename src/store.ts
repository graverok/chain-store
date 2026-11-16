import { subscriber, type Emitter, type Watcher } from "./lib.js";
import { Disposer, Store, StorePart, Unit } from "./types.js";

const create = <State, Parent extends unknown | void = void>(
  initialState: State,
  propagate?: (set: (state: State) => void) => () => void,
): Parent extends void ? Store<State> : StorePart<State> => {
  let subscriptions: Map<Unit<unknown, unknown>, Disposer> | void;
  let parts: Map<(m: any) => void, (s: State) => any>;
  const emitter = [] as Emitter;
  let state = initialState;

  const set = (next: State) => {
    const diff = next !== state;
    state = next;
    diff && emitter[1]?.(state);
    parts?.forEach((mapper, set) => set(mapper(state)));
  };

  const store = {
    get: () => state,
    ...subscriber(emitter),
    subscribe: (watcher: Watcher) => {
      watcher(state);
      return store.watch(watcher);
    },
    map: <Selector>(fn: (state: State) => Selector) =>
      create<Selector, State>(fn(state), (set) => {
        (parts = parts ?? new Map()) && parts.set(set, fn);
        return () => parts.delete(set);
      }),
    off:
      propagate?.(set) ??
      ((unit?: Unit) => {
        if (unit) {
          subscriptions?.get(unit)?.();
          subscriptions?.delete(unit);
        } else {
          subscriptions?.forEach((d) => d());
          subscriptions?.clear();
        }
        return store;
      }),
    ...(!propagate && {
      on: <P extends State, X>(
        unit: Unit<P, X>,
        updater: (state: State, payload: P, ext: X) => State = (_, payload) =>
          payload as State,
      ) => {
        subscriptions?.get(unit)?.();
        (subscriptions = subscriptions ?? new Map()) &&
          subscriptions.set(
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

export const store = <State>(initialState: State) =>
  create<State>(initialState);
