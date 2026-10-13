import { expect, test } from "vitest";
import { createAction, createStore } from "../src";
import { delay, mapper } from "./utils";

let res: any[] = [];
const handler = (p: string) => (r: number | { data: number }) =>
  res.push(`${p}-${typeof r === "number" ? r : `data-${r.data}`}`);

test("store", async () => {
  const act1 = createAction<number>();
  const tar1 = act1.target(mapper(2));
  const store = createStore<{ data: number }>({ data: 0 });

  store.on(act1, (state, n) => {
    if (n === state.data) return state;

    if (n === 10) {
      state.data = n;
      return state;
    }

    return { ...state, data: n };
  });
  store.on(tar1.done, (state, result) => {
    if (result === state.data) return state;

    if (result === 10) {
      state.data = result;
      return state;
    }

    return { ...state, data: result };
  });

  res = [];
  store.watch(handler("s"));
  store.map((s) => s.data).watch(handler("s1"));

  act1(0);
  expect(res).toEqual([]);

  act1(5);
  expect(res).toEqual(["s-data-5", "s1-5"]);

  act1(10);
  expect(res).toEqual(["s-data-5", "s1-5", "s1-10"]);

  store.off(act1);
  act1(20);
  expect(res).toEqual(["s-data-5", "s1-5", "s1-10"]);

  res = [];
  await delay();
  await delay(200);
  expect(res).toEqual([
    "s-data-0",
    "s1-0",
    "s1-10",
    "s-data-20",
    "s1-20",
    "s-data-40",
    "s1-40",
  ]);
});
