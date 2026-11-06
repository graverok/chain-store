import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: false,
    target: "ES2020",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        format === "es" ? "index.js" : "index.cjs",
    },
  },
  plugins: [dts()],
});
