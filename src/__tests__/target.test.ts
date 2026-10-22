import { expect, test } from "vitest";
import { chain } from "../index";
import { delay, filter, mapper } from "./utils";

let res = "";
const handler = (p: string) => (r: any) => {
  res = (res + ` ${p}-${JSON.stringify(r)}`).trim();
};

test("target", async () => {
  const fn1 = chain<number>();
  const fn3 = fn1.map((n) => new Promise((resolve) => resolve(n - 10)));
  const act1 = fn1.target((n) => [n]);
  const fn2 = fn1.map((n) => n * 2);
  const act2 = fn2.target(mapper(1.2));
  const act3 = fn1.filter(filter(20)).target(mapper(3.5));

  fn1.watch(handler("f1"));
  act1.watch(handler("a1"));
  act1.done.watch(handler("a1d"));
  fn2.watch(handler("f2"));
  fn3.watch(handler("f3"));
  act2.watch(handler("a2"));
  act2.done.watch(handler("a2d"));
  act3.watch(handler("a3"));
  act3.done.watch(handler("a3d"));

  const promise = act3(10).val();
  promise.then(handler("pa3d")).catch(() => {});

  expect(res).toBe("f1-10 f2-20");
  await delay();
  expect(res).toBe("f1-10 f2-20 f3-0 a1-10 a2-20"); // first async calls
  await delay();
  expect(res).toBe("f1-10 f2-20 f3-0 a1-10 a2-20 a1d-[10]"); // target's watch resolve
  await delay(200);
  expect(res).toBe("f1-10 f2-20 f3-0 a1-10 a2-20 a1d-[10] a3-10 a2d-24");
  await delay(200);
  expect(res).toBe(
    "f1-10 f2-20 f3-0 a1-10 a2-20 a1d-[10] a3-10 a2d-24 a3d-35 pa3d-35",
  );
  res = "";

  fn1(20);
  await delay(500);
  expect(res).toBe("f1-20 f2-40 f3-10 a1-20 a2-40 a1d-[20] a2d-48");
  res = "";
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

  const fn1 = chain<number>();
  const act1 = fn1.target(pender(2));
  const act2 = fn1.target(storer(3));

  act1.watch(handler("a1"));
  act1.done.watch(handler("a1d"));
  act2.watch(handler("a2"));
  act2.done.watch(handler("a2d"));

  act1(5);
  act1(10);
  act1(5);
  act1(10);

  await delay();
  expect(res).toBe("a1-5 a2-5 a1-10 a2-10");

  await delay(200);
  expect(res).toBe("a1-5 a2-5 a1-10 a2-10 a1d-10 a2d-15 a1d-20 a2d-30");
  res = "";

  act1(10).val().then(handler("pa1"));
  act1(10).val().then(handler("pa1"));
  act2(10).val().then(handler("pa2"));

  await delay();
  expect(res).toBe("a1-10 a2-10");
  await delay();
  expect(res).toBe("a1-10 a2-10 a2d-30"); // stored resolves
  await delay();
  expect(res).toBe("a1-10 a2-10 a2d-30 pa2-30"); // stored resolves
  await delay(200);
  expect(res).toBe("a1-10 a2-10 a2d-30 pa2-30 a1d-20 pa1-20 pa1-20");
  res = "";
});

const error = (x: number) => (n: number) => {
  return new Promise<number>((resolve, reject) => {
    setTimeout(() => (x === n ? reject(`error-${n}`) : resolve(n)), 200);
  });
};

test("target errors", async () => {
  const act1 = chain<number>().target(error(10));

  act1.watch(handler("a1"));
  act1.done.watch(handler("a1d"));
  act1.fail.watch(handler("a1f"));
  act1.end.watch(handler("a1x"));

  act1(5)
    .val()
    .then(handler("pa1"))
    .catch(handler("pfa1"))
    .finally(() => handler("pxa1")("fin"));
  act1(10)
    .val()
    .then(handler("pa1"))
    .catch(handler("pfa1"))
    .finally(() => handler("pxa1")("fin"));

  expect(res).toBe("");
  await delay();
  expect(res).toBe("a1-5 a1-10");
  await delay(200);
  expect(res).toBe(
    `a1-5 a1-10 a1d-5 a1x-5 pa1-5 pxa1-"fin" a1f-"error-10" a1x-10 pfa1-"error-10" pxa1-"fin"`,
  );
  res = "";
});

test("target val", async () => {
  const act1 = chain<number>().target(error(10));

  act1(20).val().then(handler("pa1"));
  act1(10).val().catch(handler("ea1"));
  await delay();
  await delay(200);
  expect(res).toBe(`pa1-20 ea1-"error-10"`);
  res = "";

  const success = act1(20);
  const fail = act1(10);
  await delay(300);
  success.val().then(handler("pa1")); // fulfilled promise
  fail.val().catch(handler("ea1")); // rejected promise
  await delay();
  expect(res).toBe(`pa1-20 ea1-"error-10"`);
  res = "";

  const act2 = chain<number>()
    .filter((n) => n > 0)
    .target(error(20));

  act2(30).val().then(handler("a1"));
  await delay();
  await delay(200);
  expect(res).toBe("a1-30");
  res = "";

  act2(20).val().catch(handler("a1"));
  await delay();
  await delay(200);
  expect(res).toBe(`a1-"error-20"`);
  res = "";

  act2(-10)
    .val()
    .catch((err) => handler("a1")(err.name));
  await delay();
  await delay(300);
  expect(res).toBe(`a1-"ChainFilter"`);
});
