# ![chain-store](https://graverok.github.io/chain-store/docs/chain-store-light.svg)

**A tiny, simple event-based state manager.**<br/>
- Actions with pre-bound chains of filters and mappings;
- Asynchronous tasks for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, actions, and tasks;
- Separate adapters for [**React**](https://www.npmjs.com/package/@chain-store/react), [**Preact**](https://www.npmjs.com/package/@chain-store/preact), [**Solid**](https://www.npmjs.com/package/@chain-store/solid), [**Vue**](https://www.npmjs.com/package/@chain-store/vue), and [**Angular**](https://www.npmjs.com/package/@chain-store/angular); built-in support for **Svelte**;
- Tiny: **2.26 kB** minified, **1.05 kB** gzipped, with zero dependencies.


```shell
npm install chain-store @chain-store/vue
```
---

```ts
// store.ts
import { type Action, chain, store, type Task } from "chain-store";

type State = {
  page: number;
  data: Record<number, string[]>;
};

const $store = store<State>({
  page: 1,
  data: {},
});

/** Action to map the direction to a page increment and filters out invalid values. */
export const changePage: Action<boolean, number> = chain<boolean>()
  .map((forward: boolean) => (forward ? 1 : -1))
  .filter((inc: number) => $store.get().page + inc >= 1);

/** Task to fetch data for the current page. */
export const fetchData: Task<void, number, string[]> = chain()
  .map(() => $store.get().page)
  .task((page: number): Promise<string[]> =>
    fetch(`/data?page=${page}`).then((result) => result.json()),
  );

$store
  .on(changePage, (state, inc: number) => {
    /** Mutate the page in place to avoid emitting the entire store. */
    state.page += inc;
    return state;
  })
  .on(fetchData.done, (state: State, result: string[], params: number) => ({
    ...state,
    data: { ...state.data, [params]: result },
  }));

/** Automatically fetches data whenever the page changes. */
$store.map((state: State) => state.page).watch(() => fetchData());
```

```ts
// index.ts
import { chain } from "chain-store";
import { changePage, fetchData } from "./store";

/** Creates an action to add an item. */
const addItem = chain<void, string>()
  .map(() => prompt("Enter value:"))
  .filter((item: string | null) => Boolean(item))
  .target((item) => fetch(`/add?item=${item as string}`, { method: "PUT" }));

/** Refreshes the current page after an item is added. */
addItem.done.watch(() => fetchData());

const buttonAdd = document.querySelector<HTMLButtonElement>("#add-user");

buttonAdd?.addEventListener("click", () => {
  buttonAdd.setAttribute("disabled", "true");
  addItem()
    .val()
    .finally(() => buttonAdd.removeAttribute("disabled"));
});

document
  .querySelector("#next-page")
  ?.addEventListener("click", () => changePage(true));

document
  .querySelector("#prev-page")
  ?.addEventListener("click", () => changePage(false));
```

[**More information**](https://github.com/graverok/chain-store)
