export type Return<R> = [(r: R) => void, (e: Error) => void];
export type Queue = [head: number, ...items: (() => void)[]];

export type Config = [
  undefined | number,
  undefined | ((params: any) => Promise<any> | any),
  null | Emitter,
  null | Set<Promise<any>>,
  ...(Config | Emitter)[],
];

export type Watcher = (...args: any[]) => void;
export interface Emitter extends Watcher {
  l: Set<Watcher>;
}

const resolver = <T>(
  param: Promise<T> | T,
  done: (v: T) => void,
  fail: (e: Error) => void,
) => (param instanceof Promise ? param.then(done).catch(fail) : done(param));

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
    const [type, fn, emt, , ...rest] = config;

    return type === 2
      ? Promise.resolve().then(async () => {
          const result = (fn as Function)(input);

          const unique = !(result instanceof Promise && config[3]?.has(result));
          unique &&
            (config[3] = config[3] ?? new Set()) &&
            config[3].add(result as Promise<any>);

          try {
            (emt as Emitter)?.(input);
            const out = await result;
            unique && (rest[0] as Emitter)?.(out, input);
            caller === config && ret?.[0](out);
          } catch (error) {
            unique && (rest[1] as Emitter)?.(error, input);
            caller === config && ret?.[1](error as Error);
          } finally {
            unique && (rest[2] as Emitter)?.(input);
            config[3]?.delete(result);
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
