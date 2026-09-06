import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { LoadedExercise } from "./load.ts";

export type ExerciseRun = { passed: boolean; output: string };

/**
 * Run an exercise's tests against a set of files (starter or solution) in a
 * scratch directory using vitest. JavaScript/TypeScript only (founder
 * decision at the end of S4: no other exercise languages).
 */
export function runExerciseTests(
  ex: LoadedExercise,
  files: Record<string, string>,
  opts: { vitestBin?: string } = {},
): ExerciseRun {
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
