export const debounce = <Params, Result>(
  delay: number,
  fn: (params: Params) => Result,
) => {
  let tmr: number = 0;
  let reject: null | (() => void) = null;

  return (params: Params) => {
    tmr && clearTimeout(tmr);
    reject?.();

    return new Promise<Result>((resolve, rej) => {
      reject = rej;
      tmr = setTimeout(() => {
        resolve(fn(params));
      }, delay) as unknown as number;
    });
  };
};
