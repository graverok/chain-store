![chain-store](../docs/chain-store-light.svg?sanitize=true#gh-light-mode-only)![chain-store](../docs/chain-store-dark.svg?sanitize=true#gh-dark-mode-only)

**A simple event-based state manager!**

```ts
/** Any package manager */
> npm install chain-store
```


### Actions

Create an action, trigger it, and subscribe or unsubscribe to updates:
```ts
import { createAction } from "chain-store";
import type { Action, Subscription } from "chain-store";

/* Create */
const setNumber: Action<number> = createAction<number>()

/* Subscribe */
const subscription: Subscription = setNumber.watch(console.log)

/* Trigger */
setNumber(42);    // -> 42

/* Unsubscribe */
subscription.dispose();
```


### Chaining
Every action can be chained with other actions using the `.map` and `.filter` methods.
These methods take a callback as input. The callback returns a new value for `.map`
and a boolean for `.filter`. Callbacks can be asynchronous.

```ts
const asString = setNumber.map((n: number) => n.toString());
const asObject = asString.map(async (s: string) => ({ value: s }));
const negativeOnly = setNumber.filter((n: number) => n < 0)
const squareRoot = setNumber.filter((n: number) => n >= 0).map(Math.sqrt)
```


All actions in a chain are connected, and triggering any of them will trigger
the others. Each action triggers in the order of chaining.

```ts
/* Subscribe to see the output */
asString.watch(s => console.log("asString", s));
asObject.watch(o => console.log("asObject", o));
negativeOnly.watch(n => console.log("negativeOnly", n));
squareRoot.watch(n => console.log("squareRoot", n));

asObject(16);     // -> "asString", "16"
                  // -> "squareRoot", 4
                  // -> "asObject", { value: "16" } */

/* "negativeOnly" is filtered out.
   "asObject" fires last because of async mapper */


squareRoot(-10);  // -> "asString", "-10"
                  // -> "negativeOnly", -10
                  // -> "asObject", { value: "-10" }

/* "squareRoot" is filtered out, 
   even if it was the original trigger */
```

Of course, you can choose which actions to watch. And there’s no need to create
each action separately:

```ts
const chainAction = createAction<number>()
  .filter(n > 0)
  .map(n => Math.pow(n, 2))
  .filter(n < 1000)
  .map(n => `Power of two is: ${n}`)
```


### Action Targets
An action target is the end of a chain. The main difference between an action
and a target is that the latter has `.done`, `.fail`, and `.finish` methods,
which can be watched just like triggers.

Create an async action by chaining an action with the `.target` method:

```ts
import { createAction } from "chain-store";
import type { ActionTarget } from "chain-store";

const actionTarget: ActionTarget<number, { data: number }> 
  = createAction<number>().target(async (payload: number) => ({ data: payload }))

actionTarget.watch((params: number) => 
  console.log("start", params));

actionTarget.done.watch((result: { data: number }, params: number) => 
  console.log("done", result, params));

actionTarget.fail.watch((error: Error, params: number) => 
  console.log("fail", error, params));

actionTarget.finish.watch((params: number) => 
  console.log("finish", params));
```

Action targets return an `ActionPromise`. It’s like a promise, but it isn’t one.
It’s useful when you need to wait for an async action to complete before doing
something elsewhere in the app, outside the store.

```ts
const actionPromise = actionTarget(20);

actionPromise
  .done((result: { data: number }, params: number) => {
    console.log(result, params);        // -> { data: 20 }, 20
  })
  .fail((error: Error, params: number) => {
    console.error(error.name, params);
  })
  .finish((params: number) => {
    console.log(params);                // -> 20
    console.log(actionPromise.state);   // -> "done"
  })

console.log(actionPromise.state);     // -> "pending"
```

**Note I:** An async action fails only if its own callback is rejected. Any other
rejection earlier in the chain simply stops further execution, so no fail event
occurs in that case.

### Store

```ts
import { createStore, createAction } from "chain-store";

type State = { name: string, age: number };
const initialState: State = { name: "John", age: 30 };


const changeName = createAction<string>();

/* Create a store */
const store = createStore<State>(initialState);

/* Subscribe the store to an action */
store.on(changeName, (state: State, name: string) => {
  return { ...state, name: name };
});

/* Subscribe to store changes */
const subscription = store.watch((state: State) => console.log(`My name is ${state.name}`));

changeName("Alex");  // -> "My name is Alex"

/* Unsubscribe from store changes */
subscription.dispose();

/* Unsubscribe the store from the action */
store.off(changeName)
```

The store also works with mutable state, if needed:

```ts
const setAge = createAction<number>();

store.on(setAge, (state: State, age: number) => {
  state.age = age; /* State mutation */
  return state;
});

/* Subscribe to partial state updates */
store
  .map((state: State) => state.age)
  .watch((age: number) => console.log(`Now I'm ${age}`));

setAge(42);  // -> "Now I'm 42"

/* The store.watch() subscription won't be triggered
   because the state is the same object */
```


