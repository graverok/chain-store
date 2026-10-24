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

const plugins = ["react", "preact", "vue", "solid", "angular"];

Object.assign(distPackage, {
  keywords: [...distPackage.keywords, ...plugins],
  type: "module",
  main: "./index.cjs",
  module: "./index.js",
  types: "./index.d.ts",
  exports: [".", ...plugins.map((p) => `./${p}`)].reduce(
    (acc, path) => ({
      ...acc,
      [path]: {
        types: `${path}/index.d.ts`,
        import: `${path}/index.js`,
        require: `${path}/index.cjs`,
      },
    }),
    {},
  ),
  files: [
    "index.js",
    "index.cjs",
    "index.d.ts",
    "store.d.ts",
    "types.d.ts",
    "utils.d.ts",
    "README.md",
    ...plugins,
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

for (const plugin of ["react", "preact", "vue", "solid"]) {
  try {
    await copyFile(
      new URL(`../src/${plugin}/package.json`, import.meta.url),
      new URL(`../dist/${plugin}/package.json`, import.meta.url),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
