import { subscriber, type Emitter, type Watcher } from "./lib.js";
import { Disposer, Store, StorePart, Unit } from "./types.js";

const create = <State, Parent extends unknown | void = void>(
  initial: State,
  propagate?: (set: (state: State) => void) => { off: () => void },
): Parent extends void ? Store<State> : StorePart<State> => {
  const emt = [] as Emitter[];
  let maps: Map<(m: any) => void, (s: State) => any>;
  let ons: Map<Unit<unknown, unknown>, Disposer> | null;
  let state = initial;

  const set = (next: State, ...args: unknown[]) => {
    const unique = next !== state;
    state = next;
    unique && emt[0]?.call(args, state);
    maps?.forEach((mapper, set) => set(mapper(state)));
  };

  const store = {
    ...subscriber(emt),
    subscribe: (watcher: Watcher) => {
      watcher(state);
      return store.watch(watcher);
    },
    get: () => state,
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

      set,
    }),
  } as unknown as Parent extends void ? Store<State> : StorePart<State>;

  return store;
};

export const store = <State>(initial: State) => create<State>(initial);
