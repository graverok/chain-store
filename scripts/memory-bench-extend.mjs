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
const mem_chains = save() - before;
for (let i = 0; i < COUNT; i++) {
  chains[i] = chains[i].map(mapper);
}
const mem_maps = save() - before;
for (let i = 0; i < COUNT; i++) {
  chains[i] = chains[i].filter(mapper);
}
const mem_filters = save() - before;
for (let i = 0; i < COUNT; i++) {
  chains[i] = chains[i].task(mapper);
}
const mem_tasks = save() - before;

delete globalThis.__benchKeepAlive;
console.log("--------------------------------------------------------");
console.log(
  `extend:\t  chain(${Math.round(mem_chains / COUNT)}).map(+${Math.round((mem_maps - mem_chains) / COUNT)}).filter(+${Math.round((mem_filters - mem_maps) / COUNT)}).task(+${Math.round((mem_tasks - mem_filters) / COUNT)})`,
);
