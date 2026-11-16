import { Disposer } from "./types.js";

export type Return<R> = [(r: R) => void, (e: Error) => void];
export type Queue = [head: number, ...items: (() => void)[]];

export type Config =
  | [
      1 | 2,
      undefined | ((params: any) => Promise<any> | any),
      null | Subscriber,
      null | Watcher,
      null | Set<Promise<any>>,
      ...Config[],
    ]
  | [
      0,
      undefined | ((params: any) => Promise<any> | any),
      null | Subscriber,
      null | Watcher,
      null | Set<Promise<any>>,
      ...(Subscriber | Watcher)[],
    ];

export type Watcher = (...args: any[]) => void;
type Subscriber = (watcher: Watcher, debug?: boolean) => Disposer;
export type Emitter = [Subscriber | void, Watcher | void] | [];

const resolver = <T>(
  param: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
) => (param instanceof Promise ? param.then(done).catch(fail) : done(param));

export const subscriber = (emitter: Config | Emitter, key = 0) => ({
  watch:
    emitter[key] ??
    ((...args: [Watcher, boolean]) => {
      if (!emitter[key]) {
        let listeners: Set<Watcher>;
        let loggers: Set<Watcher>;

        emitter[key] = (watcher: Watcher, debug?: boolean) => {
          const set = debug
            ? (loggers = loggers ?? new Set()) && loggers
            : (listeners = listeners ?? new Set()) && listeners;
          set.add(watcher);
          return () => set.delete(watcher);
        };

        emitter[key + 1] = (...args: any[]) => {
          loggers?.forEach((watcher) => watcher(...args));
          listeners?.forEach((watcher) => watcher(...args));
        };
      }

      return (emitter[key] as Subscriber)(...args);
    }),
});

export const invoke = <Input>(
  input: Input,
  queue: Queue,
  config: Config,
  match?: Config,
  ret?: Return<any>,
) => {
  const catcher = (error?: Error) => {
    let err = error ?? new Error();
    err.name = error ? "ChainError" : "ChainFilter";
    ret?.[1](err);
  };

  try {
    const [type, fn, , em, , ...rest] = config;

    return !type && fn
      ? Promise.resolve().then(async () => {
          const promise = fn(input);

          (em as Watcher)?.(input);
          const unique = !(
            promise instanceof Promise && config[4]?.has(promise)
          );
          unique &&
            (config[4] = config[4] ?? new Set()) &&
            config[4].add(promise as Promise<any>);

          try {
            const result = await promise;
            unique && (rest[1] as Watcher)?.(result, input);
            match === config && ret?.[0](result);
          } catch (error) {
            unique && (rest[3] as Watcher)?.(error, input);
            match === config && ret?.[1](error as Error);
          } finally {
            unique && (rest[5] as Watcher)?.(input);
            config[4]?.delete(promise);
          }
        })
      : resolver(
          fn ? fn(input) : input,
          (result) => {
            if (type === 2 && !result) return catcher();
            em?.(type === 2 ? input : result);
            rest?.forEach((cfg) =>
              queue.push(() =>
                invoke(
                  type === 2 ? input : result,
                  queue,
                  cfg as Config,
                  match,
                  ret,
                ),
              ),
            );
            rest?.forEach(() => (queue[queue[0]++] as () => void)());
          },
          catcher,
        );
  } catch (err) {
    catcher(err as Error);
  }
};
