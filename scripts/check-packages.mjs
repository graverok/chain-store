// check-attw.mjs
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

const FOLDERS = [
  "./dist",
  "./dist/tools",
  "./dist/react",
  "./dist/preact",
  "./dist/vue",
  "./dist/solid",
  "./dist/angular",
];

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

async function hasPackageJson(dir) {
  try {
    await access(path.join(dir, "package.json"));
    return true;
  } catch {
    return false;
  }
}

async function checkFolder(dir) {
  const absDir = path.resolve(dir);

  if (!(await hasPackageJson(absDir))) {
    return { dir: absDir, status: "skipped", output: "package.json не найден" };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      NPX,
      ["--yes", "@arethetypeswrong/cli", "--pack", "."],
      { cwd: absDir, maxBuffer: 10 * 1024 * 1024 },
    );
    const output = `${stdout}${stderr}`.trim();
    if (!output) {
      return {
        dir: absDir,
        status: "failed",
        output: "Код 0, но вывод пустой. Проверьте вручную.",
      };
    }
    return { dir: absDir, status: "ok", output };
  } catch (err) {
    const output = [
      `exit code: ${err.code ?? "unknown"}`,
      err.stdout,
      err.stderr,
      err.code === "ENOENT" ? "npx не найден в PATH" : err.message,
    ]
      .filter(Boolean)
      .join("\n");
    return { dir: absDir, status: "failed", output };
  }
}

let hasFailures = false;
for (const folder of FOLDERS) {
  const result = await checkFolder(folder);
  hasFailures = hasFailures || result.status === "failed";
  console.log(`${result.status.toUpperCase()}\t ${folder}`);
}
process.exitCode = hasFailures ? 1 : 0;
