import { mkdir, readdir, rm, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));

for (const entry of await readdir(dist)) {
  if (entry !== "README.md") {
    await rm(join(dist, entry), { recursive: true, force: true });
  }
}
