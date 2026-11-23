export const throttle = <Params, Result>(
  delay: number,
  fn: (params: Params) => Result,
) => {
  let resolve: void | ((result: Result) => void);
  let reject: void | ((error: Error) => void);
  let stored: Params;
  let tmr: number;

  return (params: Params) => {
    if (tmr) {
      reject?.(Object.assign(new Error(), { name: "ChainFilter" }));
      stored = params;
      return new Promise<Result>((res, rej) => {
        resolve = res;
        reject = rej;
      });
    }

    tmr = setTimeout(() => {
      resolve?.(fn(stored as Params));
      resolve = undefined;
      reject = undefined;
      tmr = 0;
    }, delay) as unknown as number;

    return fn(params);
  };
};
