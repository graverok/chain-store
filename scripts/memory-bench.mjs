import { chain } from "../dist/index.js";
const COUNT = 10000;

const save = () => {
  global.gc();
  return process.memoryUsage().heapUsed;
};

const basics = [];
const mappers = [];
const tasks = [];

globalThis.__benchKeepAlive = { basics, mappers, tasks };
const mapper = (n) => n + 2;

let before = save();

for (let i = 0; i < COUNT; i++) {
  basics.push(chain());
}
const base = save() - before;

for (let i = 0; i < COUNT; i++) {
  mappers.push(chain().map(mapper));
}
const mapped = save() - base;

for (let i = 0; i < COUNT; i++) {
  tasks.push(chain().task(mapper));
}
const task = save() - mapped;

delete globalThis.__benchKeepAlive;

console.log(
  `base: ${Math.round(base / COUNT)}`,
  `\tchain cost: ${Math.round((mapped - base) / COUNT)}`,
  `\ttask cost: ${Math.round((task - base) / COUNT)}`,
);
console.log(" ");
