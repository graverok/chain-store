<br/>

![chain-store](https://graverok.github.io/chain-store/docs/chain-store-light.svg)

**A simple event-based state manager.**

- Events with pre-bound chains of filters and mappings
- Asynchronous actions for business logic
- Independent stores that can be watched in full or in part
- Customizable synchronization between stores, events, and actions
- Small: **2.49kb** minified, **1.14kb** gzipped

```ts
// store.ts
import { chain, store } from "chain-store";
import type { Action, Target } from "chain-store";

/** Converts a direction into an increment for the current page. */
const changePage: Action<boolean, number> = chain<boolean>()
  .map((forward: boolean) => (forward ? 1 : -1));

/** Stores the current page number. */
const $page = store<number>(1)
  .on(changePage, (page: number, inc: number) => page + inc);

/** Fetches users for the current page. */
type User = { id: number; name: string };

const fetchUsers: Target<void, number, User[]> = chain()
  .map(() => $page.get())
  .target((page: number) =>
    fetch(`/users?page=${page}`).then((res) => res.json() as Promise<User[]>)
  );

/** Automatically fetches users when the page changes. */
$page.watch(() => fetchUsers());

/** Stores users by page number. */
type UserState = Record<number, User[]>;

const $users = store<UserState>({})
  .on(
    fetchUsers.done,
    (state: UserState, result: User[], params: number) => ({
      ...state,
      [params]: result,
    })
  );

export { $users, changePage, fetchUsers };
```

```ts
// app.ts
import { chain } from "chain-store";
import { changePage, fetchUsers } from "./store";

/** Creates an action to add a user. */
const addUser = chain<void, string>()
  .map(() => prompt("Enter the user's name"))
  .filter((name: string | null) => Boolean(name))
  .target((name) =>
    fetch(`/adduser?name=${name as string}`, { method: "PUT" })
  );

/** Refreshes the current page after a user is added. */
addUser.done.watch(() => fetchUsers());

const buttonAddUser = document.querySelector<HTMLButtonElement>("#submit");

if (buttonAddUser) {
  buttonAddUser.addEventListener("click", () => {
    buttonAddUser.setAttribute("disabled", "true");
    addUser()
      .val()
      .finally(() => buttonAddUser.removeAttribute("disabled"));
  });
}

document
  .querySelector("#next-page")
  ?.addEventListener("click", () => changePage(true));

document
  .querySelector("#prev-page")
  ?.addEventListener("click", () => changePage(false));
```

[More information](https://github.com/graverok/chain-store)
