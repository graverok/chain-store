# @chain-store/tools

**Tools** for **chain-store**, a tiny yet surprisingly powerful event-based state manager.<br/>

```shell
npm install chain-store @chain-store/tools
```

### Table of contents:
- [**sync**](#sync): Synchronizes stores across browser tabs using `BroadcastChannel`.
- [**log**](#log): Logs chain emissions and store updates to `Redux DevTools`.
- [**dedupe**](#dedupe): Deduplicates in-flight requests made by `.task`.


<br/><span id="sync" />

## sync`#store`


Synchronizes stores across browser tabs using `BroadcastChannel`. 

### sync`(stores, match?, compare?, scope?): Disposer`

- **stores**: `{ [name: string]: Store }`<br/>
  An object containing the stores to synchronize. Each `name` identifies a store and should be unique within the `scope`.


- **match**?: `<R>() => R | R[]`<br/>
  An optional getter whose return value determines whether to synchronize. 
  Arrays are compared element by element. By default, values are compared using strict equality.


- **compare**?: `<R>(a: R, b: R) => boolean`<br/>
  An optional function that replaces the default comparison, allowing you to 
  compare objects or implement custom logic.



- **scope**?: `string`<br/>
  An optional scope name passed to `BroadcastChannel` to distinguish stores with the same name.


```ts
import { sync } from "@chain-store/tools";

const $config = store({ page: 1, search: "" });
const $items = store([]);

sync(
  { $items },                 /* Stores */
  () => $config.get(),        /* Config used for matching */
  (a, b) =>                   /* Comparison function */
    a.page === b.page &&
    a.search === b.search,
);
```

<br/>
<span id="log"/>

## log`#store`

Logs chain emissions and store updates to `Redux DevTools`.

### log`(stores, units, scope?): Disposer`

- **stores**: `{ [name: string]: Store | StorePart }`<br/>
  An object containing the stores to observe.  


- **units**: `{ [name: string]: Action | Task | Store | StorePart }`<br/>
  An object containing the units used to identify the event that caused each update.


- **scope**?: `string`<br/>
  An optional name for this instance in `DevTools`.


```ts
import { log } from "@chain-store/tools";

const action = chain();
const task = action.task({...})
const $data = store({ page: 1, items: []});

$data.on(action, {...}).on(task.done, {...});

log(
  { $data }, 
  { action, task }                     
);
```

### log`(units, scope?): Disposer`

If no stores are provided `log` works as a simple event logger.

```ts
log({ $data, action, task });
```

<br/><span id="dedupe"/>

## dedupe `#task`

Deduplicates in-flight requests made by `.task`.
If a call with matching parameters is already pending, dedupe returns its promise 
instead of invoking the request function again, preventing duplicate emissions.

### dedupe`<P, R>(request`, `compare?): typeof request`

- **request**: `(params: P) => Promise<R>`<br/>
  A function that accepts parameters and returns a `Promise`


- **compare**?: `(a: P, b: P) => boolean`<br/>
  An optional function for comparing parameters. Defaults to `(a, b) => a === b`.


```ts
import { dedupe } from "@chain-store/tools";
import { request } from "./api"; 

const deduped = chain<{ page: number }>()
  .task(dedupe(
    request,                            /* Request */
    (a, b) => a.page === b.page         /* Comparison function */
  ));

deduped({ page: 1}).then(console.log);  /* Logs twice */
deduped({ page: 1}).then(console.log);  

deduped.done.watch(console.log);        /* Emits once */     
```
