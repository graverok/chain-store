import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      name: "chain-store",
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "umd"],
      fileName: (format) => `index.${format}.js`,
    },
  },
  plugins: [dts({ insertTypesEntry: true })],
});
