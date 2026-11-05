import { Action, Task } from "./types";
import {
  splicer,
  subscriber,
  type Emitter,
  type Carrier,
  caller,
  resolver,
  type Queue,
  type Resolve,
  type Reject,
  awaiter,
  pusher,
} from "./lib";

export const chain = <Input = void>() => createAction<Input, Input>();

const createAction = <Input = void, Output = Input>(
  start?: Carrier<Input>,
  propagate?: (fn: Carrier) => void,
  map?: (params: any) => Promise<Output> | Output,
  filter?: (params: any) => Promise<boolean> | boolean,
) => {
  const emitter = [] as unknown as Emitter;
  const next: Carrier<Output>[] = [];

  const exec: Carrier<Output> = (params, config) => {
    emitter[1]?.(params);
    caller<Output>(params, config)(next);
  };

  const call: Carrier<Input | Output> = (params, config) => {
    const catcher = (error?: Error) => {
      let err = error ?? new Error();
      err.name = error ? "ChainError" : "ChainFilter";
      config[1]?.[1](err);
    };

    try {
      return resolver(
        filter?.(params) ?? map?.(params) ?? params,
        (res) =>
          filter
            ? res
              ? exec(params as Output, config)
              : catcher()
            : exec(res as Output, config),
        catcher,
      );
    } catch (err) {
      catcher(err as Error);
    }
  };

  propagate?.(call);

  const action = (input: Input) => {
    (start ?? call)(input, [[] as Queue, void 0, void 0]);
    return;
  };

  return Object.assign(
    action,
    createMethods<Input, Output>(emitter, start ?? call, next),
  ) as Action<Input, Output>;
};

const createTask = <Input, Result, Params>(
  start: Carrier<Input>,
  propagate: (fn: Carrier<Params>) => void,
  task: (params: Params) => Promise<Result> | Result,
) => {
  const emitters = [[], [], [], []] as unknown as Emitter[];
  const pending: Promise<Result>[] = [];

  const exec = async (
    params: Params,
    config: [Resolve<Result>, Reject] | void,
  ) => {
    const promise = task(params);

    if (!(promise instanceof Promise)) {
      emitters[0][1]?.(params);
      return awaiter(() => {
        emitters[1][1]?.(promise, params);
        config?.[0](promise);
      });
    }

    const duplicate = pending.includes(promise);
    !duplicate && pending.push(promise);
    !duplicate && emitters[0][1]?.(params);

    try {
      const result = await promise;
      !duplicate && emitters[1][1]?.(result, params);
      config?.[0](result);
    } catch (error) {
      !duplicate && emitters[2][1]?.(error, params);
      config?.[1](error as Error);
    } finally {
      duplicate
        ? awaiter(() => splicer(pending, promise))
        : emitters[3][1]?.(params);
    }
  };

  const call: Carrier<Params> = (params, config) => {
    try {
      const match = config[2]?.(call);
      awaiter(() => exec(params, match ? config[1] : void 0));
    } catch {}
  };

  propagate(call);

  const action = (input: Input) => {
    const config = [] as unknown as [
      Resolve<Result | PromiseLike<Result>>,
      Reject,
    ];
    const promise = new Promise((resolve, reject) => {
      config[0] = resolve;
      config[1] = reject;
    });
    promise.catch(() => void 0);
    start(input, [[], config, (carrier) => carrier === call]);
    return promise;
  };

  return Object.assign(action, {
    ...createMethods(emitters[0]),
    done: createMethods(emitters[1]),
    fail: createMethods(emitters[2]),
    end: createMethods(emitters[3]),
  }) as Task<Input, Params, Result>;
};

const createMethods = <Input, Output>(
  emitter: Emitter,
  start?: Carrier<Input>,
  next?: Carrier<Output>[],
) => {
  return !start || !next
    ? { watch: subscriber(emitter) }
    : {
        watch: subscriber(emitter),
        map: <Selected>(cmd: (input: Output) => Promise<Selected> | Selected) =>
          createAction(start, pusher(next), cmd),
        filter: (cmd: (input: Output) => Promise<boolean> | boolean) =>
          createAction(start, pusher(next), void 0, cmd),
        task: <Result>(cmd: (input: Output) => Promise<Result> | Result) =>
          //@ts-expect-error
          createTask<Input, Output, Result>(start, pusher(next), cmd),
      };
};
