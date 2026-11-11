# @chain-store/tools

**Tools** for **chain-store**, a tiny (814 bytes) yet surprisingly powerful event-based state manager.<br/>

```shell
npm install chain-store @chain-store/tools
```

### Table of contents:
- [**sync**](#sync): synchronize stores across browser tabs;
- [**log**](#log): log updates with Redux DevTools.

<br/>

## sync

Synchronizes stores across browser tabs using `BroadcastChannel`. 
- **sync**(**stores**: `{ [key: string]: Store }`, **scope**?: `string`): `Disposer`

Each key in `stores` identifies a store during synchronization. Keys must be unique within the specified `scope` and identify the same logical store in every tab.

```ts
import { store } from "chain-store";
import { sync } from "@chains-store/tools";

const $profile = store({ name: "Ada" });
const $cart = store({ items: [] });

// Store variable names make convenient identifiers.
const stopSync = sync({ $profile, $cart }, "my-app");

// Call to stop synchronization.
stopSync();
```

When a store changes, it broadcasts its key and new state. Other tabs apply the update to the store with the same key and scope.

### Sync by matching values

Pass a getter as the second argument to synchronize stores only when their matching values are equal. It can return a single value or an array of values.

- **sync**(stores, **match**: `<R>() => R | R[]`, scope?): `Disposer`

```ts
const $profile = store({ id: 1, name: "Ada" });
const $preferences = store({ theme: "dark" });

// Synchronize preferences only for the same user.
sync(
  { $preferences },
  () => $profile.get().id,
);
```

When a store changes, it broadcasts its key, state, and matching values. A receiving store compares the incoming values with its own and updates only if they match. Arrays are compared element by element, not as whole objects.

Values are compared using strict equality (`===`). Use primitives as matching values: objects created in different tabs have different identities and won't be strictly equal.

### Custom comparison

To compare objects or implement custom logic, pass a `compare` function as the third argument. It receives the current and incoming matching values. If it returns `true`, the store updates.

- **sync**(stores, **match**: `<R>() => R`, **compare**: `(a: R, b: R) => boolean`, scope?): `Disposer`

```ts
const $config = store({ page: 1, search: "" });
const $items = store([]);

sync(
  { $items },
  () => $config.get(),
  (current, incoming) =>
    current.page === incoming.page &&
    current.search === incoming.search,
);
```

<br/>

## log
Log stores changes and actions updates with Redux DevTools.
Works in two modes.

### Event logging

- **log**(**units**: `{ [key: string]: Unit }`): `Disposer`


```ts
import { store, chain } from "chain-store";
import { log } from "@chains-store/tools";

const action = chain<number>();
const $data = store({ page: 1, items: []});
const $users = store([]);

// Unit variable names make convenient identifiers.
const stopLog =log({ $users, $data, action });

// Call to stop synchronization.
stopLog();
```
Pass an object whose keys are the unit names shown in Redux DevTools.
The `Actions` log shows each unit’s name and the parameters it emitted.

### Store state updates

- **log**(**stores**: `{ [key: string]: Store }`, **units**: `{ [key: string]: Unit }`): `Disposer`

```ts
const task = action.task({...})
$data
  .on(action, {...})
  .on(task.done, {...});

log({ $data }, { action, task });
```

Pass stores as the first argument and units as the second. Only store updates 
are logged. `State` shows the store’s new state.

If an update comes from a unit listed in the second argument, `Actions` shows 
the unit name alongside the store—for example, `$store: task.done`—and includes the parameters emitted by that unit. If no matching unit is specified, the action is shown as `$store[updated]`.

### Scope
**log()** also accepts an optional `scope` string. It appears as the instance name in Redux DevTools.
```ts
log({ $store }, { task }, "my-scope");
```
