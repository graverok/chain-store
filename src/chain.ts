import { Action, Task } from "./types";
import {
  awaiter,
  pusher,
  resolver,
  splicer,
  subscriber,
  type Emitter,
  type Carrier,
  type Queue,
  type Return,
  type Command,
} from "./lib";

export const chain = <Input = void>() => createAction<Input, Input>();

const createAction = <Input = void, Output = Input>(
  start?: Carrier<Input>,
  propagate?: (cmd: Command) => void,
  map?: (params: any) => Promise<Output> | Output,
  filter?: (params: any) => Promise<boolean> | boolean,
) => {
  const emitter = [] as unknown as Emitter;
  const next: Command[] = [];

  const invoke: Carrier<Input> =
    start ??
    ((params, queue, match, ret, command = [void 0, emitter, next]) => {
      const catcher = (error?: Error) => {
        let err = error ?? new Error();
        err.name = error ? "ChainError" : "ChainFilter";
        ret?.[1](err);
      };

      try {
        const [task, emitter, next, map, filter] = command;
        if (task)
          return awaiter(() => task(params, match === task ? ret : void 0));

        return resolver(
          filter?.(params) ?? map?.(params) ?? params,
          (res) => {
            if (filter && !res) return catcher();
            const out = filter ? params : res;

            emitter?.[1]?.(out);
            next?.forEach((cm) =>
              queue.push(() =>
                invoke(out as unknown as Input, queue, match, ret, cm),
              ),
            );
            next?.forEach(() => queue.shift()!());
          },
          catcher,
        );
      } catch (err) {
        catcher(err as Error);
      }
    });

  propagate?.([void 0, emitter, next, map, filter]);

  return Object.assign(
    (input: Input) => invoke(input, [] as Queue),
    subscriber(emitter),
    {
      map: <Result>(map: (params: Output) => Promise<Result> | Result) =>
        createAction<Input, Result>(invoke, pusher(next), map),
      filter: (filter: (params: Output) => Promise<boolean> | boolean) =>
        createAction<Input, Output>(invoke, pusher(next), void 0, filter),
      task: <Result>(task: (params: Output) => Promise<Result> | Result) =>
        createTask<Input, Output, Result>(invoke, pusher(next), task),
    },
  ) as Action<Input, Output>;
};

const createTask = <Input, Params, Result>(
  start: Carrier<Input>,
  propagate: (cmd: Command) => void,
  task: (params: Params) => Promise<Result> | Result,
) => {
  const em = [] as Emitter;
  const ed = [] as Emitter;
  const ef = [] as Emitter;
  const ee = [] as Emitter;
  const pending: Promise<Result>[] = [];

  const exec = async (params: Params, ret?: Return<Result>) => {
    const promise = task(params);

    em[1]?.(params);
    const duplicate = promise instanceof Promise && pending.includes(promise);
    !duplicate && pending.push(promise as Promise<Result>);

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

  propagate([exec]);

  return Object.assign(
    (input: Input) => {
      const ret = [] as unknown as Return<Result>;
      const promise = new Promise(pusher(ret));
      promise.catch(() => void 0);
      start(input, [], exec, ret);
      return promise;
    },
    subscriber(em),
    {
      done: subscriber(ed),
      fail: subscriber(ef),
      end: subscriber(ee),
    },
  ) as Task<Input, Params, Result>;
};
