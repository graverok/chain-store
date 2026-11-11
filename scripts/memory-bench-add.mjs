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
const mem_chains = save() - before;
for (let i = 0; i < COUNT; i++) {
  maps[i] = chains[0].map(mapper);
}
const mem_maps = save() - before;
for (let i = 0; i < COUNT; i++) {
  filters[i] = maps[0].filter(mapper);
}
const mem_filters = save() - before;
for (let i = 0; i < COUNT; i++) {
  tasks[i] = filters[0].task(mapper);
}
const mem_tasks = save() - before;

delete globalThis.__benchKeepAlive;
console.log(
  `add:\t  chain(${Math.round(mem_chains / COUNT)}).map(+${Math.round((mem_maps - mem_chains) / COUNT)}).filter(+${Math.round((mem_filters - mem_maps) / COUNT)}).task(+${Math.round((mem_tasks - mem_filters) / COUNT)})`,
);
