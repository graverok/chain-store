import { Disposer } from "./types.js";

export type Return<R> = [(r: R) => void, (e: Error) => void];
export type Queue = [head: number, ...items: (() => void)[]];

export type Config = [
  undefined | number,
  undefined | ((params: any) => Promise<any> | any),
  null | Subscriber,
  null | Watcher,
  null | Set<Promise<any>>,
  ...(Config | Watcher | Subscriber)[],
];

export type Watcher = (...args: any[]) => void;
type Subscriber = (watcher: Watcher, debug?: boolean) => Disposer;
export type Emitter = [Subscriber | undefined, Watcher | undefined] | [];

const resolver = <T>(
  param: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
) => (param instanceof Promise ? param.then(done).catch(fail) : done(param));

export const subscriber = (emitter: Config | Emitter, key = 0) => ({
  watch:
    emitter[key] ??
    ((watcher: Watcher) => {
      if (!emitter[key]) {
        let listeners: Set<Watcher>;

        emitter[key] = (watcher: Watcher) => {
          (listeners = listeners ?? new Set()).add(watcher);
          return () => listeners.delete(watcher);
        };

        emitter[key + 1] = function (...args: any[]) {
          listeners?.forEach((watcher) => watcher.call(this, ...args));
        };
      }

      return (emitter[key] as Subscriber)(watcher);
    }),
});

export const invoke = <Input>(
  input: Input,
  queue: Queue,
  config: Config,
  caller?: Config,
  ret?: Return<any>,
) => {
  const catcher = (error?: Error) => {
    let err = error ?? new Error();
    err.name = error ? "ChainError" : "ChainFilter";
    ret?.[1](err);
  };

  try {
    const [type, fn, , emt, , ...rest] = config;

    return type === 2
      ? Promise.resolve().then(async () => {
          const result = (fn as Function)(input);

          const unique = !(result instanceof Promise && config[4]?.has(result));
          unique &&
            (config[4] = config[4] ?? new Set()) &&
            config[4].add(result as Promise<any>);

          try {
            (emt as Watcher)?.(input);
            const out = await result;
            unique && (rest[1] as Watcher)?.(out, input);
            caller === config && ret?.[0](out);
          } catch (error) {
            unique && (rest[3] as Watcher)?.(error, input);
            caller === config && ret?.[1](error as Error);
          } finally {
            unique && (rest[5] as Watcher)?.(input);
            config[4]?.delete(result);
          }
        })
      : resolver(
          fn ? fn(input) : input,
          (result) => {
            if (type && !result) return catcher();
            const out = type ? input : result;
            emt?.(out);
            (rest as Config[]).forEach((config) =>
              queue.push(() => invoke(out, queue, config, caller, ret)),
            );
            rest.forEach(() => (queue[queue[0]++] as () => void)());
          },
          catcher,
        );
  } catch (err) {
    catcher(err as Error);
  }
};
