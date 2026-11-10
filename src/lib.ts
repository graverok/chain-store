import { Disposer } from "./types";

export type Return<R> = [(r: R) => void, (e: Error) => void];
export type Match<R> = (carrier?: Carrier) => Return<R> | undefined;
export type Queue = (() => void)[];
export type Carrier<P = any, R = any> = (
  params: P,
  queue: Queue,
  match: Match<R> | void,
) => void;

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

export const catcher = (match?: Match<any> | void) => (error?: Error) => {
  let err = error ?? new Error();
  err.name = error ? "ChainError" : "ChainFilter";
  match?.()?.[1](err);
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

export type Watcher = (...args: any[]) => void;
export type Emitter =
  [((watcher: Watcher) => Disposer) | void, Watcher | void] | [];

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
