<br/>

![chain-store](https://graverok.github.io/chain-store/docs/chain-store-light.svg)

**A simple event-based state manager.**<br/>
- Actions with pre-bound chains of filters and mappings;
- Asynchronous tasks for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, actions, and tasks;
- Built-in tree-shaking support for **React/Preact**, **Solid**, **Vue**, **Svelte**, **Angular**.
- Small, dependency-free core: **2.26 kB** minified, **1.05 kB** gzipped. Framework adapters add just 0.29–0.31 kB.

```ts
// store.ts
import { chain, store, type Action, type Task, type Store } from "chain-store/react";

type User = { id: number; name: string };
type UserStore = { page: number, users: User[] };

/** Create the store */
const $users: Store<UserStore> = store<UserStore>({
  page: 1,
  users: Record<number, User[]>,
});

/** Create a chained task that maps inputs to a page number 
  * and filters out invalid pages */
const changePage = chain<number | void>()
  .map((inc: number) => $users.get().page + (inc ?? 0))
  .filter((page: number) => page >= 1)
  .task((page: number) => fetch(`/users/?page=${page}`)
    .then(response => response.json() as User[])
  );

/** Update the store when the task emits */
$users
  .on(changePage, (state: UserStore, page: number) => {
    return { ...state, page}
  })
  .on(changePage.done, (state: UserStore, users: User[], page: number) => {
    return {
      ...state,
      users: {...state.users, [page]: users }
    }
  })

export { $users, changePage };
```

```tsx
// App.tsx
import { useCallback, useEffect, useState } from "react";
import { $users, changePage } from "./store";

export const App = () => {
  const page = $users.use(state => state.page);
  const users = $users.use((state => state.users[page]), [ page ]);

  const [ loading, setLoading ] = useState(false);

  const fetchWithLoading = useCallback((inc?: number) => {
    setLoading(true);
    changePage(inc).val().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWithLoading();
  }, [ fetchWithLoading ]);

  return <>
    { isLoading ? (
      <span>Loading...</span>
    ) : (
      <ul>
        { users.map(user => <li key={ user.id }>
          { user.name }
        </li>) }
      </ul>
    )}
    
    <button onClick={ () => fetchWithLoading(-1) }>Previous</button>
    Page: #<strong>{ page }</strong>
    <button onClick={ () => fetchWithLoading(1) }>Next</button>
  </>

```

[More information](https://github.com/graverok/chain-store)
