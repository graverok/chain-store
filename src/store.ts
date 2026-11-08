import { Emitter, splicer, subscriber, type Watcher } from "./lib";
import { Disposer, Store, StorePart, Unit } from "./types";

export const store = <State>(initialState: State) =>
  createStore<State>(initialState);

const createStore = <State, Parent extends unknown | void = void>(
  initialState: State,
  parent?: Unit<Parent>,
  fn?: (state: Parent) => State,
): Parent extends void ? Store<State> : StorePart<State> => {
  let disposers: [Unit, Disposer][] = [];
  const em = [] as Emitter;
  const e2 = [] as Emitter;
  const unit = { watch: subscriber(e2) } as Unit<State>;

  let state = initialState;

  const off = (action: Unit) =>
    splicer(disposers, void 0, (x) => x[0] === action)?.[1]();

  const set = (next: State) => {
    const diff = next !== state;
    state = next;
    diff && em[1]?.(state);
    e2[1]?.(state);
  };

  const dispose = parent?.watch((arg) => set(fn?.(arg) as State));

  const store = {
    get: () => state,
    watch: subscriber(em),
    subscribe: (watcher: Watcher) => {
      watcher(state);
      return subscriber(em)(watcher);
    },
    map: <Selector>(mapper: (state: State) => Selector) =>
      createStore<Selector, State>(mapper(state), unit, mapper),
    ...(parent
      ? {
          off: dispose as () => void,
        }
      : {
          on: <P extends State, X>(
            unit: Unit<P, X>,
            updater: (state: State, payload: P, ext: X) => State = (
              _,
              payload,
            ) => payload as State,
          ) => {
            off(unit as unknown as Unit);
            disposers.push([
              unit as unknown as Unit,
              unit.watch((...args) => set(updater(state, ...args))),
            ]);
            return store;
          },
          off: (action?: Unit) => {
            if (action) {
              off(action);
            } else {
              disposers.forEach((d) => d[1]());
              disposers = [];
            }
            return store;
          },
          set,
        }),
  };
  return store as unknown as Parent extends void
    ? Store<State>
    : StorePart<State>;
};
