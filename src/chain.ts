import { Action, Task } from "./types";
import {
  resolver,
  subscriber,
  type Emitter,
  type Carrier,
  type Return,
  type Command,
} from "./lib";

export const chain = <Input = void>() => createAction<Input, Input>();

const createAction = <Input = void, Output = Input>(
  start?: Carrier<Input>,
  prev?: Command[],
  cmd?: (params: any) => Promise<any> | any,
  type?: number,
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
        const [task, emitter, next, fn, type] = command;

        return task
          ? Promise.resolve().then(() =>
              task(params, match === task ? ret : void 0),
            )
          : resolver(
              fn ? fn(params) : params,
              (res) => {
                if (type && !res) return catcher();

                const out = type ? params : res;
                emitter?.[1]?.(out);

                next?.forEach((cmd) =>
                  queue.push(() => invoke(out, queue, match, ret, cmd)),
                );
                next?.forEach(() => (queue[queue[0]++] as () => void)());
              },
              catcher,
            );
      } catch (err) {
        catcher(err as Error);
      }
    });

  prev?.push([void 0, emitter, next, cmd, type]);

  return Object.assign(
    (input: Input) => invoke(input, [1]),
    subscriber(emitter),
    {
      map: <Result>(map: (params: Output) => Promise<Result> | Result) =>
        createAction<Input, Result>(invoke, next, map),
      filter: (filter: (params: Output) => Promise<boolean> | boolean) =>
        createAction<Input, Output>(invoke, next, filter, 1),
      task: <Result>(task: (params: Output) => Promise<Result> | Result) =>
        createTask<Input, Output, Result>(invoke, next, task),
    },
  ) as Action<Input, Output>;
};

const createTask = <Input, Params, Result>(
  start: Carrier<Input>,
  prev: Command[],
  task: (params: Params) => Promise<Result> | Result,
) => {
  const em = [] as Emitter;
  const ed = [] as Emitter;
  const ef = [] as Emitter;
  const ee = [] as Emitter;
  let pending: Set<Promise<Result>>;

  const exec = async (params: Params, ret?: Return<Result>) => {
    const promise = task(params);

    em[1]?.(params);
    const duplicate = promise instanceof Promise && pending?.has(promise);
    !duplicate &&
      promise instanceof Promise &&
      (pending = pending ?? new Set()) &&
      pending.add(promise as Promise<Result>);

    try {
      const result = await promise;
      !duplicate && ed[1]?.(result, params);
      ret?.[0](result);
    } catch (error) {
      !duplicate && ef[1]?.(error, params);
      ret?.[1](error as Error);
    } finally {
      duplicate ? pending.delete(promise) : ee[1]?.(params);
    }
  };

  prev.push([exec]);

  return Object.assign(
    (input: Input) => {
      const ret = [] as unknown as Return<Result>;
      const promise = new Promise((...args) => ret.push(...args));
      promise.catch(() => {});
      start(input, [1], exec, ret);
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
