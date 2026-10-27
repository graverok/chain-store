import { expect, test } from "vitest";
import { chain, store } from "../src";
import { delay, mapper } from "./utils";

let res: string = "";
const handler = (p: string) => (r: any) => {
  res = (res + ` ${p}-${r}`).trim();
};

test("store", async () => {
  const fn1 = chain<number>();
  const act1 = fn1.task(mapper(2));
  const $store = store(0);

  $store.on(fn1, (state, n) => state + n).on(act1.done, (_, result) => result);

  $store.watch(handler("s"));
  res = "";

  fn1(0);
  expect(res).toBe("");
  expect($store.get()).toBe(0);

  fn1(1);
  expect(res).toBe("s-1");
  expect($store.get()).toBe(1);

  fn1(5);
  expect(res).toBe(`s-1 s-6`);
  expect($store.get()).toBe(6);

  $store.off(fn1);

  fn1(10);
  expect(res).toBe(`s-1 s-6`);
  expect($store.get()).toBe(6);

  await delay();
  await delay(300);

  expect(res).toBe(`s-1 s-6 s-0 s-2 s-10 s-20`);
  expect($store.get()).toBe(20);
  res = "";

  $store.set(100);
  expect(res).toBe("s-100");
  expect($store.get()).toBe(100);
  res = "";
});

test("store unwatch", async () => {
  const fn1 = chain();
  const $store = store(0);

  $store.on(fn1, (state) => state + 1);

  const unwatch = $store.watch((s) => {
    handler("s")(s);
    if (s === 2) unwatch();
  });
  fn1();
  expect(res).toBe("s-0 s-1");
  fn1();
  expect(res).toBe("s-0 s-1 s-2");
  fn1();
  expect(res).toBe("s-0 s-1 s-2");

  $store.watch((s) => {
    handler("s")(s);
    if (s === 2) unwatch();
  });
  res = "";
  fn1();
  expect(res).toBe("s-4");

  $store.off(fn1);
  fn1();
  expect(res).toBe("s-4");
  res = "";
});

test("store off()", () => {
  const fn1 = chain<number>();
  const fn2 = chain<string>();
  const $store = store({ n: 0, s: "x" })
    .on(fn1, (state, n) => ({ ...state, n }))
    .on(fn2, (state, s) => ({ ...state, s }));

  $store.watch(({ n, s }) => handler("s")(`${n}:${s}`));
  res = "";

  fn1(5);
  fn2("test");

  expect(res).toBe(`s-5:x s-5:test`);
  $store.off();
  fn1(10);
  expect(res).toBe(`s-5:x s-5:test`);
  res = "";

  $store.set({ n: 100, s: "store" });
  expect(res).toBe(`s-100:store`);
  res = "";
});

test("store mutability", async () => {
  type User = { name: string };
  type State = { user: User };
  const state = chain<State>();
  const user = chain<User>();
  const name = chain<string>();

  const $store = store<State>({ user: { name: "aleks" } });

  $store
    .on(state, (_, state) => state)
    .on(user, (state, user: User) => {
      state.user = user;
      return state;
    })
    .on(name, (state: State, name: string) => {
      state.user.name = name;
      return state;
    });

  $store.watch(() => handler("state")("change"));

  const $user = $store.map((state) => state.user);
  $user.watch(() => handler("user")("change"));
  $user.map((state) => state.name).watch(() => handler("name")("change"));
  res = "";

  user({ name: "test" });
  expect(res).toBe(`user-change name-change`);
  res = "";

  name("aleks");
  expect(res).toBe(`name-change`);
  res = "";

  user({ name: "aleks" });
  expect(res).toBe(`user-change`);
  res = "";

  user($user.get());
  expect(res).toBe("");
  res = "";

  state({ user: $user.get() });
  expect(res).toBe(`state-change`);
  res = "";

  state({ user: { name: "aleks" } });
  expect(res).toBe(`state-change user-change`);
  res = "";

  state($store.get());
  expect(res).toBe("");
  res = "";

  $store.set({ user: $user.get() });
  expect(res).toBe("state-change");
  res = "";

  $store.set($store.get());
  expect(res).toBe("");

  $store.set({ user: { name: "aleks" } });
  expect(res).toBe("state-change user-change");
  res = "";
});

test("store subscription", async () => {
  const $name = store("aleks");
  const $user = store({ name: $name.get() });

  const name = chain<string>();
  $name.on(name, (_, name) => name);

  $user.on($name, (state, name) => {
    return { ...state, name };
  });

  name("john");
  expect($name.get()).toEqual("john");
  expect($user.get()).toEqual({ name: "john" });
  res = "";
});

// test("store types", async () => {
//   const $fn = store(() => handler("s1")("run"));
//   const $fnm = $fn.map((s) => s);
//   $fnm.get()();
//
//   expect(typeof $fnm.get()).toBe("function");
//   expect(res).toBe("s1-run");
//   res = "";
//
//   const $num = store(10);
//   const $numm = $num.map((s) => s);
//   expect(typeof $numm.get()).toBe("number");
//
//   const $arr = store([10]);
//   const $arrm = $arr.map((s) => s);
//   expect(Array.isArray($arrm.get())).toBe(true);
//
//   const $date = store(new Date());
//   const $datem = $date.map((s) => s);
//   expect($datem.get() instanceof Date).toBe(true);
//   expect(typeof $datem.get()).toBe("object");
//
//   const $void = store(undefined);
//   const $voidm = $void.map((s) => s);
//   expect($voidm.get()).toBe(undefined);
//   expect(typeof $voidm.get()).toBe("undefined");
//
//   const $null = store(null);
//   const $nullm = $null.map((s) => s);
//   expect($nullm.get()).toBe(null);
//   expect(typeof $nullm.get()).toBe("object");
// });
