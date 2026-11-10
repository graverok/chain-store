import { readFileSync } from "node:fs";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { minify } from "oxc-minify";

const parseSize = (value) =>
  value >= 1000 ? `${(value / 1000).toFixed(2)} kB` : `${value} bytes`;

async function measure(files) {
  const minifiedFiles = await Promise.all(
    files.map(async (file) => {
      const result = await minify(file, readFileSync(file, "utf8"));
      if (!result.code) throw new Error(`Не удалось минифицировать ${file}`);
      return Buffer.from(result.code);
    }),
  );

  const minifiedBytes = minifiedFiles.reduce(
    (sum, file) => sum + file.length,
    0,
  );
  const gzippedBytes = minifiedFiles.reduce(
    (sum, file) => sum + gzipSync(file).length,
    0,
  );
  const brotliBytes = minifiedFiles.reduce(
    (sum, file) => sum + brotliCompressSync(file).length,
    0,
  );

  return {
    minified: parseSize(minifiedBytes),
    gzipped: parseSize(gzippedBytes),
    brotli: parseSize(brotliBytes),
  };
}

const core = "./dist/index.js";
const plugins = ["react", "preact", "solid", "vue", "angular"];
const titles = [
  "react:\t  ",
  "preact:\t  ",
  "solid:\t  ",
  "vue:\t  ",
  "angular:  ",
];

const coreSize = await measure([core]);
console.log("--------------------------------------------------------");
console.log(
  `core:\t  ${coreSize.minified} min \t${coreSize.gzipped} gzip \t${coreSize.brotli} brotli`,
);

for (let i = 0; i < plugins.length; i++) {
  const size = await measure([core, `./dist/${plugins[i]}/index.js`]);
  console.log(
    `${titles[i]}${size.minified} min \t${size.gzipped} gzip \t${size.brotli} brotli`,
  );
}

const toolSize = await measure(["./dist/tools/index.js"]);
console.log(
  `tools:\t  ${toolSize.minified} min \t${toolSize.gzipped} gzip \t${toolSize.brotli} brotli`,
);
