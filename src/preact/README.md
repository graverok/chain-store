## Preact<br/>![chain-store](https://graverok.github.io/chain-store/docs/chain-store-light.svg)


**Preact** adapter for [**chain-store**](https://npmjs.com/package/chain-store), a simple event-based state manager.<br/>
- Actions with pre-bound chains of filters and mappings;
- Asynchronous tasks for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, actions, and tasks;
- Tiny and dependency-free: **2.71 kB** minified, **1.23 kB** gzipped with the Preact adapter included.



```shell
npm install chain-store @chain-store/preact
```

---
```ts
// store.ts
import { chain, store, type Action, type Task } from "@chain-store/preact";

export type State = { page: number; data: Record<number, string[]> };
export const $store = store({ page: 1, data: {} });

export const action: Action<number | void, number> = chain<number | void>()
  .map((shift: number | void) => $store.get().page + (shift ?? 0))
  .filter((page: number) => page >= 1);

export const task: Task<number | void, number, string[]> = action.task(
  (page: number): Promise<string[]> =>
    fetch(`/data?page=${page}`).then((result) => result.json()),
);

$store
  .on(action, (state: State, page: number) => ({ ...state, page }))
  .on(task.done, (state: State, data: string[], page: number) => ({
    ...state,
    data: { ...state.data, [page]: data },
  }));
```

```tsx
// app.tsx
import { render } from "preact";
import { useEffect } from "preact/hooks";
import { $store, action, type State } from "./store";

export const App = () => {
  const page: number = $store.use().page;
  const data: string[] = $store.use(
    (state: State) => state.data[page] ?? [],
    [page],
  );

  useEffect(() => {
    action();
  }, []);

  return (
    <>
      <button onClick={() => action(-1)}>Previous</button>
      <strong>Page: #{page}</strong>
      <button onClick={() => action(1)}>Next</button>
      <ul>
        {data.map((item, key) => <li key={key}>{item}</li>)}
      </ul>
    </>
  );
};
```
---

[**More information**](https://github.com/graverok/chain-store)
