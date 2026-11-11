import { store } from "../dist/index.js";
const COUNT = 10000;

const save = () => {
  global.gc();
  return process.memoryUsage().heapUsed;
};

const stores = [];
const parts = [];

globalThis.__benchKeepAlive = { stores, parts };
const mapper = (n) => n + 2;

let before = save();
for (let i = 0; i < COUNT; i++) {
  stores[i] = store(1);
}
const mem_stores = save() - before;
for (let i = 0; i < COUNT; i++) {
  parts[i] = stores[0].map(mapper);
}
const mem_parts = save() - before;

delete globalThis.__benchKeepAlive;
console.log(
  `store:\t  store(${Math.round(mem_stores / COUNT)}).map(+${Math.round((mem_parts - mem_stores) / COUNT)})`,
);
