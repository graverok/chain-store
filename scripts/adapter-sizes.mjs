import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const core = "./dist/index.cjs";
const plugins = ["react", "preact", "solid", "vue", "angular"];

const content = readFileSync(core);
console.log(
  `core: ${(content.length / 1000).toFixed(2)} kB minified, ${gzipSync(content).length} bytes gzipped`,
);

for (const plugin of plugins) {
  const files = [core, `./dist/${plugin}/index.cjs`];
  const contents = Buffer.concat(files.map((file) => readFileSync(file)));
  const minifiedKB = (contents.length / 1000).toFixed(2);
  const gzippedKB = (gzipSync(contents).length / 1000).toFixed(2);
  console.log(`${plugin}: ${minifiedKB} kB minified, ${gzippedKB} kB gzipped`);
}
