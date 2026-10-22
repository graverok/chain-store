import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const entry = fileURLToPath(new URL("./src/index.ts", import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry,
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
  },
  plugins: [dts({ insertTypesEntry: true })],
});
