<br/>

![chain-store](./docs/chain-store-light.svg?sanitize=true#gh-light-mode-only)![chain-store](./docs/chain-store-dark.svg?sanitize=true#gh-dark-mode-only)

**A simple event-based state manager.**<br/>
- Actions with pre-bound chains of filters and mappings;
- Asynchronous tasks for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, actions, and tasks;
- Built-in tree-shaking support for **React/Preact**, **Vue**, **Angular**, **Solid**.
- Small: **2.23 kB** minified, **1.04 kB** gzipped. Zero dependencies.

### Installation

```sh
npm install chain-store
```



### Table of contents:
- [**Action**](#action)<br/>
- [**Task**](#task)<br/>
- [**Store**](#store):  [Partial store](#partial-store)  •  [Optional mutability](#optional-mutability)<br/>
- **Integration**:  [React/Preact](#react-preact)  •  [Vue](#vue)  •  [Solid](#solid)  •  [Angular](#angular)<br/>
- **Additional info**:  [.val()](#val)  •  [Chain life cycle](#chain-life-cycle)<br/>
- [**Types summary**](#types-summary)<br/>

<br/>

# Action

An **action** takes an `Input` and emits an `Output` through a chain of commands. A chain supports three types of commands:

- **`.map`** transforms the value from the previous command and passes the result to the next command.
- **`.filter`** conditionally stops execution based on the value from the previous command.
- **`.task`** returns a [Task](#tasks): an asynchronous action designed for business logic.

```ts
import { chain, type Action } from "chain-store";

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

<br/>You can split a chain into separate actions as needed. Calling any action in the chain causes the other actions to emit their respective outputs.

```ts
import { chain, type Action } from "chain-store";

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

# Task

Tasks are the logical endpoints of chains and are designed for business logic. When called, a task emits its input parameters. It also emits a success or failure event when the operation resolves or rejects, much like a promise. Tasks are always asynchronous, even when given a synchronous function.

Create a task by adding the `.task` command to an action chain.

```ts
import { chain, type Task } from "chain-store";

type Result = { data: string };

const task: Task<string, string, Result> = chain<string>()
  .map((str: string) => str.toUpperCase())
  .task((str: string) => ({ data: str }));

task.watch((params: string) => 
  console.log("task", params)
);
task.done.watch((result: Result, params: string) =>
  console.log("task.done", result, params)
);
task.fail.watch((error: Error, params: string) =>
  console.log("task.fail", params, error)
);
task.end.watch((params: string) => 
  console.log("task.end", params)
);

task("test");                             //=> "task", "TEST"

                                          //=> "task.done", { data: "TEST" }, "TEST"
                                          //=> "task.end", "TEST"
```

If a task command returns the same (`===`) promise that is already pending within the task, the emission is skipped to avoid unnecessary store updates. If a chain is blocked or an error is thrown before the task runs, no fail event is emitted.

<br/>

# Store

Stores are small and granular. They can hold any type of data—objects, arrays, functions, or anything else. No changes happen behind the scenes; you control all updates.

```ts
import { store } from "chain-store";

type State = { data: string };
const $store = store<State>({ data: "init" });

$store.watch((state: State) => console.log(state.data));

$store.set({ data: "test1" });            //=> "test1"

const state = $store.get();
$store.set({ ...state, data: "test2" });  //=> "test2"

```

<br/>A store can be updated by actions, tasks, or other stores:

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

/** Update the store from a task */
const task = chain<string>().task(
  (name: string) => ({ name: name.toUpperCase() })
);

$data
  .on(task, (state: Data, name: string) => ({ ...state, name }))
  .on(task.done, (_, result: Data) => result);

$state.watch(state => {
  console.log(state.data.name);
});

$data.set({ name: "store" });             //=> "store"

task("test");                             //=> "test"
                                          // => "TEST"

/** Unsubscribe */
$state.off($data);
$data.off(); /* Removes all subscriptions */
```

---

### Partial store

Use `.map` on a store to read and watch only part of its state. Partial stores are read-only and cannot be updated directly.

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

<br/>

## Integration

<span id="react-preact"/>

### React<small><sup> `v16.8+`</sup></small> / Preact<small><sup> `v10+`</sup></small>

```tsx
/* Re-exports core functions and types */
import { chain, store, useStore, type Store } from "chain-store/react";
/* for Preact: "chain-store/preact"; */
import { useEffect } from "react";

/* Store */
const fetchUsers = chain().task(() => fetch("/users").then(result => result.json()));
const $users: Store<User[]> = store<User[]>([])
        .on(fetchUsers.done, (_, result: User[]) => result);

/* App */
const App = () => {
  const users: User[] = useStore($users);

  useEffect(() => {
    fetchUsers();
  }, []);

  return <ul>
    { users.map((user) => <li key={ user.id }>{ user.name }</li>) }
  </ul>;
};
```

**useStore** has an optional second argument: a dependency array. Use it with mapped stores to control subscriptions.
```ts
useStore<State>(
        $store: Store<State>,
        deps: DependencyList = [$store]
) => State;
```

---
<span id="vue"/>

### Vue<small><sup> `v3.3+`</sup></small>

```vue
<script lang="ts">
  /* Re-exports core functions and types */
  import { chain, store, useStore, type Store } from "chain-store/vue";

  const fetchUsers = chain().task(() => fetch("/users").then(result => result.json()));
  const $users: Store<User[]> = store<User[]>([])
          .on(fetchUsers.done, (_, result: User[]) => result);
</script>

<script setup lang="ts">
  fetchUsers();
  const users = useStore($users);
</script>

<template>
  <ul>
    <li v-for="user in users">
      {{ user.name }}
    </li>
  </ul>
</template>
```

**useStore** can take a store getter as its first argument. It also accepts an optional dependency array as its second argument. Use the getter and dependencies to control subscriptions.

```ts
useStore<State>(
        $store: Store<State> | (() => Store<State>),
        deps: WatchSource<unknown>[] = [],
) => readonly Ref<State>;
```

---
<span id="solid"/>

### Solid<small><sup> `v1.x`</sup></small>

```tsx
/* Re-exports core functions and types */
import { chain, store, useStore, type Store } from "chain-store/solid";

/* Store */
const fetchUsers = chain().task(() => fetch("/users").then(result => result.json()));
const $users: Store<User[]> = store<User[]>([])
        .on(fetchUsers.done, (_, result: User[]) => result);

/* App */
const App = () => {
  const users = useStore($users);

  fetchUsers();

  return <ul>
    { users().map((user) => <li key={ user.id }>{ user.name }</li>) }
  </ul>;
};
```

**useStore** can take a store getter as its first argument. It also accepts an optional dependency array as its second argument. Use the getter and dependencies to control subscriptions.

```ts
useStore<State>(
        $store: Store<State> | (() => Store<State>),
        deps: Accessor<unknown>[] = [],
) => Accessor<State>;
```

---
<span id="angular"/>

### Angular<small><sup> `v16.x+`</sup></small>

```ts
/* Re-exports core functions and types */
import { chain, store, useStore, type Store } from "chain-store/angular";
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

/* Store */
interface User {
  id: number;
  name: string;
}

const fetchUsers = chain().task(() =>
        fetch("/users").then(result => result.json() as Promise<User[]>)
);
const $users: Store<User[]> = store<User[]>([])
        .on(fetchUsers.done, (_, result: User[]) => result);

/* App */
@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul>
      <li *ngFor="let user of users()">{{ user.name }}</li>
    </ul>
  `,
})
export class AppComponent {
  readonly users = useStore($users);

  constructor() {
    fetchUsers();
  }
}
```

**useStore** can take a store getter as its first argument. It also accepts an optional dependency array as its second argument. Use the getter and dependencies to control subscriptions.

```ts
useStore<State>(
        $store: Store<State> | (() => Store<State>),
        deps: Accessor<unknown>[] = [],
) => Accessor<State>;
```

<br/>

## Additional info
### .val()
Every call to an action or task returns a `val` method.

- **Action call** `val()` returns an `Output` value or, if the chain contains asynchronous commands, a `Promise<Output>`.
- **Task call** `val()` always returns a `Promise<Result>` because tasks are always asynchronous.

```ts
const action = chain<number>();
const mapped = action.map(async (n) => n.toString())

console.log(action(10).val());            //=> 20
mapped(10).val().then(console.log);       //=> "20"
```

Use `val()` to get an output outside the store or to run code when a task resolves.

```ts
const getUsers = chain<number>().task(page => `/users/page?=${page}`);

getUsers(1).val().then(() => {
  /** do your stuff */
})
```

Unlike emitted values, which can be filtered out or blocked by an error, `val()` always returns an `Output` or a `Promise<Output>`, or throws an error.

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

Every chain has a queue of commands. Each `.map` or `.filter` call adds a command to the queue. Actions with fewer commands run earlier.

```js
const act1 = chain();                     /* 0 commands */
const act2 = act1.map().map();            /* 2 commands */
const act3 = act1.map()                   /* 1 command */
const act4 = act2.map()                   /* 3 commands */

/* act1 -> act3 -> act2 -> act4 */
```

A command emits its output *before* passing it down the chain. As a result, all watchers are notified before the next command runs.

```@ts
const act1 = chain<number>();
const $store = store<number>(0).on(act1, (_, n) => n);

const act2 = act1.map(() => $store.get());  /* returns act1 output value */
```

Commands run synchronously, except for tasks. Tasks start after a promise delay (`Promise.resolve().then(...)`), so they run after all actions in the chain have executed. This does not apply to asynchronous `.map` and `.filter` commands.




<br/>

## Types summary

**Call**`<Input, Output> = (input: Input) => { val: () => Output }`<br/>

---

**Unit**`<P, X = void>`
- **watch**:`(fn: (params: P, ext: X) => void): Disposer`<br/>
  Subscribes `fn` to the unit's emitter and returns a `Disposer*`: a function that removes the subscription.


---
### Action`<Input, Output>`<br/>
- extends **Call**`<Input, Output>`<br/>
  When called, returns `.val`, a function that retrieves the `Output`.


- extends **Unit**`<Output>`<br/>
  Emits `Output` when the action completes.


- **map**:`(fn: <T>(arg: Output) => T | Promise<T>): Action<Input, T>`<br/>
  Creates a new action that transforms `Output` into `T`.


- **filter**:`(fn: (arg: Output) => boolean | Promise<boolean>): Action<Input, Output>`<br/>
  Creates a new action that filters `Output`. If the value is filtered out, execution and emission stop.


- **task**:`(fn: <Result, Error>(arg: Output) => Promise<Result>): Task<Input, Output, Result, Error>`<br/>
  Creates a `Task` with the provided asynchronous command.

---

### **Task**`<Input, Params, Result, Error>`<br/>
- extends **Call**`<Input, Promise<Result>`<br/>
  When called, returns `.val`, a function that returns a `Promise<Result>`.


- extends **Unit**`<Params>`<br/>
  Emits `Params` when the command is called.


- **done**:`Unit<Result, Params>`<br/>
  Emits `Result` and `Params` when the task's promise resolves.


- **fail**:`Unit<Error, Params>`<br/>
  Emits `Error` and `Params` when the task's promise rejects.


- **end**: `Unit<Params>`<br/>
  Emits `Params` when the task's promise settles.

---

### **Store**`<State>`
- extends **Unit**`<State>`<br/>
  Emits `State` when the state changes, as determined by strict equality (`===`).


- **get**:`() => State`<br/>
  Returns the current state.


- **set**:`(next: State) => void`<br/>
  Sets the store's state.


- **on**:`<P, X = void>(unit: Unit<P, X>, fn: (state: State, params: P, ext: X) => State): Store<State>`<br/>
  Subscribes the store to a unit's emitter. `fn` must return the next state. Only one subscription per unit is allowed at a time.


- **off**:`(unit: Unit): Store<State>`<br/>
  Unsubscribes the store from a unit.


- **map**: `(mapper: <M>(state: State) => M): ReadStore<M>`<br/>
  Creates a read-only store (without `.on`, `.off`, or `.set`) that holds the mapped value and updates automatically when the parent store changes.<br/>
