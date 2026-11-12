import { chain } from "../dist/index.js";
const COUNT = 20000;

const save = () => {
  global.gc();
  return process.memoryUsage().heapUsed;
};

let chains = [];
let maps = [];
let filters = [];
let tasks = [];

globalThis.__benchKeepAlive = { chains, maps, filters, tasks };
const mapper = (n) => n + 2;

let before = save();
for (let i = 0; i < COUNT; i++) {
  chains[i] = chain();
}
const mem_chains = Math.round((save() - before) / COUNT);
for (let i = 0; i < COUNT; i++) {
  maps[i] = chains[0].map(mapper);
}
const mem_maps = Math.round((save() - before) / COUNT);
for (let i = 0; i < COUNT; i++) {
  filters[i] = maps[0].filter(mapper);
}
const mem_filters = Math.round((save() - before) / COUNT);
for (let i = 0; i < COUNT; i++) {
  tasks[i] = filters[0].task(mapper);
}
const mem_tasks = Math.round((save() - before) / COUNT);

delete globalThis.__benchKeepAlive;
console.log(
  `add:\t  chain(${mem_chains}).map(+${mem_maps - mem_chains}).filter(+${mem_filters - mem_maps}).task(+${mem_tasks - mem_filters})`,
);
