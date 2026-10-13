![chain-store](https://graverok.github.io/chain-store/chain-store-light.svg)

**A simple event-based state manager!**

```ts
import { createAction } from "chain-store";
import type { Action, AsyncAction } from "chain-store";
import { DiagnosticsChannel } from "undici-types";
import { createStore } from "./store";
import Error = DiagnosticsChannel.Error;

type ExampleData = { name: string, email: string };

// Create Action:
const getData: Action<number> = createAction<number>();

// Create AsyncAction:
const fetchData: AsyncAction<number, ExampleData> = getData.target(
  (id: number) => fetch(`/details/?id=${ id }`).then(res => res.json() as ExampleData)
);

type State = Record<number, { loading: boolean, data: ExampleData | null, error?: string }>;

// Create Store:
const store = createStore < State >> ({})
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

// Trigger 
getData(1); /* or fetchData(1) */

```

More info on [**github.com/graverok/chain-store**](https://github.com/graverok/chain-store)
