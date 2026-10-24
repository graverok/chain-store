import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        ".": resolve(__dirname, "src/index.ts"),
        preact: resolve(__dirname, "src/preact/index.ts"),
        react: resolve(__dirname, "src/react/index.ts"),
        vue: resolve(__dirname, "src/vue/index.ts"),
        solid: resolve(__dirname, "src/solid/index.ts"),
        angular: resolve(__dirname, "src/angular/index.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        entryName === "."
          ? format === "es"
            ? "index.js"
            : "index.cjs"
          : format === "es"
            ? `${entryName}/index.js`
            : `${entryName}/index.cjs`,
    },
    rolldownOptions: {
      external: [
        "react",
        "preact/hooks",
        "vue",
        "solid-js",
        "../index.js",
        "@angular/core",
      ],
      output: {
        globals: {
          react: "React",
        },
      },
    },
  },
  plugins: [dts()],
});
