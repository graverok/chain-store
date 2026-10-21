import {
  Action,
  Target,
  Store,
  Disposer,
  Unit,
  Command,
  ReadStore,
} from "./types";

import {
  resolver,
  caller,
  splicer,
  subscriber,
  waiter,
  pusher,
  Carrier,
  Emitter,
  Args,
  Match,
  Queue,
  evaluate,
} from "./utils";

export const chain = <Input = void>() => createAction<Input>();

export const store = <State>(initialState: State) =>
  createStore<State>(initialState);

const createStore = <State, Parent extends unknown | void = void>(
  initialState: State,
  config?: [Unit<Parent>, (state: Parent) => State],
): Parent extends void ? Store<State> : ReadStore<State> => {
  let disposers: [Unit<unknown>, Disposer][] = [];
  const emitters = [[], []] as unknown as [Emitter, Emitter];
  const unit = { watch: subscriber(emitters[1]) } as Unit<State>;

  let state = initialState;

  const off = <U>(action: Unit<U>) =>
    splicer(disposers, void 0, (x) => x[0] === action)?.[1]();

  const set = (next: State) => {
    const diff = next !== state;
    state = next;
    diff && emitters[0][1]?.(state);
    emitters[1][1]?.(state);
  };

  config?.[0].watch((...args) => set(config[1](args[0] as Parent)));

  const store = {
    get: () => state,
    watch: subscriber(emitters[0]),
    map: <PartState>(mapper: (state: State) => PartState) =>
      createStore<PartState, State>(mapper(state), [unit, mapper]),
    ...(config
      ? {}
      : {
          on: <U>(
            unit: Unit<U>,
            updater: (state: State, ...args: Args<U>) => State,
          ) => {
            off(unit);
            disposers.push([
              unit,
              unit.watch((...args) => set(updater(state, ...args))),
            ]);
            return store;
          },
          off: <U>(action?: Unit<U>) => {
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
    : ReadStore<State>;
};

const createAction = <Input = void, Output = Input>(
  start?: Carrier<Input>,
  propagate?: (fn: Carrier) => void,
  map?: (...params: any[]) => Output | Promise<Output>,
  filter?: (...params: any[]) => boolean | Promise<boolean>,
): Action<Input, Output> => {
  const emitter = [] as unknown as Emitter;
  const next: Carrier<Output>[] = [];

  const exec: Carrier<Output> = (params, config: [Queue, Match | void]) => {
    emitter[1]?.(params);
    config[1]?.(call)?.(() => params);
    caller<Output>(params, config)(next);
  };

  const call: Carrier<Input | Output> = (params, config) => {
    try {
      const catcher = (err?: Error) =>
        config[1]?.()?.(() => {
          if (err) {
            err.name = "ChainError";
            throw err;
          } else {
            const err = new Error();
            err.name = "ChainBlock";
            throw err;
          }
        });
      if (map)
        return resolver(params, map, (res) => exec(res, config), catcher);
      if (filter)
        return resolver(
          params,
          filter,
          (res) => {
            if (res) return exec(params as Output, config);
            catcher();
          },
          catcher,
        );
      exec(params as Output, config);
    } catch {}
  };

  propagate?.(call);

  const action = (input: Input) => {
    const [val, respondent] = evaluate(true);
    (start ?? call)(input, [
      [],
      (carrier) => (!carrier || carrier === call ? respondent : void 0),
    ]);
    return { val };
  };

  return Object.assign(
    action,
    createMethods(emitter, start ?? call, next),
  ) as Action<Input, Output>;
};

const createTarget = <Input, Result, Params = Input, Err = Error>(
  start: Carrier<Input>,
  propagate: (fn: Carrier<Params>) => void,
  target: (params: Params) => Result | Promise<Result>,
) => {
  const emitter = [[], [], [], []] as unknown as Emitter[];
  const pending: Promise<Result>[] = [];

  const exec = async (params: Params, match: Match<Result> | void) => {
    const promise = target(params);

    if (!(promise instanceof Promise)) {
      emitter[0][1]?.(params);
      return waiter(() => {
        emitter[1][1]?.(promise, params);
        match?.(call)?.(() => promise);
      });
    }

    const duplicate = pending.includes(promise);
    !duplicate && pending.push(promise);
    !duplicate && emitter[0][1]?.(params);

    try {
      const result = await promise;
      !duplicate && emitter[1][1]?.(result, params);
      match?.(call)?.(() => result);
    } catch (err) {
      !duplicate && emitter[2][1]?.(err as Err, params);
      match?.(call)?.(() => {
        throw err;
      });
    } finally {
      duplicate
        ? waiter(() => splicer(pending, promise))
        : emitter[3][1]?.(params);
    }
  };

  const call: Carrier<Params> = (params, config) => {
    try {
      waiter(() => exec(params, config[1]));
    } catch {}
  };

  propagate(call);

  const action = (input: Input) => {
    const [val, respondent] = evaluate();
    start(input, [
      [],
      (carrier) => (!carrier || carrier === call ? respondent : void 0),
    ]);
    return { val };
  };

  return Object.assign(action, {
    ...createMethods(emitter[0]),
    done: createMethods(emitter[1]),
    fail: createMethods(emitter[2]),
    end: createMethods(emitter[3]),
  }) as Target<Input, Params, Result, Err>;
};

const createMethods = <Input, Output = Input>(
  emitter: Emitter,
  start?: Carrier<Input>,
  next?: Carrier<Awaited<Output>>[],
) => {
  if (!start || !next) return { watch: subscriber(emitter) };
  return {
    watch: subscriber(emitter),
    map: <Mapped>(map: Command<Output, Mapped>): Action<Input, Mapped> =>
      createAction(start, pusher(next), map as Command<Output, Mapped>),
    filter: (filter: Command<Output, boolean>): Action<Input, Output> =>
      createAction(
        start,
        pusher(next),
        void 0,
        filter as Command<Output, boolean>,
      ),
    target: <Result, Err>(
      target: Command<Output, Result>,
    ): Target<Input, Output, Result, Err> =>
      createTarget(start, pusher(next), target as Command<Output, Result>),
  };
};
