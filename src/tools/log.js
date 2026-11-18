import { voider } from "./shared.js";

export const log =
  process.env.NODE_ENV !== "production" &&
  typeof window !== "undefined" &&
  window.__REDUX_DEVTOOLS_EXTENSION__
    ? (...args) => {
        if (args.length === 0) return voider;
        let i = args.findIndex((p) => typeof p === "string");
        const scope = i === -1 ? "" : args.splice(i, 1)[0];
        if (args.length === 0) return voider;

        /* Init stores */
        const stores =
          args.length === 2
            ? Object.entries(args[0] ?? {}).filter(
                (s) => typeof s[1]?.get === "function",
              )
            : [];

        /* Init actions */
        const actions = new Map();
        Object.entries(args[args.length - 1] ?? {}).forEach(([key, unit]) => {
          if (typeof unit?.watch !== "function") return;
          actions.set(unit, [
            key,
            (params) => (unit?.get ? { state: params } : { params }),
          ]);
          if (typeof unit.done?.watch === "function")
            actions.set(unit.done, dict(key)[0]);
          if (typeof unit.fail?.watch === "function")
            actions.set(unit.fail, dict(key)[1]);
          if (typeof unit.fail?.end === "function")
            actions.set(unit.end, dict(key)[2]);
        });

        if (!stores.length && !actions.size) return voider;

        const devtools = window.__REDUX_DEVTOOLS_EXTENSION__.connect({
          name: scope ?? "chain-store",
          features: {
            jump: false,
          },
        });

        const disposers = [];

        if (stores.length) {
          stores.forEach(([key, $store]) =>
            disposers.push(
              $store.watch(function (state) {
                const [unit, ...rest] = this ?? [];
                const [ref, fn] = actions.get(unit) ?? [];
                devtools.send(
                  ref
                    ? { type: `${key}: ${ref}`, ...fn?.(...rest) }
                    : `${key}[update]`,
                  state,
                );
              }),
            ),
          );
        } else {
          actions.forEach(([type, fn], unit) =>
            disposers.push(
              unit.watch((...args) => devtools.send({ type, ...fn(...args) })),
            ),
          );
        }

        disposers.push(devtools.disconnect);
        return () => disposers.forEach((d) => d());
      }
    : () => voider;

const dict = (key) => [
  [`${key}.done`, (result, params) => ({ result, params })],
  [`${key}.fail`, (error, params) => ({ error, params })],
  [`${key}.end`, (params) => ({ params })],
];
