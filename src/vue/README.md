## Vue<br/>![chain-store](https://graverok.github.io/chain-store/docs/chain-store-light.svg)

**Vue** adapter for [**chain-store**](https://npmjs.com/package/chain-store), a tiny and simple event-based state manager.<br/>
- Actions with pre-bound chains of filters and mappings;
- Asynchronous tasks for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, actions, and tasks;
- Tiny and dependency-free: **2.74 kB** minified, **1.25 kB** gzipped with the Vue adapter included.


```shell
npm install chain-store @chain-store/vue
```

---
```ts
// store.ts
import { chain, store, type Action, type Task } from "@chain-store/vue";

export type State = { page: number; data: Record<number, string[]> };
export const $store = store({ page: 1, data: {} });

export const action: Action<number | void, number> = chain<number | void>()
  .map((shift: number | void) => $store.get().page + (shift ?? 0))
  .filter((page: number) => page >= 1);

export const task: Task<number | void, number, string[]> = action.task(
  (page: number): Promise<string[]> =>
    fetch(`/data?page=${page}`).then((result) => result.json())
);

$store
  .on(action, (state: State, page: number) => ({ ...state, page }))
  .on(task.done, (state: State, data: string[], page: number) => ({
    ...state,
    data: { ...state.data, [page]: data },
  }));
```

```vue
<!-- app.vue-->
<script setup lang="ts">
  import { $store, action, type State } from "./store";

  action();

  const page = $store.use((state: State) => state.page);
  const data = $store.use(
      (state: State) => state.data[page.value] ?? [],
      [() => page]
  );
</script>

<template>
  <button @click="action(-1)">Previous</button>
  <strong>Page: #{{ page }}</strong>
  <button @click="action(1)">Next</button>
  
  <ul>
    <li v-for="item in data">{{ item }}</li>
  </ul>
</template>
```

---

[**More information**](https://github.com/graverok/chain-store)
