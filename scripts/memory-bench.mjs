import { chain } from "../dist/index.js";
const COUNT = 10000;

const save = () => {
  global.gc();
  return process.memoryUsage().heapUsed;
};

const chains = [];
const maps = [];
const tasks = [];

globalThis.__benchKeepAlive = { basics: chains, mappers: maps, tasks };
const mapper = (n) => n + 2;

let before = save();

for (let i = 0; i < COUNT; i++) {
  chains.push(chain());
}
const mem_chains = save() - before;

for (let i = 0; i < COUNT; i++) {
  maps.push(chain().map(mapper));
}
const mem_maps = save() - mem_chains;

for (let i = 0; i < COUNT; i++) {
  tasks.push(chain().task(mapper));
}
const meme_tasks = save() - mem_maps;

delete globalThis.__benchKeepAlive;

console.log("--------------------------------------------------------");
console.log(
  `memory:\t  chain(${Math.round(mem_chains / COUNT)}).map(${Math.round((mem_maps - mem_chains) / COUNT)}).task(${Math.round((meme_tasks - mem_chains) / COUNT)})`,
);
console.log("--------------------------------------------------------");
