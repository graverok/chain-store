export type Return<R> = [(r: R) => void, (e: Error) => void];
export type Queue = [head: number, ...items: (() => void)[]];

export type Config = [
  undefined | number,
  undefined | ((params: any) => Promise<any> | any),
  null | Emitter,
  ...(Config | Emitter | Set<Promise<any>>)[],
];

export type Watcher = (...args: any[]) => void;
export interface Emitter extends Watcher {
  l: Set<Watcher>;
}

const resolver = <T>(
  param: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
  end?: () => void,
) => {
  try {
    (param instanceof Promise
      ? param
      : end
        ? Promise.resolve(param)
        : done(param)
    )
      ?.then(done, fail)
      .finally(end);
  } catch (err) {
    fail(err as Error);
  }
};

export const subscriber = (emitter: Config | Emitter[], key = 0) => ({
  watch: (fn: Watcher) => {
    if (!emitter[key]) {
      const listeners = new Set<Watcher>();
      emitter[key] = function (...args: any[]) {
        listeners.forEach((watcher) => watcher.call(this, ...args));
      };
      (emitter[key] as Emitter).l = listeners;
    }
    (emitter[key] as Emitter).l.add(fn);
    return () => {
      (emitter[key] as Emitter).l.delete(fn);
    };
  },
});

export const invoke = (
  input: any,
  queue: Queue,
  config: Config,
  caller?: Config,
  ret?: Return<any>,
  error?: Error | undefined,
) => {
  const [type, fn, emt, ...rest] = config;

  const blocker = (error: Error) => (error.name = "ChainFilter") && error;

  const forward = (out: any, err?: Error | undefined) => {
    if (type === 2) return caller === config && ret?.[1](err as Error);
    (rest as Config[])?.forEach((config) =>
      queue.push(() => invoke(out, queue, config, caller, ret, err)),
    );
    rest?.forEach(() => (queue[queue[0]++] as () => void)());
  };

  return error
    ? forward(input, error)
    : type === 2
      ? (() => {
          (emt as Emitter)?.(input);

          const result = (fn as Function)(input);

          if (!(
            result instanceof Promise &&
            (config[3] as Set<Promise<unknown>>)?.has(result)
          )) {
            (config[3] = config[3] ?? new Set()) &&
              (config[3] as Set<Promise<unknown>>).add(
                result as Promise<unknown>,
              );

            resolver(
              result,
              (out) => (rest[1] as Emitter)?.(out, input),
              (error) => (rest[2] as Emitter)?.(error, input),
              () => {
                (rest[3] as Emitter)?.(input);
                (config[3] as Set<Promise<unknown>>)?.delete(result);
              },
            );
          }
          caller === config && ret && resolver(result, ...ret, () => {});
        })()
      : resolver(
          fn ? fn(input) : input,
          (result) =>
            type && !result
              ? forward(input, blocker(new Error()))
              : (emt?.(type ? input : result) || 1) &&
                forward(type ? input : result),
          (err) => forward(input, err),
        );
};
