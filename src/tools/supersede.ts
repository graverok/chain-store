export const supersede = <Result, Params>(
  request: (params: Params, init: { signal: AbortSignal }) => Promise<Result>,
) => {
  let abortController: AbortController | undefined;
  return (params: Params) => {
    abortController?.abort();
    abortController = new AbortController();

    const res = request(params, { signal: abortController.signal });

    if (!(res instanceof Promise)) {
      abortController = void 0;
      return res;
    }

    res
      .then(() => {
        abortController = void 0;
      })
      .catch(() => void 0);

    return res;
  };
};
