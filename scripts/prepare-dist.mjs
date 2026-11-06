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
    for (const dist of [
      "dist",
      "dist/tools",
      ...plugins.map((plugin) => `dist/${plugin}`),
    ]) {
      await copyFile(
        new URL(`../${file}`, import.meta.url),
        new URL(`../${dist}/${file}`, import.meta.url),
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

for (const src of [
  "",
  "/tools",
  "/tools/sync",
  "tools/debug",
  ...plugins.map((plugin) => `/${plugin}`),
]) {
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

try {
  let toolsPackage = JSON.parse(
    await readFile(
      new URL(`../src/tools/package.json`, import.meta.url),
      "utf8",
    ),
  );

  toolsPackage = Object.fromEntries(
    fieldsToKeep
      .filter((key) => toolsPackage[key] !== undefined)
      .map((key) => [key, toolsPackage[key]]),
  );

  const content = {
    ...toolsPackage,
    sideEffects: "false",
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
      "debug",
      "sync",
      "index.cjs",
      "index.d.ts",
      "index.js",
      "README.md",
    ],
  };

  await writeFile(
    new URL(`../dist/tools/package.json`, import.meta.url),
    `${JSON.stringify(content, null, 2)}\n`,
  );
} catch {}
