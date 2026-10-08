![chain-store](./docs/chain-store.svg?sanitize=true#gh-light-mode-only)![chain-store](./docs/chain-store-dark.svg?sanitize=true#gh-dark-mode-only)

**Simple event-based state-manager.** Works with just two functions!

### Overview

```ts
import { createAction } from "chain-store";

type User = { name: string, age: number };


const chainAction = createAction<number>()
  .filter((page:number) => page >= 1)
  .map((page: number) => fetch(`/get-page?page=${page}`))
  .map((res))
```


```ts
// any package manager
npm install chain-store
```



### createAction()
```ts
import { createAction } from "chain-store";
import type { Action, AsyncAction } from "chain-store";

// create action
const setNumber = createAction<number>();

// subscribe to action call
setNumber.watch((value) => console.log(`value is ${value}`));

// trigger action
setNumber(42);

// output:
// "value is 42"

// create chained async action
const powerOfTwo = setNumber.map((value: number) =>
  Math.pow(value, 2),
);

// subscribe to async action result
powerOfTwo.done.watch((powered) => console.log(`square is ${powered}`));

// trigger async action
powerOfTwo(4);

// output:
// "value is 4" - comes from setNumber action since all actions in chain are executed at once
// "square is 16"
```

### createStore()

```ts
import { createStore, createAction } from "chain-store";

type State = { name: string, age: number };
const initialState: State = { name: "John", age: 30 };

// create store
const store = createStore<State>(initialState);

// create action
const changeName = createAction<string>()

// subscribe store to action
store.on(changeName, (state: State, name: string) => {
  return { ...state, name: name };
});

// subscribe to store change
store.watch((state: State) => console.log(`name is ${state.name}`));

changeName("Alex");
// output:
// "name is Alex" 
```
Store works with mutable states if needed:
```ts
const setAge = createAction<number>();

store.on(setAge, (state: State, age: number) => {
  state.age = age; // state mutation
  return state;
});

// subscribe to partial state
store.map((state) => state.age).watch((age) => console.log(`Now I'm ${age}`));

setAge(42);

// output:
// "Now I'm 42"

// subscription store.watch() won't be triggered since state is the same object

```

Complete documentation is coming soon... ¯\\\_(ツ)_/¯ 
