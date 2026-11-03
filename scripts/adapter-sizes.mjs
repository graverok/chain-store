import { readFileSync } from "node:fs";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { minify } from "oxc-minify";

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
    minifiedKB: (minifiedBytes / 1000).toFixed(2),
    gzipped: gzippedBytes,
    brotli: brotliBytes,
  };
}

const core = "./dist/index.cjs";
const plugins = ["react", "preact", "solid", "vue", "angular"];
const titles = [
  "react:\t  ",
  "preact:\t  ",
  "solid:\t  ",
  "vue:\t  ",
  "angular:  ",
];

const coreSize = await measure([core]);
console.log(
  `core:\t  ${coreSize.minifiedKB} kB min \t${coreSize.gzipped} bytes gzip \t${coreSize.brotli} bytes brotli`,
);

for (let i = 0; i < plugins.length; i++) {
  const size = await measure([core, `./dist/${plugins[i]}/index.cjs`]);
  console.log(
    `${titles[i]}${size.minifiedKB} kB min \t${(size.gzipped / 1000).toFixed(2)} kB gzip \t${(size.brotli / 1000).toFixed(2)} kB brotli`,
  );
}
