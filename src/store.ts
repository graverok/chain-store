import { subscriber, type Emitter, type Watcher } from "./lib.js";
import { Disposer, Store, StorePart, Unit } from "./types.js";

const create = <State, Parent extends unknown | void = void>(
  initial: State,
  propagate?: (set: (state: State) => void) => { off: () => void },
): Parent extends void ? Store<State> : StorePart<State> => {
  let ons: Map<Unit<unknown, unknown>, Disposer> | null;
  let maps: Map<(m: any) => void, (s: State) => any>;
  let state = initial;
  const emt = [] as Emitter;

  const set = (next: State, ...args: any[]) => {
    next !== state && emt[1]?.call(args, next);
    maps?.forEach((mapper, set) => set(mapper(next)));
    state = next;
  };

  const store = {
    get: () => state,
    ...subscriber(emt),
    subscribe: (watcher: Watcher) => {
      watcher(state);
      return store.watch(watcher);
    },
    map: <Selector>(fn: (state: State) => Selector) =>
      create<Selector, State>(
        fn(state),
        (set) =>
          (maps = maps ?? new Map()) &&
          maps.set(set, fn) && {
            off: () => maps.delete(set),
          },
      ),
    ...(propagate?.(set) ?? {
      off: (unit?: Unit) => {
        if (unit) {
          ons?.get(unit)?.();
          ons?.delete(unit);
        } else {
          ons?.forEach((off) => off());
          ons = null;
        }
        return store;
      },
      on: <P extends State, X>(
        unit: Unit<P, X>,
        fn: (state: State, payload: P, ext: X) => State = (_, payload) =>
          payload as State,
      ) => {
        ons?.get(unit)?.();
        (ons = ons ?? new Map()) &&
          ons.set(
            unit,
            unit.watch((...args) => set(fn(state, ...args), unit, ...args)),
          );
        return store;
      },
      set,
    }),
  } as unknown as Parent extends void ? Store<State> : StorePart<State>;

  return store;
};

export const store = <State>(initial: State) => create<State>(initial);
