import { readFile, writeFile, copyFile } from "node:fs/promises";

const rootPackage = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

const fieldsToKeep = [
  "name",
  "version",
  "description",
  "keywords",
  "homepage",
  "bugs",
  "repository",
  "license",
  "author",
  "funding",
  "engines",
  "publishConfig",
  "dependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "optionalDependencies",
  "sideEffects",
];

const distPackage = Object.fromEntries(
  fieldsToKeep
    .filter((key) => rootPackage[key] !== undefined)
    .map((key) => [key, rootPackage[key]]),
);

const plugins = ["react", "preact", "solid", "vue", "angular"];

Object.assign(distPackage, {
  version: `${distPackage.version}-dev`,
  keywords: [...distPackage.keywords, ...plugins],
  type: "module",
  main: "./index.cjs",
  module: "./index.js",
  types: "./index.d.ts",
  exports: {
    ".": {
      types: "./index.d.ts",
      import: "./index.js",
      require: "./index.cjs",
    },
  },
  files: [
    "chain.d.ts",
    "index.cjs",
    "index.d.ts",
    "index.js",
    "lib.d.ts",
    "README.md",
    "store.d.ts",
    "types.d.ts",
  ],
});

await writeFile(
  new URL("../dist/package.json", import.meta.url),
  `${JSON.stringify(distPackage, null, 2)}\n`,
);

for (const file of ["LICENSE"]) {
  try {
    await copyFile(
      new URL(`../${file}`, import.meta.url),
      new URL(`../dist/${file}`, import.meta.url),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

try {
  await copyFile(
    new URL(`../src/README.md`, import.meta.url),
    new URL(`../dist/README.md`, import.meta.url),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
