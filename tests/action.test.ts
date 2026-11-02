import { expect, test } from "vitest";
import { chain } from "../src";
import { delay, filter, mapper } from "./utils";

let res: string = "";
const handler = (p: string) => (r: any) => {
  res = (res + ` ${p}-${JSON.stringify(r)}`).trim();
};

test("action chaining and disposing", () => {
  const fn1 = chain<number>();
  const fn2 = fn1.filter((n) => n !== 20);
  const fn3 = fn1.map((n) => n + 3);
  const fn4 = fn2.map((n) => n + 4);
  const fn5 = fn3.map((n) => n + 5);
  const fn6 = fn4.map((n) => n + 6);
  const fn7 = fn6.map((n) => n + 7);
  const fn8 = fn5.map((n) => n + 8);
  const fn9 = fn2.map((n) => n + 9);

  const dis1 = fn1.watch((r) => {
    handler("f1")(r);
    dis1();
  });
  const dis2 = fn2.watch(handler("f2"));
  fn3.watch(handler("f3"));
  fn4.watch(handler("f4"));
  fn5.watch(handler("f5"));
  fn6.watch(handler("f6"));
  fn7.watch(handler("f7"));
  fn8.watch(handler("f8"));
  fn9.watch(handler("f9"));

  fn1(10);
  expect(res).toBe("f1-10 f2-10 f3-13 f4-14 f9-19 f5-18 f6-20 f8-26 f7-27");
  res = "";

  fn1(20);
  expect(res).toBe("f3-23 f5-28 f8-36");
  res = "";

  dis2();
  fn1(15);
  expect(res).toBe("f3-18 f4-19 f9-24 f5-23 f6-25 f8-31 f7-32");
  res = "";
});

test("action async fns", async () => {
  const fn1 = chain<number>();
  const fn2 = fn1.map(mapper(2)); // 200
  const fn3 = fn1.map(mapper(3)).map(mapper(4)); //200
  const fn4 = fn2.map(mapper(5)); // 400
  const fn5 = fn2.filter(filter(20)); // 400

  fn1.watch(handler("f1"));
  const dispose = fn2.watch(handler("f2"));
  fn3.watch(handler("f3"));
  fn4.watch(handler("f4"));
  fn5.watch(handler("f5"));

  fn1(20);
  expect(res).toBe("f1-20");
  await delay(200);
  expect(res).toBe("f1-20 f2-40");
  await delay(200);
  expect(res).toEqual("f1-20 f2-40 f4-200 f5-40 f3-240");
  res = "";

  fn1(10);
  dispose(); // dispose after call

  expect(res).toBe("f1-10");
  await delay(200);
  expect(res).toBe("f1-10");
  await delay(200);
  expect(res).toBe("f1-10 f4-100 f3-120");
  res = "";
});

test("simultaneous action calls", async () => {
  const fn1 = chain<number>();
  const fn2 = fn1.map(mapper(2));
  const fn3 = fn1.filter(filter(10));

  fn1.watch(handler("f1"));
  fn2.watch(handler("f2"));
  fn3.watch(handler("f3"));

  fn1(5);
  fn1(5);
  fn1(10);
  fn2(10);

  expect(res).toBe("f1-5 f1-5 f1-10 f1-10");
  await delay(200);
  expect(res).toBe("f1-5 f1-5 f1-10 f1-10 f2-10 f3-5 f2-10 f3-5 f2-20 f2-20");
  res = "";
});

test("action function types", async () => {
  const fn1 = chain<unknown>();
  const fn2 = chain<unknown>();

  let res1 = "";
  let res2 = "";
  const func = async (r: number) => r;

  fn1.watch((data) => {
    res1 = typeof data;
  });

  fn2.watch((data) => {
    console.log(typeof data);
    res2 = typeof data;
  });

  fn1(func);
  fn2(func(10));

  await delay();
  expect(res1).toBe("function");
  expect(res2).toBe("number");
});

test("action promises types", async () => {
  const promise = new Promise<number>((resolve) => resolve(10));
  let results: any[] = [];
  const act1 = chain<Promise<number>>().map((p) => p);
  const act2 = chain<number>().map(async (n) => n);
  const act3 = chain<Promise<number>>().map(async (p) => String(await p));
  const act4 = chain().map(async () => promise);

  const payload = [promise, 10, promise, void 0];
  const expected = [10, 10, "10", 10];

  [act1, act2, act3, act4].forEach((action, index) => {
    action.watch((r) => {
      results[index] = r;
    });
    action(payload[index]);
  });

  await delay(1);
  expected.forEach((answer, index) => expect(results[index]).toBe(answer));
});
