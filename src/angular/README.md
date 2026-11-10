# @chain-store/angular

**Angular** adapter for **chain-store**, a tiny yet surprisingly powerful event-based state manager.<br/>
- Actions with pre-bound chains of filters and mappings;
- Asynchronous tasks for business logic;
- Independent stores that can be watched in full or in part;
- Customizable synchronization between stores, actions, and tasks;
- Small and dependency-free: **1.04 kB** minified & brotlied with the Angular adapter included.
- **Tools** to **sync** stores across tabs and **log** state changes to Redux DevTools.


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
  .on(task.done, (state: State, data: string[], page: number) => {
    state.data[page] = data; /* Supports mutations */
    return state;
  });
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
