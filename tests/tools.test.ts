import { expect, test, vi } from "vitest";
import { chain } from "../src";
import { supersede, debounce, dedupe, throttle } from "../src/tools";
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

const abortiveRequest = (params: number, { signal }: { signal: AbortSignal }) =>
  new Promise<number>((resolve, reject) => {
    const tmr = setTimeout(() => {
      resolve(params * 2);
    }, 200);

    const int = setInterval(() => {
      if (signal.aborted) {
        reject("Abort");
        clearTimeout(tmr);
        clearInterval(int);
      }
    }, 30);
  });

test("abortive", async () => {
  const task = chain<number>().task(supersede(abortiveRequest));
  const fail = vi.fn();
  const success = vi.fn();
  const done = vi.fn();

  for (let i = 0; i < 10; i++) {
    task(10).then(success).catch(fail);
    await delay(50);
  }

  task.done.watch((a, b) => {
    done(a + b);
  });
  await delay(200);

  expect(fail).toHaveBeenCalledTimes(9);
  expect(success).toHaveBeenCalledExactlyOnceWith(20);
  expect(done).toHaveBeenCalledExactlyOnceWith(30);
});

test("debounce", async () => {
  const action = chain<number>().map(debounce(200, (n) => n * 2));
  const success = vi.fn();

  action.watch(success);

  for (let i = 0; i < 10; i++) {
    action(10);
    await delay(50);
  }

  await delay(200);
  expect(success).toHaveBeenCalledExactlyOnceWith(20);
});

test("throttle", async () => {
  const action = chain<number>().map(throttle(200, (n) => n * 2));

  action.watch(handler("a1"));

  action(10);
  await delay(50);
  action(15);
  await delay(50);
  action(20);
  await delay(50);
  action(25);
  await delay(50);
  action(30);
  expect(res).toBe("a1-20 a1-50 a1-60");
  action(35);
  await delay(100);
  expect(res).toBe("a1-20 a1-50 a1-60");
  await delay(100);
  expect(res).toBe("a1-20 a1-50 a1-60 a1-70");
  res = "";
});

test("throttle void", async () => {
  const action = chain().map(throttle(200, (n) => n));
  const fn = vi.fn();

  action.watch(fn);

  action();
  await delay(50);
  action();
  await delay(50);
  action();
  await delay(50);
  action();
  await delay(50);
  action();
  action();
  await delay(200);

  expect(fn).toHaveBeenCalledTimes(4);
});
