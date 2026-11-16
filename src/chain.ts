import { invoke, subscriber, type Config, type Return } from "./lib";
import { Action, Task } from "./types";

const create = <Input = void, Output = Input>(
  type: 0 | 1 | 2,
  fn?: (params: any) => Promise<any> | any,
  start?: Config,
  prev?: Config,
) => {
  const config: Config = [type, fn, null, null, null];
  //@ts-expect-error
  prev?.push(config);

  return Object.assign(
    (input: Input) => {
      let ret: Return<Output> | undefined = void 0;
      let promise: Promise<Output> | undefined = void 0;
      if (!type) {
        promise = new Promise(
          (...args) =>
            (ret = [] as unknown as Return<Output>) && ret.push(...args),
        );
        promise.catch(() => {});
      }
      invoke(input, [1], start ?? config, config, ret);
      return promise;
    },
    subscriber(config, 2),
    type
      ? {
          map: <Result>(fn: (params: Output) => Promise<Result> | Result) =>
            create<Input, Result>(1, fn, start ?? config, config) as Action<
              Input,
              Output
            >,
          filter: (fn: (params: Output) => Promise<boolean> | boolean) =>
            create<Input, Output>(2, fn, start ?? config, config) as Action<
              Input,
              Output
            >,
          task: <Result>(fn: (params: Output) => Promise<Result> | Result) =>
            create<Input, Result>(0, fn, start ?? config, config) as Task<
              Input,
              Output,
              Result
            >,
        }
      : {
          done: subscriber(config, 5),
          fail: subscriber(config, 7),
          end: subscriber(config, 9),
        },
  );
};

export const chain = <Input = void>() =>
  create<Input, Input>(1) as Action<Input, Input>;
