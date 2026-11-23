import { invoke, subscriber, type Config, type External } from "./lib.js";
import { Action, Task } from "./types.js";

const create = <Input = void, Output = Input>(
  type?: number,
  fn?: (params: any) => Promise<any> | any,
  start?: Config,
  prev?: Config,
) => {
  const config: Config = [type, fn, null];
  prev?.push(config);

  return Object.assign(
    (input: Input) => {
      let external: External | undefined = void 0;
      let promise: Promise<unknown> | undefined = void 0;
      if (type === 2) {
        promise = new Promise<unknown>((...args) => {
          external = args;
        });
        promise.catch(() => {});
      }
      invoke(input, [1], start ?? config, config, external);
      return promise;
    },
    subscriber(config, 2),
    type !== 2
      ? {
          map: <Result>(fn: (params: Output) => Promise<Result> | Result) =>
            create<Input, Result>(0, fn, start ?? config, config) as Action<
              Input,
              Output
            >,
          filter: (fn: (params: Output) => Promise<boolean> | boolean) =>
            create<Input, Output>(1, fn, start ?? config, config) as Action<
              Input,
              Output
            >,
          task: <Result>(fn: (params: Output) => Promise<Result> | Result) =>
            create<Input, Result>(2, fn, start ?? config, config) as Task<
              Input,
              Output,
              Result
            >,
        }
      : {
          done: subscriber(config, 4),
          fail: subscriber(config, 5),
          end: subscriber(config, 6),
        },
  );
};

export const chain = <Input = void>() =>
  create<Input, Input>() as Action<Input, Input>;
