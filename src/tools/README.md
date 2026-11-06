# @chain-store/tools

**Tools**  for [**chain-store**](https://npmjs.com/package/chain-store), a tiny and simple event-based state manager.<br/>

```shell
npm install chain-store @chain-store/tools
```


## sync
```ts
import { sync } from "@chain-store/tools"
```
Synchronizes stores between browser tabs using `BroadcastChannel`. It returns a void function to stop synchronization.


```ts
import { store } from "chain-store";
import { sync } from "@chains-store/tools";

const $profile = store({ name: "Ada" });
const $cart = store({ items: [] });

const stopSync = sync({ $profile, $cart });

// Call when synchronization is no longer needed:
stopSync();
```

The first argument is a `Record<string, Store>`. Each key identifies a store; use store variable names for convenience.

When a store changes, it broadcasts its key and new state. Other tabs apply the update to the store with the same key. Keys must be unique within a scope and identify the same logical store in every tab.

The optional `scope` separates sync groups. Tabs communicate when they use the same scope and store keys.

### Sync by dependencies

Pass a dependency getter as the second argument to sync stores only when their dependencies match. It can return a single value or an array. Single values and array elements are compared using strict equality; arrays are compared element by element, not as whole objects.


```ts
const $profile = store({ id: 1, name: "Ada" });
const $preferences = store({ userId: 1, theme: "dark" });

sync(
  { $profile, $preferences },
  () => $profile.get().id,
);
```
Because store instances in different tabs are separate, use primitive dependencies rather than object references.


### Custom matching

Pass a `match` function after the dependency getter to compare dependencies that contain objects or need custom logic. It receives the current dependency and the dependency from the other tab. If it returns `true`, the store updates.

```ts
const $profile = store({
  user: { id: "user-1", organizationId: "org-1" },
  name: "Ada",
});

const $preferences = store({
  user: { id: "user-1", organizationId: "org-1" },
  theme: "dark",
});

const stopSync = sync(
  { $profile, $preferences },
  () => $profile.get().user,
  (current, incoming) =>
    current.organizationId === incoming.organizationId,
  "organization-data"
);
```

When using `match`, returning a single object as the dependency is often simpler than returning an array.

## debug
Debugging with Redux DevTools.
