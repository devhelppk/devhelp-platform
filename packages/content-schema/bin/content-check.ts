#!/usr/bin/env tsx
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkContent, hasErrors } from "../src/check.ts";
import { runExerciseTests } from "../src/exercise-runner.ts";
import { loadContentTree } from "../src/index.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
// An explicit path resolves from where the command was typed (INIT_CWD under pnpm);
// CONTENT_DIR and the default `.content` resolve from the repo root, like every other tool.
const invokedFrom = process.env.INIT_CWD ?? process.cwd();
const repoRoot = (() => {
  let d = invokedFrom;
  while (!existsSync(join(d, "pnpm-workspace.yaml")) && dirname(d) !== d)
    d = dirname(d);
  return d;
})();
const explicit = args.find((a) => !a.startsWith("--"));
const dir = explicit
  ? resolve(invokedFrom, explicit)
  : resolve(repoRoot, process.env.CONTENT_DIR?.trim() || ".content");

const tree = loadContentTree(dir);
const diagnostics = checkContent(tree, {
  runExercises: args.includes("--no-exercises")
    ? undefined
    : (ex, files) =>
        runExerciseTests(ex, files, { vitestBin: process.env.VITEST_BIN }),
});
const errors = diagnostics.filter((d) => d.level === "error").length;
const warnings = diagnostics.length - errors;

if (json) {
  console.log(
    JSON.stringify(
      { dir, courses: tree.courses.length, errors, warnings, diagnostics },
      null,
      2,
    ),
  );
} else {
  for (const d of diagnostics) {
    const tag = d.level === "error" ? "ERROR" : "warn ";
    console.log(
      `${tag}  ${d.file}${d.line ? `:${d.line}` : ""}  [${d.rule}] ${d.message}`,
    );
  }
  console.log(
    `\n${tree.courses.length} course(s), ${tree.paths.length} path(s): ${errors} error(s), ${warnings} warning(s)`,
  );
}
process.exit(hasErrors(diagnostics) ? 1 : 0);
