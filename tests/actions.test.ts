import { expect, test } from "vitest";
import { createAction } from "../src";
import { delay, filter, mapper } from "./utils";

let res: any[] = [];
const handler = (p: string) => (r: any) => res.push(`${p}-${r}`);

test("action chaining and disposing", () => {
  const act1 = createAction<number>();
  const act2 = act1.filter((n) => n !== 20);
  const act3 = act1.map((n) => n + 3);
  const act4 = act2.map((n) => n + 4);
  const act5 = act3.map((n) => n + 5);
  const act6 = act4.map((n) => n + 6);
  const act7 = act6.map((n) => n + 7);
  const act8 = act5.map((n) => n + 8);
  const act9 = act2.map((n) => n + 9);

  const s1 = act1.watch((r) => {
    handler("a1")(r);
    s1.dispose();
  });
  const s2 = act2.watch(handler("a2"));
  act3.watch(handler("a3"));
  act4.watch(handler("a4"));
  act5.watch(handler("a5"));
  act6.watch(handler("a6"));
  act7.watch(handler("a7"));
  act8.watch(handler("a8"));
  act9.watch(handler("a9"));

  res = [];
  act1(10);
  expect(res).toEqual([
    "a1-10",
    "a2-10",
    "a3-13",
    "a4-14",
    "a9-19",
    "a5-18",
    "a6-20",
    "a8-26",
    "a7-27",
  ]);

  res = [];
  act1(20);
  expect(res).toEqual(["a3-23", "a5-28", "a8-36"]);

  res = [];
  s2.dispose();
  act1(15);
  expect(res).toEqual([
    "a3-18",
    "a4-19",
    "a9-24",
    "a5-23",
    "a6-25",
    "a8-31",
    "a7-32",
  ]);
});

test("action async fns", async () => {
  const act1 = createAction<number>();
  const act2 = act1.map(mapper(2)); // 200
  const act3 = act1.map(mapper(3)).map(mapper(4)); //200
  const act4 = act2.map(mapper(5)); // 400
  const act5 = act2.filter(filter(20)); // 400

  act1.watch(handler("a1"));
  const s2 = act2.watch(handler("a2"));
  act3.watch(handler("a3"));
  act4.watch(handler("a4"));
  act5.watch(handler("a5"));

  res = [];
  act1(20);
  expect(res).toEqual(["a1-20"]);
  await delay(200);
  expect(res).toEqual(["a1-20", "a2-40"]);
  await delay(200);
  expect(res).toEqual(["a1-20", "a2-40", "a4-200", "a5-40", "a3-240"]);

  res = [];
  act1(10);
  s2.dispose(); // dispose after call
  expect(res).toEqual(["a1-10"]);
  await delay(200);
  expect(res).toEqual(["a1-10"]);
  await delay(200);
  expect(res).toEqual(["a1-10", "a4-100", "a3-120"]);
});

test("simultaneous action calls", async () => {
  const act1 = createAction<number>();
  const act2 = act1.map(mapper(2));
  const act3 = act1.filter(filter(10));

  res = [];
  act1.watch(handler("a1"));
  act2.watch(handler("a2"));
  act3.watch(handler("a3"));

  act1(5);
  act1(5);
  act1(10);
  act2(10);

  expect(res).toEqual(["a1-5", "a1-5", "a1-10", "a1-10"]);
  await delay(200);
  expect(res).toEqual([
    "a1-5",
    "a1-5",
    "a1-10",
    "a1-10",
    "a2-10",
    "a3-5",
    "a2-10",
    "a3-5",
    "a2-20",
    "a2-20",
  ]);
});
