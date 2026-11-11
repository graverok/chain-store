import { store, chain } from "../dist/index.js";
const COUNT = 20000;
const mapper = (n) => n + 2;

const save = () => {
  global.gc();
  return process.memoryUsage().heapUsed;
};

const $store = store(1);
const action = chain();
const task = action.task((m) => m);
globalThis.__benchKeepAlive = { $store, action, task };
globalThis.__benchKeepAlive.dispose = null;
globalThis.__benchKeepAlive.$part = null;

let before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = $store.watch((n) => n);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.dispose = null;
const store_watch = save() - before;

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.$part = $store.map(mapper);
  globalThis.__benchKeepAlive.$part.off();
}
globalThis.__benchKeepAlive.$part = null;
const store_map_off = save() - before;

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = action.watch((n) => n);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.watch = null;
const action_watch = save() - before;

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = task.watch((n) => n);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.watch = null;
const task_watch = save() - before;

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = task.done.watch((n) => n);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.watch = null;
const task_done_watch = save() - before;

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.mapped = action.map(mapper);
}
globalThis.__benchKeepAlive.mapped = null;
const action_map_release = save() - before;
delete globalThis.__benchKeepAlive;
console.log(
  `leaks:\t  store.map.off(${Math.round(store_map_off / COUNT)}), chain.map#nullify(+${Math.round(action_map_release / COUNT)})`,
);
console.log(
  `\t  store.watch(${Math.round(store_watch / COUNT)}) chain.watches(${Math.round(action_watch / COUNT)}/${Math.round(task_watch / COUNT)}/${Math.round(task_done_watch / COUNT)})`,
);

console.log("--------------------------------------------------------");
