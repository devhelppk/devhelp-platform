import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { LoadedExercise } from "./load.ts";

export type ExerciseRun = { passed: boolean; output: string };

/**
 * Run an exercise's tests against a set of files (starter or solution) in a
 * scratch directory using vitest. JavaScript/TypeScript only; Python exercises
 * are syntax-checked by `py_compile` when python3 is available.
 */
export function runExerciseTests(
  ex: LoadedExercise,
  files: Record<string, string>,
  opts: { vitestBin?: string } = {},
): ExerciseRun {
  if (ex.meta.runner === "pyodide") {
    return checkPython(files);
  }
  const dir = mkdtempSync(join(tmpdir(), "devhelp-ex-"));
  try {
    const write = (rel: string, content: string) => {
      const p = join(dir, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
    };
    for (const [name, content] of Object.entries(files))
      write(`starter/${name}`, content);
    for (const [name, content] of Object.entries(ex.testFiles))
      write(`tests/${name}`, content);
    write(
      "vitest.config.mjs",
      "export default { test: { include: ['tests/**/*.test.*'], watch: false } };\n",
    );
    write("package.json", '{ "type": "module" }\n');
    // Default to this package's own vitest so CI and sibling checkouts need no PATH setup.
    const bin =
      opts.vitestBin ??
      resolve(import.meta.dirname, "../node_modules/.bin/vitest");
    const res = spawnSync(bin, ["run", "--root", dir, "--reporter=dot"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, CI: "1" },
      timeout: 60_000,
    });
    const output = `${res.stdout ?? ""}${res.stderr ?? ""}`;
    return { passed: res.status === 0, output };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checkPython(files: Record<string, string>): ExerciseRun {
  const py = spawnSync("python3", ["--version"], { encoding: "utf8" });
  if (py.status !== 0)
    return {
      passed: true,
      output: "python3 not available; syntax check skipped",
    };
  const dir = mkdtempSync(join(tmpdir(), "devhelp-py-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const p = join(dir, name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
    }
    const res = spawnSync(
      "python3",
      ["-m", "py_compile", ...Object.keys(files).map((f) => join(dir, f))],
      {
        encoding: "utf8",
      },
    );
    return {
      passed: res.status === 0,
      output: `${res.stdout ?? ""}${res.stderr ?? ""}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
