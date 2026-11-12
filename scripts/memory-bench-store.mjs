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
const mem_stores = Math.round((save() - before) / COUNT);
for (let i = 0; i < COUNT; i++) {
  parts[i] = stores[0].map(mapper);
}
const mem_parts = Math.round((save() - before) / COUNT);

delete globalThis.__benchKeepAlive;
console.log(`store:\t  store(${mem_stores}).map(+${mem_parts - mem_stores})`);
