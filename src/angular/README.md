## Angular<br/>![chain-store](https://graverok.github.io/chain-store/docs/chain-store-light.svg)

**Angular** adapter for [**chain-store**](https://npmjs.com/package/chain-store), a tiny and simple event-based state manager.<br/>
- Actions with pre-bound chains of filters and mappings;
- Asynchronous tasks for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, actions, and tasks;
- Tiny and dependency-free: **2.74 kB** minified, **1.25 kB** gzipped with the Angular adapter included.


```shell
npm install chain-store @chain-store/angular
```

---
```ts
// store.ts
import { chain, store, type Action, type Task } from '@chain-store/angular';

export type State = { page: number; data: Record<number, string[]> };
export const $store = store({ page: 1, data: {} });

export const action: Action<number | void, number> = chain<number | void>()
  .map((shift: number | void) => $store.get().page + (shift ?? 0))
  .filter((page: number) => page >= 1);

export const task: Task<number | void, number, string[]> = action.task(
  (page: number): Promise<string[]> =>
    fetch(`/data?page=${page}`).then((result) => result.json()),
);

$store
  .on(action, (state: State, page: number) => ({ ...state, page }))
  .on(task.done, (state: State, data: string[], page: number) => ({
    ...state,
    data: { ...state.data, [page]: data },
  }));
```

```tsx
// app.component.ts
import { Component } from '@angular/core';
import { $store, action, type State } from "./store";

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <button (click)="decrement()">Previous</button>
    <strong>Page: #{{ page() }}</strong>
    <button (click)="increment()">Next</button>
    <ul>
      @for (item of data(); track $index) {
        <li>{{ item }}</li>
      }
    </ul>
  `,
})
export class AppComponent {
  readonly page = $store.use((state: State) => state.page);
  readonly data = $store.use((state: State) => state.data[this.page()] ?? []);

  ngOnInit() {
    action();
  }

  decrement() {
    action(-1);
  }

  increment() {
    action(1);
  }
}

```

---

[**More information**](https://github.com/graverok/chain-store)
