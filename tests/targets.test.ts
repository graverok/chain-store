import { expect, test } from "vitest";
import { createAction } from "../src";
import { delay, filter, mapper } from "./utils";

let res: any[] = [];
const handler = (p: string) => (r: any) => res.push(`${p}-${r}`);

test("targets", async () => {
  const act1 = createAction<number>();
  const act3 = act1.map((n) => new Promise((resolve) => resolve(n - 10)));
  const tar1 = act1.target((n) => [n]);
  const act2 = act1.map((n) => n * 2);
  const tar2 = act2.target(mapper(1.2));
  const tar3 = act1.filter(filter(20)).target(mapper(3.5));

  let t1w = 0;
  let t1d = 0;

  act1.watch(handler("a1"));
  tar1.watch((n) => {
    t1w = n;
  });
  tar1.done.watch((n) => {
    t1d = n[0];
  });
  act2.watch(handler("a2"));
  act3.watch(handler("a3"));
  tar2.watch(handler("t2"));
  tar2.done.watch(handler("t2d"));
  tar3.watch(handler("t3"));
  tar3.done.watch(handler("t3d"));

  const promise = tar3(10);
  expect(promise.state).toBe("pending");
  promise.done((r, p) => {
    res.push({ r, p });
  });

  expect(res).toEqual(["a1-10", "a2-20"]);
  await delay();
  expect(t1w).toBe(10);
  expect(t1d).toBe(0);
  await delay();
  expect(t1d).toBe(10);
  expect(res).toEqual(["a1-10", "a2-20", "a3-0", "t2-20"]); // target's watch resolve
  await delay(200);
  expect(res).toEqual(["a1-10", "a2-20", "a3-0", "t2-20", "t3-10", "t2d-24"]);
  await delay(200);
  expect(res).toEqual([
    "a1-10",
    "a2-20",
    "a3-0",
    "t2-20",
    "t3-10",
    "t2d-24",
    "t3d-35",
    { p: 10, r: 35 },
  ]);

  res = [];
  act1(20);
  await delay(500);
  expect(res).toEqual(["a1-20", "a2-40", "a3-10", "t2-40", "t2d-48"]);
});

test("simultaneous target calls", async () => {
  const pending: Record<number, Promise<number> | void> = {};
  const stored: Record<number, Promise<number> | void> = {};

  const pender = (x: number) => (n: number) => {
    if (pending[n]) return pending[n] as Promise<number>;
    const p = new Promise<number>((resolve) => {
      setTimeout(() => resolve(x * n), 200);
    });
    pending[n] = p;
    p.finally(() => {
      pending[n] = void 0;
    });
    return p;
  };

  const storer = (x: number) => (n: number) => {
    if (stored[n]) return stored[n] as Promise<number>;
    const p = new Promise<number>((resolve) => {
      setTimeout(() => resolve(x * n), 200);
    });
    stored[n] = p;
    return p;
  };

  const act1 = createAction<number>();
  const tar1 = act1.target(pender(2));
  const tar2 = act1.target(storer(3));

  res = [];
  tar1.watch(handler("t1"));
  tar1.done.watch(handler("t1d"));
  tar2.watch(handler("t2"));
  tar2.done.watch(handler("t2d"));

  tar1(5);
  tar1(10);
  tar1(5);
  tar1(10);

  await delay();
  expect(res).toEqual(["t1-5", "t2-5", "t1-10", "t2-10"]);

  await delay(200);
  expect(res).toEqual([
    "t1-5",
    "t2-5",
    "t1-10",
    "t2-10",
    "t1d-10",
    "t2d-15",
    "t1d-20",
    "t2d-30",
  ]);

  res = [];

  tar1(10).done(handler("t1e"));
  tar1(10).done(handler("t1e"));
  tar2(10).finish(handler("t2e"));

  await delay();
  expect(res).toEqual(["t1-10", "t2-10"]);
  await delay();
  expect(res).toEqual(["t1-10", "t2-10", "t2d-30", "t2e-10"]); // stored resolves
  await delay(200);
  expect(res).toEqual([
    "t1-10",
    "t2-10",
    "t2d-30",
    "t2e-10",
    "t1d-20",
    "t1e-20",
    "t1e-20",
  ]);
});

test("targets error", async () => {
  const error = (x: number) => (n: number) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => (x === n ? reject(`error-${n}`) : resolve(n)), 200);
    });
  };

  const tar1 = createAction<number>().target(error(10));

  tar1.watch(handler("t1"));
  tar1.done.watch(handler("t1d"));
  tar1.fail.watch(handler("t1f"));
  tar1.finish.watch(handler("t1x"));

  res = [];
  tar1(5).done(handler("t1ed")).fail(handler("t1ef")).finish(handler("t1ex"));
  tar1(10).done(handler("t1ed")).fail(handler("t1ef")).finish(handler("t1ex"));

  expect(res).toEqual([]);
  await delay();
  expect(res).toEqual(["t1-5", "t1-10"]);
  await delay(200);
  expect(res).toEqual([
    "t1-5",
    "t1-10",
    "t1d-5",
    "t1ed-5",
    "t1x-5",
    "t1ex-5",
    "t1f-error-10",
    "t1ef-error-10",
    "t1x-10",
    "t1ex-10",
  ]);
});
