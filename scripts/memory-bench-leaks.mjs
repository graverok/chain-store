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
  $store.watch(mapper);
}
$store.off();
const store_watch1 = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = $store.watch(mapper);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.$part = null;
const store_watch2 = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.$part = $store.map(mapper);
  globalThis.__benchKeepAlive.$part.off();
}
globalThis.__benchKeepAlive.$part = null;
const store_map_off = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = action.watch(mapper);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.watch = null;
const action_watch = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = task.watch(mapper);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.watch = null;
const task_watch = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.dispose = task.done.watch(mapper);
  globalThis.__benchKeepAlive.dispose();
}
globalThis.__benchKeepAlive.watch = null;
const task_done_watch = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  globalThis.__benchKeepAlive.mapped = action.map(mapper);
}
globalThis.__benchKeepAlive.mapped = null;
const action_map_release = Math.round((save() - before) / COUNT);
delete globalThis.__benchKeepAlive;
console.log(
  `leaks:\t  store.map.off(${store_map_off}), chain.map#nullify(+${action_map_release})`,
);
console.log(
  `\t  store.watch(${[store_watch1, store_watch2].join("/")}) chain.watches(${[action_watch, task_watch, task_done_watch].join("/")})`,
);

console.log("--------------------------------------------------------");
