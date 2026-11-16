import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dirs = [
  "dist",
  "dist/react",
  "dist/preact",
  "dist/angular",
  "dist/vue",
  "dist/solid",
  "dist/tools",
];

for (const dir of dirs) {
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".d.ts")) continue;

    const source = await readFile(join(dir, file), "utf8");
    const rewritten = source.replace(
      /(from\s+['"]\.{1,2}\/[^'"]+?)\.js(['"])/g,
      "$1.cjs$2",
    );

    await writeFile(join(dir, file.replace(/\.d\.ts$/, ".d.cts")), rewritten);
  }
}
