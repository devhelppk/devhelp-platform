import { describe, expect, it } from "vitest";
import { createHarness } from "./harness.ts";
import { runJs } from "./js-runner.ts";

const tests = {
  "add.test.ts": `import { describe, it, expect } from "vitest";
import { add } from "../starter/add";
describe("add", () => {
  it("adds", () => { expect(add(1, 2)).toBe(3); });
  it("objects", () => { expect({ a: 1, b: [1, 2] }).toEqual({ b: [1, 2], a: 1 }); expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }); });
  it("throws", () => { expect(() => add("x" as never, 1)).toThrow(/number/); expect(() => add(1, 1)).not.toThrow(); });
  it("async", async () => { await expect(Promise.resolve(4)).resolves.toBe(4); await expect(Promise.reject(new Error("no"))).rejects.toContain("no"); });
});`,
};

describe("runJs", () => {
  it("passes a correct TypeScript solution with relative imports and the matcher subset", async () => {
    const out = await runJs({
      files: {
        "add.ts": `export function add(a: number, b: number): number { if (typeof a !== "number") throw new Error("a must be a number"); return a + b; }`,
      },
      testFiles: tests,
    });
    expect(out.fatal).toBeUndefined();
    expect(out.results.map((r) => r.passed)).toEqual([true, true, true, true]);
    expect(out.passed).toBe(true);
  });

  it("fails a wrong solution with a readable message and captures console", async () => {
    const out = await runJs({
      files: {
        "add.ts": `export function add(a: number, b: number) { console.log("called", a, b); if (typeof a !== "number") throw new Error("a must be a number"); return a - b; }`,
      },
      testFiles: tests,
    });
    expect(out.passed).toBe(false);
    expect(out.results[0]).toMatchObject({
      passed: false,
      error: expect.stringContaining("expected -1 to be 3"),
    });
    expect(out.logs[0]).toContain("[log] called 1 2");
  });

  it("reports a syntax error and a missing module as fatal, not as a hang", async () => {
    const bad = await runJs({
      files: { "add.ts": "export const add = (a, b) => a +" },
      testFiles: tests,
    });
    expect(bad.fatal).toMatch(/SyntaxError|Unexpected/);
    const missing = await runJs({
      files: { "other.ts": "export const x = 1;" },
      testFiles: tests,
    });
    expect(missing.fatal).toMatch(/Cannot find module/);
  });

  it("times out a test that never resolves", async () => {
    const out = await runJs({
      files: {
        "add.ts": "export const add = (a: number, b: number) => a + b;",
      },
      testFiles: {
        "hang.test.ts": `import { it } from "vitest"; it("hangs", () => new Promise(() => {}));`,
      },
      timeoutMs: 100,
    });
    expect(out.results[0]).toMatchObject({
      passed: false,
      error: expect.stringContaining("timed out"),
    });
  });

  it("refuses non-relative imports other than vitest", async () => {
    const out = await runJs({
      files: { "a.ts": "export const a = 1;" },
      testFiles: {
        "x.test.ts": `import fs from "node:fs"; import { it } from "vitest"; it("x", () => { fs.readFileSync("x"); });`,
      },
    });
    expect(out.fatal).toMatch(/only relative imports/);
  });
});

it("runs beforeEach and afterEach around each test in scope", async () => {
  const h = createHarness();
  const log: string[] = [];
  h.api.beforeEach(() => {
    log.push("outer-before");
  });
  h.api.describe("inner", () => {
    h.api.beforeEach(() => {
      log.push("inner-before");
    });
    h.api.afterEach(() => {
      log.push("inner-after");
    });
    h.api.it("a", () => {
      log.push("a");
    });
  });
  h.api.it("b", () => {
    log.push("b");
  });
  const results = await h.run();
  expect(results.every((r) => r.passed)).toBe(true);
  expect(log).toEqual([
    "outer-before",
    "inner-before",
    "a",
    "inner-after",
    "outer-before",
    "b",
  ]);
});
