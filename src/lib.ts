export type External = [(result: unknown) => void, (error: Error) => void];
export type Queue = [head: number, ...configs: (() => void)[]];

export type Config = [
  undefined | number,
  undefined | (<T>(params: T) => Promise<T> | T),
  null | Emitter,
  ...(Config | Emitter | Set<Promise<unknown>>)[],
];

export type Watcher = (...args: unknown[]) => void;
export interface Emitter extends Watcher {
  l: Set<Watcher>;
}

const resolver = <T>(
  payload: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
  end?: () => void,
) => {
  try {
    ((end ?? payload instanceof Promise)
      ? Promise.resolve(payload)
      : done(payload)
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
      const watchers = new Set<Watcher>();
      emitter[key] = function (this: unknown, ...args: unknown[]) {
        watchers.forEach((watcher) => watcher.call(this, ...args));
      } as Emitter;
      (emitter[key] as Emitter).l = watchers;
    }
    (emitter[key] as Emitter).l.add(fn);
    return () => {
      (emitter[key] as Emitter).l.delete(fn);
    };
  },
});

export const invoke = (
  payload: unknown,
  queue: Queue,
  config: Config,
  init?: Config,
  external?: External,
  aborted?: number | boolean,
) => {
  const [type, fn, emt, ...rest] = config;

  const forward = (out: unknown, aborted?: number | boolean) => {
    (rest as Config[]).forEach((config) =>
      queue.push(() => invoke(out, queue, config, init, external, aborted)),
    );
    rest.forEach(() => (queue[queue[0]++] as () => void)());
  };

  aborted
    ? type === 2
      ? init === config && external?.[1](payload as Error)
      : forward(payload, aborted)
    : type === 2
      ? (() => {
          const response = (fn as Function)(payload);
          (emt as Emitter)?.(payload);
          if (!(
            response instanceof Promise &&
            (config[3] as Set<Promise<unknown>>)?.has(response)
          )) {
            (config[3] = config[3] ?? new Set()) &&
              (config[3] as Set<Promise<unknown>>).add(response);
            resolver(
              response,
              (result) => (rest[1] as Emitter)?.(result, payload),
              (error) => (rest[2] as Emitter)?.(error, payload),
              () => {
                (rest[3] as Emitter)?.(payload);
                (config[3] as Set<Promise<unknown>>)?.delete(response);
              },
            );
          }
          init === config &&
            external &&
            resolver(response, ...external, () => {});
        })()
      : resolver(
          fn ? fn(payload) : payload,
          (result) =>
            type && !result
              ? forward(Object.assign(new Error(), { name: "ChainFilter" }), 1)
              : (emt?.(type ? payload : result) || 1) &&
                forward(type ? payload : result),
          (error) => forward(error, 1),
        );
};
