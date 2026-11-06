# sync
Synchronizes stores between browser tabs using `BroadcastChannel`.

---


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

Returns a void function to stop synchronization.

### Sync by dependencies

Pass a dependency getter as the second argument to sync stores only when their 
dependencies match. It can return a single value or an array. Single values and 
array elements are compared using strict (`===`) equality; arrays are compared element by element, not as whole objects.


```ts
const $profile = store({ id: 1, name: "Ada" });
const $preferences = store({ theme: "dark" });

sync(
  { $preferences },
  () => $profile.get().id,
);
```
Store instances in different tabs are separate, so use primitive dependencies 
instead of objects; the latter will never match.


### Custom matching

To compare objects you can pass a `match` function after the dependency getter 
to compare dependencies. It receives current and incoming dependencies. If it returns `true`, the store updates.

```ts
const $config = store({ page: 1, search: "" })
const $items = store([]);

sync(
  { $items },
  () => $config.get(),
  (a, b) => (a.page === b.page && a.search === b.search),
);  
```


