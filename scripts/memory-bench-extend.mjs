import { chain } from "../dist/index.js";
const COUNT = 10000;

const save = () => {
  global.gc();
  return process.memoryUsage().heapUsed;
};

let chains = [];

globalThis.__benchKeepAlive = { chains };
const mapper = (n) => n + 2;

let before = save();
for (let i = 0; i < COUNT; i++) {
  chains.push(chain());
}
const mem_chains = Math.round((save() - before) / COUNT);
for (let i = 0; i < COUNT; i++) {
  chains[i] = chains[i].map(mapper);
}
const mem_maps = Math.round((save() - before) / COUNT);
for (let i = 0; i < COUNT; i++) {
  chains[i] = chains[i].filter(mapper);
}
const mem_filters = Math.round((save() - before) / COUNT);
for (let i = 0; i < COUNT; i++) {
  chains[i] = chains[i].task(mapper);
}
const mem_tasks = Math.round((save() - before) / COUNT);

delete globalThis.__benchKeepAlive;
console.log("--------------------------------------------------------");
console.log(
  `extend:\t  chain(${mem_chains}).map(+${mem_maps - mem_chains}).filter(+${mem_filters - mem_maps}).task(+${mem_tasks - mem_filters})`,
);
