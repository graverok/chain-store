export const sync = (...args) => {
  if (args.length === 0) return () => void 0;
  try {
    const stores = Object.entries(args.splice(0, 1)[0] ?? {}).filter(
      ([_, unit]) =>
        typeof unit.get === "function" && typeof unit.set === "function",
    );
    let i = args.findIndex((p) => typeof p === "string");
    const scope = i === -1 ? "" : args.splice(i, 1)[0];

    if (!stores.length) return;
    const deps = args.splice(0, 1)[0];
    const match =
      args.splice(0, 1)[0] ??
      ((a, b) =>
        Array.isArray(a) && Array.isArray(b)
          ? Boolean(a.every((n, i) => n === b[i]))
          : a === b);

    const channel = new BroadcastChannel(`__CHAIN_STORE__` + scope);
    const disposers = [];

    stores.forEach(([key, $store], i) => {
      const subscribe = () =>
        (disposers[i] = $store?.watch((state) =>
          channel.postMessage({ key, state, deps: deps?.() }),
        ));
      subscribe(key, i);
      channel.addEventListener("message", ({ data }) => {
        if (data.key !== key) return;
        if (data.deps && deps && !match(deps(), data.deps)) return;
        disposers[i]?.();
        $store.set(data.state);
        subscribe();
      });
    });

    disposers.push(channel.close);
    return () => disposers.forEach((d) => d());
  } catch {
    return () => void 0;
  }
};
