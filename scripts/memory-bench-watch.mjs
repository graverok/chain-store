import { chain } from "../dist/index.js";
const COUNT = 10000;

const save = () => {
  global.gc();
  return process.memoryUsage().heapUsed;
};

let actions = [];
let tasks = [];
const chains = [];

globalThis.__benchKeepAlive = { actions, tasks, chains };
const mapper = (n) => n + 2;

for (let i = 0; i < COUNT; i++) {
  chains.push(chain());
}

let before = save();
for (let i = 0; i < COUNT; i++) {
  actions.push(chains[i].watch(mapper));
}
const mem_actions = Math.round((save() - before) / COUNT);

for (let i = 0; i < COUNT; i++) {
  chains[i] = chains[i].task(mapper);
}
before = save();
for (let i = 0; i < COUNT; i++) {
  tasks.push(chains[i].watch(mapper));
}
const mem_tasks = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  tasks.push(chains[i].done.watch(mapper));
}
const mem_tasks_done = Math.round((save() - before) / COUNT);

before = save();
for (let i = 0; i < COUNT; i++) {
  tasks.push(chains[i].fail.watch(mapper));
}
const mem_tasks_fail = Math.round((save() - before) / COUNT);

delete globalThis.__benchKeepAlive;
console.log(
  `watch:\t  action(${mem_actions}) task(${mem_tasks}/${mem_tasks_done}/${mem_tasks_fail})`,
);
