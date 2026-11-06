export const log =
  process.env.NODE_ENV !== "production" &&
  typeof window !== "undefined" &&
  window.__REDUX_DEVTOOLS_EXTENSION__
    ? function (...args) {
        if (args.length === 0) return;
        let i = args.findIndex((p) => typeof p === "string");
        const scope = i === -1 ? "" : args.splice(i, 1)[0];
        if (args.length === 0) return;

        const stores =
          args.length === 2
            ? Object.entries(args[0] ?? {}).filter(
                (s) => typeof s[1]?.get === "function",
              )
            : [];
        const actions = Object.entries(args[args.length - 1] ?? {}).filter(
          (s) => typeof s[1]?.watch === "function",
        );
        const mode_store = stores.length !== 0;

        if (!stores.length && !actions.length) return;

        const devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
          name: scope ?? "chain-store",
          features: {
            jump: false,
          },
        });

        const disposers = [devtools.disconnect];

        let stored = [];

        const connect = (unit, type, fn) => {
          disposers.push(
            unit.watch((...args) => {
              mode_store
                ? stores.forEach(([_, $store], i) => {
                    if (unit === $store) return;
                    stored[i] = { type, payload: fn(...args) };
                  })
                : devtools.send({ type, ...fn(...args) });

              Promise.resolve().then(() => {
                stored = [];
              });
            }, 0),
          );
        };

        actions.forEach(([key, unit]) => {
          if (typeof unit?.watch !== "function") return;
          connect(unit, key, (params) =>
            unit?.get ? { state: params } : { params },
          );
          unit.done && connect(unit.done, ...dict(key)[0]);
          unit.fail && connect(unit.fail, ...dict(key)[1]);
          !mode_store && unit.end && connect(unit.end, ...dict(key)[2]);
        });

        stores.forEach(([key, $store], i) => {
          disposers.push(
            $store.watch((state) => {
              devtools.send(
                stored[i]
                  ? { type: `${key}: ${stored[i].type}`, ...stored[i].payload }
                  : `${key}[update]`,
                state,
              );
            }, 0),
          );
        });

        return () => disposers.forEach((d) => d());
      }
    : function () {
        return () => void 0;
      };

const dict = (key) => [
  [`${key}.done`, (result, params) => ({ result, params })],
  [`${key}.fail`, (error, params) => ({ error, params })],
  [`${key}.end`, (params) => ({ params })],
];
