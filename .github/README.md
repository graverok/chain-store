<br/>

![chain-store](../docs/chain-store-light.svg?sanitize=true#gh-light-mode-only)![chain-store](../docs/chain-store-dark.svg?sanitize=true#gh-dark-mode-only)

**A simple event-based state manager.**<br/>
- Events with pre-bound chains of filters and mappings
- Asynchronous actions for business logic
- Independent stores that can be watched in full or in part
- Customizable synchronization between stores, events, and actions
- Small: **2.49kb** minified, **1.14kb** gzipped

## <br/>Installation

```sh
npm install chain-store
```

## <br/>Actions

An **action** takes an `Input` and emits an `Output` through a chain of commands. A chain supports three types of commands:

- **`.map`** transforms the value from the previous command and passes the result to the next command.
- **`.filter`** conditionally stops execution based on the value from the previous command.
- **`.target`** returns a `Target`: an asynchronous action designed for business logic.

```ts
import { chain, Action } from "chain-store";

/** Create an action */
const testAction: Action<number, string> = chain<number>()
  .filter((n: number) => n > 0)
  .map((n: number) => n.toString())
  .filter((s: string) => s.length > 2);

/** Watch emitted outputs */
const unwatch = testAction.watch(console.log);

/** Call the action */
testAction(1000);                         //=> "1000"
testAction(-1000);                        /* Filtered out: (n > 0) */

/** Stop watching */
unwatch();
```

<br/>You can split a chain into separate actions to suit your needs. Triggering any action in the chain causes the other actions to emit their respective outputs.

```ts
import { chain, Action } from "chain-store";

const setNumber: Action<number, number> = chain<number>();
const positiveOnly: Action<number, number> = setNumber.filter(n => n > 0);
const asString: Action<number, string> = positiveOnly.map(n => n.toString());

setNumber.watch(console.log);
asString.watch(console.log);

asString(42);                             //=> 42
                                          //=> "42"

/** It doesn't matter which action in the chain you call */
positiveOnly(-1);                         //=> -1
```

<br/>Commands can also be asynchronous. A `Promise` is resolved before its value is passed down the chain. Any rejection or error stops further execution.

```ts
const action: Action<number, Promise<string>> = chain()
  .map(async (n: number) => n.toString())
  .filter((s: string) => s.length > 1);
```

## <br/>Targets

Targets are the logical endpoints of chains, designed for business logic. When called, 
a target emits its input parameters. It also emits a success or failure event when 
the operation is fulfilled or rejected, similar to a promise. Targets are always 
asynchronous, even when given a regular function.

Create a target by adding the `.target` command to an action chain.

```ts
import { chain, Target } from "chain-store";

type Result = { data: string };

const target: Target<string, string, Result> = chain<string>()
  .map((str: string) => str.toUpperCase())
  .target((str: string) => ({ data: str }));

target.watch((params: string) => 
  console.log("target", params)
);
target.done.watch((result: Result, params: string) =>
  console.log("target.done", result, params)
);
target.fail.watch((error: Error, params: string) =>
  console.log("target.fail", params, error)
);
target.end.watch((params: string) => 
  console.log("target.end", params)
);

target("test");                           //=> "target", "TEST"

                                          //=> "target.done", { data: "TEST" }, "TEST"
                                          //=> "target.end", "TEST"
```

## <br/>Stores

Stores are designed to be small and granular. They can hold any type of data—objects, 
arrays, functions, literally anything. No modifications happen behind the scenes; 
you’re fully in control of all updates.

```ts
import { store } from "chain-store";

type State = { data: string };
const $store = store<State>({ data: "init" });

$store.watch((state: State) => console.log(state.data));

$store.set({ data: "test1" });            //=> "test1"

const state = $store.get();
$store.set({ ...state, data: "test2" });  //=> "test2"

```

<br/>A store can be updated by actions, targets, or updates from other stores:

```ts
type Data = { name: string };

const $data = store<Data>({ name: "chain" });
const $state = store<{ data: Data }>({ data: $data.get() });

/*
  Update one store from another.
  
  Alternatively:
  $data.watch(data => $state.set({ ...$state.get(), data }));
*/
$state.on($data, (state, data) => {
  return { ...state, data };
});

/** Update the store from a target */
const target = chain<string>().target(
  (name: string) => ({ name: name.toUpperCase() })
);

$data
  .on(target, (state: Data, name: string) => ({ ...state, name }))
  .on(target.done, (_, result: Data) => result);

$state.watch(state => {
  console.log(state.data.name);
});

$data.set({ name: "store" });             //=> "store"

target("test");                           //=> "test"
                                          // => "TEST"

/** Unsubscribe */
$state.off($data);
$data.off(); /* Removes all subscriptions */
```

### <br/>Partial stores

Use `.map` on a store to get and watch only part of its state. Partial stores 
are read-only and cannot be updated directly.

```ts
const $store = store({ data: { name: "part" } });
const $partial = $store.map(state => state.data);

console.log($partial.get());              //=> { name: "part" }

$partial.watch((part: { name: string }) => {
  console.log(part.name);
});

$store.set({ data: { name: "test" } });   //=> "test"
$store.set({ data: $partial.get() });     /* No output: the partial state hasn't changed */
```

### <br/>Conditional mutability

Stores let you mutate state while notifying watchers only when the watched value changes. Changes are detected using strict equality (`===`).

```ts
import { chain, store } from "chain-store";

type Data = { name: string };

const setUser = chain<Data>();
const setName = chain<string>();

const $store = store<Data>({ name: "chain" });

$store
  .on(setUser, (_, data: Data) => data)
  .on(setName, (state: Data, name: string) => {
    state.name = name; /* Mutate the state */
    return state;      /* A return value is still required */
  });

$store.watch(data => console.log("data changed"));
$store.map(user => user.name).watch(() => console.log("name changed"));

setUser({ name: "store" });               //=> "data changed"
                                          //=> "name changed"

setName("test");                          //=> "name changed"

setUser({ name: "test" });                //=> "data changed"

setUser($store.get());                    /* No output: nothing changed */
```
