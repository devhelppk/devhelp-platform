import { transform } from "sucrase";
import { createHarness } from "./harness.ts";
import type { FileMap, RunOutcome } from "./types.ts";

/**
 * Transpile TS/JS with Sucrase, evaluate the files as a tiny CommonJS-style
 * module table, alias "vitest" to the harness, run the tests, collect results.
 * Pure: no DOM, no Node APIs; used verbatim by the Worker and by Node.
 */
export async function runJs(input: {
  files: FileMap;
  testFiles: FileMap;
  timeoutMs?: number;
}): Promise<RunOutcome> {
  const started = Date.now();
  const logs: string[] = [];
  const harness = createHarness();
  // Layout mirrors the content repo: starter/* is the learner's code, tests/* imports it as ../starter/x.
  const modules = new Map<string, string>();
  for (const [name, code] of Object.entries(input.files))
    modules.set(`starter/${name}`, code);
  for (const [name, code] of Object.entries(input.testFiles))
    modules.set(`tests/${name}`, code);

  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const capture =
    (level: string) =>
    (...args: unknown[]) =>
      logs.push(
        `[${level}] ${args.map((a) => (typeof a === "string" ? a : safeJson(a))).join(" ")}`,
      );
  const fakeConsole = {
    log: capture("log"),
    error: capture("error"),
    warn: capture("warn"),
    info: capture("info"),
  };

  function resolve(from: string, spec: string): string {
    if (spec === "vitest") return "vitest";
    if (!spec.startsWith("."))
      throw new Error(
        `Cannot import "${spec}": only relative imports and "vitest" are available in exercises`,
      );
    const base = from.split("/").slice(0, -1);
    for (const seg of spec.split("/")) {
      if (seg === ".") continue;
      if (seg === "..") base.pop();
      else base.push(seg);
    }
    const path = base.join("/");
    const candidates = [
      path,
      `${path}.ts`,
      `${path}.tsx`,
      `${path}.js`,
      `${path}.jsx`,
      `${path}/index.ts`,
    ];
    const found = candidates.find((c) => modules.has(c));
    if (!found)
      throw new Error(
        `Cannot find module "${spec}" (from ${from}). Files: ${[...modules.keys()].join(", ")}`,
      );
    return found;
  }

  function load(id: string): Record<string, unknown> {
    if (id === "vitest")
      return harness.api as unknown as Record<string, unknown>;
    const hit = cache.get(id);
    if (hit) return hit.exports;
    const source = modules.get(id)!;
    const isTs = /\.tsx?$/.test(id);
    const { code } = transform(source, {
      transforms: isTs
        ? [
            "typescript",
            "imports",
            ...(id.endsWith("x") ? ["jsx" as const] : []),
          ]
        : ["imports", ...(id.endsWith("x") ? ["jsx" as const] : [])],
      filePath: id,
      disableESTransforms: true,
    });
    const mod = { exports: {} as Record<string, unknown> };
    cache.set(id, mod);
    const require = (spec: string) => load(resolve(id, spec));
    const fn = new Function(
      "exports",
      "require",
      "module",
      "console",
      `${code}\n//# sourceURL=${id}`,
    ) as (
      e: Record<string, unknown>,
      r: (s: string) => unknown,
      m: { exports: Record<string, unknown> },
      c: typeof fakeConsole,
    ) => void;
    fn(mod.exports, require, mod, fakeConsole);
    return mod.exports;
  }

  try {
    for (const id of modules.keys()) if (id.startsWith("tests/")) load(id);
  } catch (e) {
    return {
      results: [],
      passed: false,
      logs,
      durationMs: Date.now() - started,
      fatal: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }
  if (harness.count() === 0) {
    return {
      results: [],
      passed: false,
      logs,
      durationMs: Date.now() - started,
      fatal: "No tests were registered.",
    };
  }
  const results = await harness.run(input.timeoutMs ?? 2000);
  return {
    results,
    passed: results.length > 0 && results.every((r) => r.passed),
    logs,
    durationMs: Date.now() - started,
  };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}
