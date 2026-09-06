import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkContent, hasErrors } from "../src/check.ts";
import { runExerciseTests } from "../src/exercise-runner.ts";
import { loadContentTree, stableHash } from "../src/index.ts";

const fixture = (name: string) =>
  resolve(import.meta.dirname, "fixtures", name);
const vitestBin = resolve(import.meta.dirname, "../node_modules/.bin/vitest");
const rules = (name: string) =>
  checkContent(loadContentTree(fixture(name)))
    .filter((d) => d.level === "error")
    .map((d) => d.rule);

describe("loadContentTree", () => {
  it("reads courses, modules, lessons in numeric order with slugs from frontmatter", () => {
    const tree = loadContentTree(fixture("valid"));
    expect(tree.diagnostics).toEqual([]);
    expect(tree.courses.map((c) => c.meta.slug)).toEqual(["c1"]);
    const lessons = tree.courses[0]!.modules[0]!.lessons;
    expect(lessons.map((l) => l.meta.slug)).toEqual(["intro", "check"]);
    expect(lessons.map((l) => l.order)).toEqual([1, 2]);
    expect(
      lessons[1]!.meta.type === "quiz" && lessons[1]!.meta.completionRule,
    ).toBe("quiz_pass");
    expect(tree.paths[0]!.data.courses).toEqual(["c1"]);
  });

  it("reports a missing courses directory and a missing order prefix", () => {
    const missing = loadContentTree(fixture("does-not-exist"));
    expect(missing.diagnostics.map((d) => d.rule)).toContain("structure");
    const tree = loadContentTree(fixture("invalid-order"));
    expect(tree.diagnostics.map((d) => d.rule)).toContain("order-prefix");
  });

  it("keeps an unquoted YAML date in frontmatter as a string", () => {
    const tree = loadContentTree(fixture("valid"));
    const intro = tree.courses[0]!.modules[0]!.lessons[0]!;
    expect(intro.meta.updated).toBe("2026-09-01");
  });

  it("hashes are stable regardless of key order", () => {
    expect(stableHash({ a: 1, b: [1, 2] })).toBe(
      stableHash({ b: [1, 2], a: 1 }),
    );
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});

describe("checkContent", () => {
  it("passes valid content", () => {
    const d = checkContent(loadContentTree(fixture("valid")));
    expect(hasErrors(d)).toBe(false);
  });
  it("fails a single-choice question without exactly one correct option", () => {
    expect(rules("invalid-quiz")).toContain("answer");
  });
  it("fails a broken internal link", () => {
    expect(rules("invalid-link")).toContain("link");
  });
  it("fails a completion rule that does not match the lesson type", () => {
    expect(rules("invalid-rule")).toContain("completion-rule");
  });
  it("fails when the exercise solution does not pass its tests", () => {
    const d = checkContent(loadContentTree(fixture("invalid-exercise")), {
      runExercises: (ex, files) => runExerciseTests(ex, files, { vitestBin }),
    });
    expect(d.filter((x) => x.level === "error").map((x) => x.rule)).toContain(
      "tests",
    );
  }, 60_000);
});
