import { expect, test } from "vitest";
import { chain } from "../index";
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

test("action val", async () => {
  handler("f")(chain<number>()(10).val());
  expect(res).toBe("f-10");
  res = "";

  chain<number>()
    .map(async (n) => n + 5)(10)
    .val()
    .then(handler("f"));
  expect(res).toBe("");
  await delay(1); // check 1s why delay
  expect(res).toBe("f-15");
  res = "";

  chain<number>()
    .map(async () => {
      throw new Error("error");
    })(10)
    .val()
    .catch((err) => handler("f")(err.name));
  expect(res).toBe("");
  await delay(1);
  expect(res).toBe(`f-"ChainError"`);
  res = "";

  try {
    chain<number>()
      .filter((n) => n < 0)
      .map((n) => n)(10)
      .val();
  } catch (err) {
    res = (err as Error).name;
  }

  expect(res).toBe("ChainFilter");
  res = "";
});

test("action function types", async () => {
  const fn1 = chain<unknown>();

  const func = async (r: number) => r;

  fn1.watch((data) => {
    res =
      typeof data === "function"
        ? "function"
        : data instanceof Promise
          ? "promise"
          : "";
  });

  fn1(func);
  expect(res).toBe("function");

  await delay();

  fn1(func(10));
  expect(res).toBe("promise");
});
