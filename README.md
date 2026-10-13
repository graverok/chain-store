![chain-store](https://graverok.github.io/chain-store/chain-store-light.svg)

**A simple event-based state manager!**

```ts
import { createAction, createStore } from "chain-store";
import type { Action, ActionTarget, Store } from "chain-store";

type ExampleData = { name: string, email: string };

// Create Action:
const getData: Action<number> = createAction<number>();

// Create ActionTarget:
const fetchData: ActionTarget<number, ExampleData> = getData.target(
  (id: number) => {
    return fetch(`/details/?id=${ id }`).then(
      res => res.json() as ExampleData
    )
  }
    
);

type State = Record<number, {
  loading: boolean,
  data: ExampleData | null,
  error?: string
}>;

// Create Store:
const store: Store<State> = createStore<State>({})
  // Subscribe to watch changes
  .on(fetchData, (state: State, params: number) => ({
    ...state,
    [params]: { ...state[params], loading: true, error: void 0 }
  }))
  .on(fetchData.done, (state: State, result: ExampleData, params: number) => ({
    ...state,
    [params]: { data: result, loading: false, error: void 0 }
  }))
  .on(fetchData.fail, (state: State, error: Error, params: number) => ({
    ...state,
    [params]: { data: null, loading: false, error: error.name }
  }));

// Trigger Action
getData(1); 

// Or trigger ActionTarget if you need to execute something when it's completed. 
fetchData(1)
  .done((result: ExampleData, params: number) => console.log(result, params))
  .fail((error: Error, params: number) => console.log(error.name, params))
  .finish((params: number) => console.log(params));

```

More info on [**github.com/graverok/chain-store**](https://github.com/graverok/chain-store)
