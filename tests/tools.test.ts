import { expect, test, vi } from "vitest";
import { chain } from "../src";
import { dedupe } from "../src/tools";
import { delay, mapper } from "./utils";

let res: string = "";
const handler = (p: string) => (r: any) => {
  res = (res + ` ${p}-${JSON.stringify(r)}`).trim();
};

test("dedupe", async () => {
  const task = chain<number>().task(dedupe(mapper(2)));
  const fn = vi.fn();

  task.watch(handler("t"));
  task.done.watch(handler("td"));

  task(10).then(fn);
  await delay(50);
  task(10).then(fn);
  await delay(50);
  task(20).then(fn);
  await delay(50);
  task(10).then(fn);

  expect(res).toBe("t-10 t-10 t-20");
  await delay();
  expect(res).toBe("t-10 t-10 t-20 t-10");
  await delay(50);
  expect(res).toBe("t-10 t-10 t-20 t-10 td-20");
  await delay(100);
  expect(res).toBe("t-10 t-10 t-20 t-10 td-20 td-40");
  expect(fn).toHaveBeenCalledTimes(4);

  res = "";
});

const request = ({ n }: { n: number }) =>
  new Promise((resolve) => setTimeout(() => resolve(n), 200));

test("dedupe compare", async () => {
  const fn = vi.fn();

  const task1 = chain<{ n: number }>().task(dedupe(request));
  task1.done.watch(handler("t1"));

  const task2 = chain<{ n: number }>().task(
    dedupe(request, (a, b) => a.n === b.n),
  );
  task2.done.watch(handler("t2"));

  task1({ n: 10 }).then(fn);
  await delay(50);
  task1({ n: 10 }).then(fn);
  await delay(201);
  expect(res).toBe("t1-10 t1-10");
  res = "";

  task2({ n: 10 }).then(fn);
  await delay(50);
  task2({ n: 20 }).then(fn);
  await delay(50);
  task2({ n: 10 }).then(fn);
  await delay(201);
  expect(res).toBe("t2-10 t2-20");
  expect(fn).toHaveBeenCalledTimes(5);
  res = "";
});
