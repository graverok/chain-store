import { Disposer } from "./types";

export type Return<R> = [(r: R) => void, (e: Error) => void];
export type Queue = [head: number, ...items: (() => void)[]];
export type Carrier<P = any> = (
  params: P,
  queue: Queue,
  match?: (params: any, ret?: Return<any>) => void,
  ret?: Return<any>,
  cmd?: Command,
) => void;

export type Command =
  | [(params: any, ret?: Return<any>) => void]
  | [void, Emitter, Command[]]
  | [
      void,
      Emitter,
      Command[],
      void | ((params: any) => Promise<any> | any),
      void | number,
    ];

export type Watcher = (...args: any[]) => void;
type Subscriber = (watcher: Watcher, debug?: boolean) => Disposer;
export type Emitter = [Subscriber | void, Watcher | void] | [];

export const resolver = <T>(
  param: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
) => (param instanceof Promise ? param.then(done).catch(fail) : done(param));

export const subscriber = (emitter: Emitter) => ({
  watch:
    emitter[0] ??
    ((...args) => {
      if (!emitter[0]) {
        let listeners: Set<Watcher>;
        let loggers: Set<Watcher>;

        emitter.push(
          //@ts-expect-error
          (watcher: Watcher, debug?: boolean) => {
            const set = debug
              ? (loggers = loggers ?? new Set()) && loggers
              : (listeners = listeners ?? new Set()) && listeners;
            set.add(watcher);
            return () => set.delete(watcher);
          },
          (...args: any[]) => {
            loggers?.forEach((watcher) => watcher(...args));
            listeners?.forEach((watcher) => watcher(...args));
          },
        );
      }

      return (emitter[0] as Subscriber)(...args);
    }),
});
