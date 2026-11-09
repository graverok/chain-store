import { Disposer } from "./types";

export type Return<R> = [(r: R) => void, (e: Error) => void];
export type Queue = (() => void)[];
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
      void | ((params: any) => Promise<boolean> | boolean),
    ];

export type Watcher = (...args: any[]) => void;
export type Emitter =
  [((watcher: Watcher) => Disposer) | void, Watcher | void] | [];

export const resolver = <T>(
  param: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
) => {
  if (param instanceof Promise) {
    param.then(done).catch(fail);
  } else {
    done(param);
  }
};

export const pusher =
  <U>(arr: U[]) =>
  (...a: U[]) =>
    arr.push(...a);

export const splicer = <U = unknown>(
  arr: U[],
  a?: U,
  compare?: (b: U) => boolean,
) => {
  const index = compare ? arr.findIndex(compare) : arr.indexOf(a as U);
  return index >= 0 ? arr.splice(index, 1)[0] : void 0;
};

export const awaiter = (fn: () => void) =>
  Promise.resolve()
    .then(fn)
    .catch(() => {});

export const subscriber = (emitter: Emitter) =>
  emitter[0] ??
  ((...args) => {
    const subscribers: Watcher[][] = [[], []];

    emitter.push(
      //@ts-expect-error
      (watcher: Watcher, i = 1) => {
        !subscribers[i].includes(watcher) && subscribers[i].push(watcher);
        return () => {
          splicer(subscribers[i], watcher);
        };
      },
      (...args: any[]) => {
        subscribers.forEach((watchers) =>
          watchers.forEach((watcher) => watcher(...args)),
        );
      },
    );

    //@ts-expect-error
    return emitter[0](...args);
  });
