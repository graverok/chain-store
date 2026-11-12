import { expect, test } from "vitest";
import { chain } from "../src";
import { delay, filter, mapper } from "./utils";

let res = "";
const handler = (p: string) => (r: any) => {
  res = (res + ` ${p}-${JSON.stringify(r)}`).trim();
};

test("task", async () => {
  const act1 = chain<number>();
  const act3 = act1.map((n) => new Promise((resolve) => resolve(n - 10)));
  const task1 = act1.task((n) => [n]);
  const act2 = act1.map((n) => n * 2);
  const task2 = act2.task(mapper(1.2));
  const task3 = act1.filter(filter(20)).task(mapper(3.5));

  act1.watch(handler("a1"));
  task1.watch(handler("t1"));
  task1.done.watch(handler("t1d"));
  act2.watch(handler("a2"));
  act3.watch(handler("a3"));
  task2.watch(handler("t2"));
  task2.done.watch(handler("t2d"));
  task3.watch(handler("t3"));
  task3.done.watch(handler("t3d"));

  const promise = task3(10);
  promise.then(handler("pt3d")).catch(() => {});

  expect(res).toBe("a1-10 a2-20");
  res = "";
  await delay();
  // first async calls. async act1, task1, task2 gets params
  expect(res).toBe("a3-0 t1-10 t2-20");
  res = "";
  await delay();
  // sync task1 resolves
  expect(res).toBe("t1d-[10]");
  res = "";
  await delay(200);
  // async task2 resolves
  expect(res).toBe("t3-10 t2d-24");
  res = "";
  await delay(200);
  expect(res).toBe("t3d-35 pt3d-35");
  res = "";

  act1(20);
  await delay(500);
  expect(res).toBe("a1-20 a2-40 a3-10 t1-20 t2-40 t1d-[20] t2d-48");
  res = "";
});

test("simultaneous task calls", async () => {
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

  const act1 = chain<number>();
  const task1 = act1.task(pender(2));
  const task2 = act1.task(storer(3));

  task1.watch(handler("t1"));
  task1.done.watch(handler("t1d"));
  task2.watch(handler("t2"));
  task2.done.watch(handler("t2d"));

  task1(5);
  task1(10);
  task1(5);
  task1(10);

  await delay();
  expect(res).toBe("t1-5 t2-5 t1-10 t2-10 t1-5 t2-5 t1-10 t2-10");
  res = "";

  await delay(200);
  expect(res).toBe("t1d-10 t2d-15 t1d-20 t2d-30");
  res = "";

  task1(10).then(handler("pt1"));
  task1(10).then(handler("pt1"));
  task2(10).then(handler("pt2"));

  await delay();
  expect(res).toBe("t1-10 t2-10 t1-10 t2-10 t1-10 t2-10");
  res = "";
  await delay();
  expect(res).toBe("t2d-30"); // stored resolves
  res = "";
  await delay();
  expect(res).toBe("pt2-30"); // stored resolves
  res = "";
  await delay(200);
  expect(res).toBe("t1d-20 pt1-20 pt1-20");
  res = "";
});

const error = (x: number) => (n: number) => {
  return new Promise<number>((resolve, reject) => {
    setTimeout(() => (x === n ? reject(`error-${n}`) : resolve(n)), 200);
  });
};

test("task errors", async () => {
  const task1 = chain<number>().task(error(10));

  task1.watch(handler("t1"));
  task1.done.watch(handler("t1d"));
  task1.fail.watch(handler("t1f"));
  task1.end.watch(handler("t1x"));

  task1(5)
    .then(handler("pt1"))
    .catch(handler("pft1"))
    .finally(() => handler("pxt1")("fin"));
  task1(10)
    .then(handler("pt1"))
    .catch(handler("pft1"))
    .finally(() => handler("pxt1")("fin"));

  expect(res).toBe("");
  await delay();
  expect(res).toBe("t1-5 t1-10");
  res = "";
  await delay(200);
  expect(res).toBe(
    `t1d-5 t1x-5 pt1-5 pxt1-"fin" t1f-"error-10" t1x-10 pft1-"error-10" pxt1-"fin"`,
  );
  res = "";
});

test("task().promise", async () => {
  const task1 = chain<number>().task(error(10));

  task1(20).then(handler("pt1"));
  task1(10).catch(handler("et1"));
  await delay();
  await delay(200);
  expect(res).toBe(`pt1-20 et1-"error-10"`);
  res = "";

  const success = task1(20);
  const fail = task1(10);
  await delay(300);
  success.then(handler("pt1")); // fulfilled promise
  fail.catch(handler("et1")); // rejected promise
  await delay();
  expect(res).toBe(`pt1-20 et1-"error-10"`);
  res = "";

  const task2 = chain<number>()
    .filter((n) => n > 0)
    .task(error(20));

  const task3 = chain<number>()
    .map(() => {
      throw new Error();
    })
    .task(error(20));

  task2(30).then(handler("t1"));
  await delay();
  await delay(200);
  expect(res).toBe("t1-30");
  res = "";

  task2(20).catch(handler("t1"));
  await delay();
  await delay(200);
  expect(res).toBe(`t1-"error-20"`);
  res = "";

  task2(-10).catch((err) => handler("t2")(err.name));
  await delay();
  expect(res).toBe(`t2-"ChainFilter"`);
  res = "";

  task3(10).catch((err) => handler("t3")(err.name));
  await delay();
  expect(res).toBe(`t3-"ChainError"`);
  res = "";
});

test("multiple task().promise", async () => {
  const act = chain<number>();
  const task1 = act.task((n) => n * 2);
  const task2 = act.filter(async (n) => n > 0).task((n) => n * 3);

  task1(20).then(handler("pt1"));
  await delay(10);
  expect(res).toBe(`pt1-40`);
  res = "";

  task2(20).then(handler("pt2"));
  await delay(10);
  expect(res).toBe(`pt2-60`);
  res = "";
});

test("sync task", async () => {
  const act1 = chain<number>();
  const task1 = act1.task((n) => n * 2);
  act1.watch(handler("a1"));
  task1.watch(handler("t1"));
  task1.done.watch(handler("t1d"));
  task1.end.watch(handler("t1e"));
  task1(10)
    .then(handler("et1"))
    .finally(() => {
      res += " done";
    });

  expect(res).toBe("a1-10");
  await delay();
  expect(res).toBe("a1-10 t1-10");
  await delay();
  expect(res).toBe("a1-10 t1-10 t1d-20 t1e-10");
  await delay();
  expect(res).toBe("a1-10 t1-10 t1d-20 t1e-10 et1-20");
  await delay();
  expect(res).toBe("a1-10 t1-10 t1d-20 t1e-10 et1-20 done");
  res = "";
});
