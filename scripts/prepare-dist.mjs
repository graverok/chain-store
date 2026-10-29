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
const keywords = distPackage.keywords;

Object.assign(distPackage, {
  keywords: [...keywords, ...plugins],
  type: "module",
  main: "./index.cjs",
  module: "./index.js",
  types: "./index.d.ts",
  exports: {
    ".": {
      types: "./index.d.ts",
      import: "./index.js",
      require: "./index.js",
    },
  },
  files: [
    "index.js",
    "index.cjs",
    "index.d.ts",
    "store.d.ts",
    "types.d.ts",
    "utils.d.ts",
    "README.md",
  ],
});

await writeFile(
  new URL("../dist/package.json", import.meta.url),
  `${JSON.stringify(distPackage, null, 2)}\n`,
);

for (const file of ["LICENSE"]) {
  try {
    for (const dist of ["dist", ...plugins.map((plugin) => `dist/${plugin}`)]) {
      await copyFile(
        new URL(`../${file}`, import.meta.url),
        new URL(`../${dist}/${file}`, import.meta.url),
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

for (const src of ["", ...plugins.map((plugin) => `/${plugin}`)]) {
  try {
    await copyFile(
      new URL(`../src${src}/README.md`, import.meta.url),
      new URL(`../dist${src}/README.md`, import.meta.url),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

for (const plugin of plugins) {
  try {
    let adapterPackage = JSON.parse(
      await readFile(
        new URL(`../src/${plugin}/package.json`, import.meta.url),
        "utf8",
      ),
    );

    adapterPackage = Object.fromEntries(
      fieldsToKeep
        .filter((key) => adapterPackage[key] !== undefined)
        .map((key) => [key, adapterPackage[key]]),
    );

    const content = {
      ...distPackage,
      keywords: [...keywords, plugin],
      ...adapterPackage,
      exports: {
        ".": {
          types: "./index.d.ts",
          import: "./index.js",
          require: "./index.cjs",
        },
      },
      files: ["index.js", "index.cjs", "index.d.ts", "README.md"],
    };

    await writeFile(
      new URL(`../dist/${plugin}/package.json`, import.meta.url),
      `${JSON.stringify(content, null, 2)}\n`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
