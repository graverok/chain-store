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
  "sideEffects",
  "type",
  "dependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "optionalDependencies",
];

const distPackage = Object.fromEntries(
  fieldsToKeep
    .filter((key) => rootPackage[key] !== undefined)
    .map((key) => [key, rootPackage[key]]),
);

const plugins = ["react", "preact", "solid", "vue", "angular"];

const importData = {
  main: "./index.cjs",
  module: "./index.js",
  types: "./index.d.ts",
  exports: {
    ".": {
      import: { types: "./index.d.ts", default: "./index.js" },
      require: { types: "./index.d.cts", default: "./index.cjs" },
    },
  },
};

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

for (const src of ["", "/tools", ...plugins.map((plugin) => `/${plugin}`)]) {
  const replacements = [
    [
      /(?<!\[)\*\*chain-store\*\*/g,
      "[**chain-store**](https://npmjs.com/package/chain-store)",
    ],
    [
      /(?<!\[)\*\*Tools\*\*/g,
      "[**Tools**](https://www.npmjs.com/package/@chain-store/tools)",
    ],
  ];

  try {
    let readme = await readFile(
      new URL(`../src${src}/README.md`, import.meta.url),
      "utf8",
    );
    readme = readme.replace(replacements[0][0], replacements[0][1]);
    src !== "/tools" &&
      (readme = readme.replace(replacements[1][0], replacements[1][1]));
    await writeFile(
      new URL(`../dist${src}/README.md`, import.meta.url),
      readme,
      "utf8",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const keywords = distPackage.keywords;
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
      ...adapterPackage,
      keywords: [...keywords, plugin],
      ...importData,
      files: [
        "index.js",
        "index.cjs",
        "index.d.ts",
        "index.d.cts",
        "README.md",
      ],
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
    ...distPackage,
    ...toolsPackage,
    ...importData,
    files: [
      "index.d.cts",
      "index.d.ts",
      "index.js",
      "index.cjs",
      "README.md",
      "log.d.ts",
      "log.d.cts",
      "sync.d.ts",
      "sync.d.cts",
      "dedupe.d.ts",
      "dedupe.d.cts",
      "supersede.d.ts",
      "supersede.d.cts",
      "throttle.d.ts",
      "throttle.d.cts",
      "debounce.d.ts",
      "debounce.d.cts",
    ],
  };

  await writeFile(
    new URL(`../dist/tools/package.json`, import.meta.url),
    `${JSON.stringify(content, null, 2)}\n`,
  );
} catch {}

Object.assign(distPackage, {
  keywords: [...distPackage.keywords, ...plugins],
  ...importData,
  files: [
    "chain.d.ts",
    "chain.d.cts",
    "index.d.ts",
    "index.d.cts",
    "index.js",
    "index.cjs",
    "lib.d.ts",
    "lib.d.cts",
    "README.md",
    "store.d.ts",
    "store.d.cts",
    "types.d.ts",
    "types.d.cts",
  ],
});

await writeFile(
  new URL("../dist/package.json", import.meta.url),
  `${JSON.stringify(distPackage, null, 2)}\n`,
);
