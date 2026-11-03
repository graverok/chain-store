import { Disposer } from "./types";

export type Resolve<R> = (r: R) => void;
export type Reject = (e: Error) => void;
export type Match = (carrier?: Carrier) => boolean;
export type Queue = (() => void)[];
export type Carrier<P = any, R = any> = (
  params: P,
  config: [Queue, [Resolve<R>, Reject] | void, Match | void],
) => void;

export const caller =
  <P>(...args: Parameters<Carrier<P>>) =>
  (next: Carrier<P>[]) => {
    const queue = args[1][0];
    next.forEach((call) => queue.push(() => call(...args)));
    next.forEach(() => queue.shift()!());
  };

export const resolver = <T>(
  param: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
) => {
  if (param instanceof Promise) {
    param.then(done).catch(fail);
    return;
  }
  return done(param);
};

export const pusher =
  <U>(arr: U[]) =>
  (a: U) =>
    arr.push(a);

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
export type Emitter = [((watcher: Watcher) => Disposer) | void, Watcher | void];

export const subscriber =
  (emitter: Emitter) =>
  (callback: Watcher): Disposer => {
    if (emitter[0]) return emitter[0](callback);

    const subscribers: Watcher[] = [];

    const subscribe = (watcher: Watcher) =>
      !subscribers.includes(watcher) && subscribers.push(watcher);

    emitter[0] = (watcher: Watcher) => {
      subscribe(watcher);
      return () => {
        splicer(subscribers, watcher);
      };
    };

    emitter[1] = (...args: any[]) =>
      subscribers.forEach((watcher) => watcher(...args));

    return emitter[0](callback);
  };
