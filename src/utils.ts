import { Action, Target, Command, Disposer } from "./types";

export type Args<Params> = Params extends Array<unknown> ? Params : [Params];

export type Match<R = any> = (
  carrier?: Carrier,
) => ((respondent: () => R) => void) | void;

export type Queue = VoidFunction[];
export type Carrier<P = any, R = any> = (
  params: P,
  config: [Queue, Match<R> | void],
) => void;

export type Call<Params, Result extends unknown = void> = (
  params: Params,
) => Result;

export type Commands<Input, Output> = {
  filter: <Fn extends Command<Output, boolean>>(
    fn: Fn,
  ) => Action<
    Input,
    ReturnType<Fn> extends Promise<boolean> ? Promise<Awaited<Output>> : Output
  >;
  map: <Mapped, Fn extends Command<Output, Mapped>>(
    fn: Fn,
  ) => Action<
    Input,
    Output extends Promise<unknown>
      ? Promise<Awaited<ReturnType<Fn>>>
      : ReturnType<Fn>
  >;
  target: <Result, Err = Error>(
    fn: Command<Output, Result>,
  ) => Target<Input, Output, Result, Err>;
};

export type Emitter = [
  ((watcher: (...args: any[]) => void) => Disposer) | void,
  ((...args: any[]) => void) | void,
];

export const caller =
  <P>(...args: Parameters<Carrier<P>>) =>
  (next: Carrier<P>[]) => {
    const queue = args[1][0];
    next.forEach((call) => queue.push(() => call(...args)));
    next.forEach(() => queue.shift()!());
  };

export const resolver = <P, R>(
  param: P,
  fn: (param: P) => R | Promise<R>,
  resolve: (r: R) => void,
  reject: (err: Error) => void,
) => {
  const res = fn(param);
  if (!(res instanceof Promise)) return resolve(res);
  res.then(resolve).catch(reject);
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

export const waiter = (fn: VoidFunction) =>
  Promise.resolve()
    .then(fn)
    .catch(() => {});

export const subscriber =
  (emitter: Emitter) =>
  (callback: (...args: any[]) => void): Disposer => {
    if (emitter[0]) return emitter[0](callback);

    const subscribers: ((...args: any[]) => void)[] = [];

    const subscribe = (watcher: (...args: any[]) => void) =>
      !subscribers.includes(watcher) && subscribers.push(watcher);

    emitter[0] = (watcher: (...args: any[]) => void) => {
      subscribe(watcher);
      return () => {
        splicer(subscribers, watcher);
      };
    };

    emitter[1] = (...args: any[]) =>
      subscribers.forEach((watcher) => watcher(...args));

    return emitter[0](callback);
  };

export const evaluate = <Result, Err = Error>(sync?: boolean) => {
  const stored: (() => Result)[] | [(r: Result) => void, (e: Err) => void] = [];

  return [
    () =>
      sync
        ? stored.length
          ? (stored[0]() as Result)
          : //@ts-expect-error
            new Promise<Result>((r, f) => stored.push(r, f))
        : new Promise<Result>((r, f) => {
            if (stored.length) {
              try {
                return r(stored[0]() as Result);
              } catch (err) {
                f(err);
              }
              return;
            }
            //@ts-expect-error
            stored.push(r, f);
          }),
    (res: () => Result) => {
      if (!stored.length) return stored.push(res); /* init() -> val() */
      try {
        (stored[0] as (r: Result) => void)(res());
      } catch (err) {
        (stored[1] as (e: Err) => void)?.(err as Err);
      }
    },
  ];
};
