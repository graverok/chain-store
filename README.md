<br/>

![chain-store](./docs/chain-store-light.svg?sanitize=true#gh-light-mode-only)![chain-store](./docs/chain-store-dark.svg?sanitize=true#gh-dark-mode-only)

**A simple event-based state manager.**<br/>
- Events with pre-bound chains of filters and mappings;
- Asynchronous actions for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, events, and actions;
- Small: **2.24 kb** minified, **945 bytes** brotlied. Zero dependencies.

### Installation

```sh
npm install chain-store
```

---

### Table of contents:
- [**Actions**](#actions)
- [**Targets**](#targets)
- [**Stores**](#stores)
    - [Partial stores](#partial-stores)
    - [Optional mutability](#optional-mutability)
- [**Additional info**](#additional-info)
    - [.val()](#val)
    - [Chain life cycle](#chain-life-cycle)
- [**Types summary**](#types-summary)

<br/>

## Actions

An **action** takes an `Input` and emits an `Output` through a chain of commands. A chain supports three types of commands:

- **`.map`** transforms the value from the previous command and passes the result to the next command.
- **`.filter`** conditionally stops execution based on the value from the previous command.
- **`.target`** returns a [Target](#targets): an asynchronous action designed for business logic.

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

<br/>

## Targets

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

If a target command returns exactly the same (`===`) promise that is currently 
pending within the target, emission will be skipped to avoid unnecessary store updates. 
If a chain blocks or throws an error before target execution, no fail event will occur.

<br/>

## Stores

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

---

### Partial stores

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

---

### Optional mutability

Stores let you mutate state while notifying watchers only when the watched value
changes. Changes are detected using strict equality (`===`).

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

<br/>

## Additional info
### .val()
Every call to an action or target returns a `val` method.

- **Action call** `val()` returns an `Output` value or — if the chain contains async commands — a `Promise<Output>`.
- **Target call** `val()` always returns a `Promise<Result>` since targets are always asynchronous.

```ts
const action = chain<number>();
const mapped = action.map(async (n) => n.toString())

console.log(action(10).val());            //=> 20
mapped(10).val().then(console.log);       //=> "20"
```

It's useful if you need to get an output outside the store or do something when 
the target resolves.

```ts
const getUsers = chain<number>().target(page => `/users/page?=${page}`);

getUsers(1).val().then(() => {
  /** do your stuff */
})
```

Unlike emitted values, which can be filtered out or blocked by an error, `val()` 
always returns either an `Output` or a `Promise<Output>`, or throws an error.

```ts
const filter = chain<number>().filter(n => n !== 10);

try {
  filter(10).val();
} catch (err) {
  console.log(err.name);                  //=> "ChainFilter"
}
```

---

### Chain life cycle

Every chain has a queue of commands. Every `.map` or `.filter` on a chain adds
a command to this queue. The fewer commands an action has, the earlier it will be called.

```js
const act1 = chain();                     /* 0 commands */
const act2 = act1.map().map();            /* 2 commands */
const act3 = act1.map()                   /* 1 command */
const act4 = act2.map()                   /* 3 commands */

/* act1 -> act3 -> act2 -> act4 */
```

A command emits output *before* passing it down the chain, meaning
all watchers will be notified when the next command is called.

```@ts
const act1 = chain<number>();
const $store = store<number>(0).on(act1, (_, n) => n);

const act2 = act1.map(() => $store.get());  /* returns act1 output value */
```

Command calls are synchronous, except for targets. Targets start after 
a promise delay (`Promise.resolve().then(...)`), which guarantees that they 
run after all actions in the chain have executed. This does not apply to 
asynchronous `.map` and `.filter` commands.

<br/>

## Types summary

**Call**`<Input, Output> = (input: Input) => { val: () => Output }`<br/>

---

**Unit**`<P, X = void>`
- **watch**:`(fn: (params: P, ext: X) => void): Disposer`<br/>
  Subscribes `fn` to the unit's emitter. Returns a `Disposer*`, a void function 
  that disposes of the subscription.


---
### Action`<Input, Output>`<br/>
- extends **Call**`<Input, Output>`<br/>
  On call, returns `.val`, a void function that retrieves the `Output`.


- extends **Unit**`<Output>`<br/>
  Emits `Output` on completion.


- **map**:`(fn: <T>(arg: Output) => T | Promise<T>): Action<Input, T>`<br/>
  Creates a new action that converts `Output` to a new value, `T`.


- **filter**:`(fn: (arg: Output) => boolean | Promise<boolean>): Action<Input, Output>`<br/>
  Creates a new action that filters `Output`. Stops further execution and emission if the value is filtered out.


- **target**:`(fn: <Result, Error>(arg: Output) => Promise<Result>): Target<Input, Output, Result, Error>`<br/>
  Creates a `Target` with the provided asynchronous command.

---

### **Target**`<Input, Params, Result, Error>`<br/>
- extends **Call**`<Input, Promise<Result>`<br/>
  On call, returns `.val`, a void function that returns a `Promise<Result>`.


- extends **Unit**`<Params>`<br/>
  Emits `Params` when the command is invoked.


- **done**:`Unit<Result, Params>`<br/>
  Unit emitting `Result` and `Params` when the target's promise resolves.


- **fail**:`Unit<Error, Params>`<br/>
  Unit emitting `Error` and `Params` when the target's promise rejects.


- **end**: `Unit<Params>`<br/>
  Unit emitting `Params` when the target's promise finishes.

---

### **Store**`<State>`
- extends **Unit**`<State>`<br/>
  Emits `State` when the state changes, as determined by strict equality (`===`).


- **get**:`() => State`<br/>
  Returns the current state.


- **set**:`(next: State) => void`<br/>
  Sets the new state.


- **on**:`<P, X = void>(unit: Unit<P, X>, fn: (state: State, params: P, ext: X) => State): Store<State>`<br/>
  Subscribes the store to a unit's emitter. `fn` should return a new state value. Only one subscription per unit is allowed at a time.


- **off**:`(unit: Unit): Store<State>`<br/>
  Unsubscribes the store from a unit.


- **map**: `(mapper: <M>(state: State) => M): ReadStore<M>`<br/>
  Creates a new read-only store (without `.on`, `.off`, or `.set`) with a mapped value. It automatically updates from the parent store.<br/>


