import { Action, Task } from "./types";
import {
  awaiter,
  catcher,
  pusher,
  resolver,
  splicer,
  subscriber,
  type Emitter,
  type Carrier,
  type Queue,
  type Return,
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

  const exec: Carrier<Output, void> = (...args) => {
    emitter[1]?.(args[0]);
    next.forEach((call) => args[1].push(() => call(...args)));
    next.forEach(() => args[1].shift()!());
  };

  const call: Carrier<Input | Output> = (params, queue, match) => {
    try {
      return resolver(
        filter?.(params) ?? map?.(params) ?? params,
        (res) =>
          filter
            ? res
              ? exec(params as Output, queue, match)
              : catcher(match)()
            : exec(res as Output, queue, match),
        catcher(match),
      );
    } catch (err) {
      catcher(match)(err as Error);
    }
  };

  propagate?.(call);

  const action = (input: Input) => {
    (start ?? call)(input, [] as Queue);
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
  const em = [] as Emitter;
  const ed = [] as Emitter;
  const ef = [] as Emitter;
  const ee = [] as Emitter;
  const pending: Promise<Result>[] = [];

  const exec = async (params: Params, ret?: Return<Result>) => {
    const promise = task(params);

    if (!(promise instanceof Promise)) {
      em[1]?.(params);
      return awaiter(() => {
        ed[1]?.(promise, params);
        ret?.[0](promise);
      });
    }

    const duplicate = pending.includes(promise);
    !duplicate && pending.push(promise);
    !duplicate && em[1]?.(params);

    try {
      const result = await promise;
      !duplicate && ed[1]?.(result, params);
      ret?.[0](result);
    } catch (error) {
      !duplicate && ef[1]?.(error, params);
      ret?.[1](error as Error);
    } finally {
      duplicate ? awaiter(() => splicer(pending, promise)) : ee[1]?.(params);
    }
  };

  const call: Carrier<Params, Result> = (params, _, match) => {
    try {
      awaiter(() => exec(params, match?.(call)));
    } catch {}
  };

  propagate(call);

  const action = (input: Input) => {
    const ret = [] as unknown as Return<Result>;
    const promise = new Promise((resolve, reject) => ret.push(resolve, reject));
    promise.catch(() => void 0);
    start(input, [], (carrier) =>
      !carrier || carrier === call ? ret : void 0,
    );
    return promise;
  };

  return Object.assign(action, {
    ...createMethods(em),
    done: createMethods(ed),
    fail: createMethods(ef),
    end: createMethods(ee),
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
