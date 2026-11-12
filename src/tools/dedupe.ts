const strict = <Params>(a: Params, b: Params) => a === b;

export const dedupe = <Result, Params>(
  request: (params: Params) => Promise<Result>,
  compare = strict<Params>,
) => {
  const stored: [Promise<Result>, Params][] = [];

  return (params: Params) => {
    const current = stored.find(([_, p]) => compare(params, p));
    if (current) return current[0];

    const res = request(params);
    if (!(res instanceof Promise)) return res;

    stored.push([res, params]);

    res
      .catch(() => void 0)
      .finally(() => {
        const index = stored.findIndex(([pr]) => pr === res);
        index >= 0 && stored.splice(index, 1);
      });

    return res;
  };
};
