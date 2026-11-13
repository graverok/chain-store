export const throttle = <Params, Result>(
  delay: number,
  fn: (params: Params) => Result,
) => {
  let tmr: number = 0;
  let resolve: null | ((result: Result) => void) = null;
  let reject: null | (() => void) = null;
  let stored: Params | null = null;

  return (params: Params) => {
    if (!tmr) {
      tmr = setTimeout(() => {
        resolve?.(fn(stored as Params));
        resolve = null;
        reject = null;
        tmr = 0;
      }, delay) as unknown as number;
      return fn(params);
    } else {
      reject?.();
      stored = params;
      return new Promise<Result>((res, rej) => {
        resolve = res;
        reject = rej;
      });
    }

    return new Promise<Result>((resolve, rej) => {
      reject = rej;
      tmr = setTimeout(() => {
        resolve(fn(params));
      }, delay) as unknown as number;
    });
  };
};
