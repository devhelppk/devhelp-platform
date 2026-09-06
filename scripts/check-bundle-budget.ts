#!/usr/bin/env tsx
/**
 * Fail when a page's first-load JavaScript exceeds its budget (N1.1).
 * Measures what the browser actually loads: fetches the rendered HTML from a
 * running production server, collects every `<script src="/_next/…">`, and
 * sums the gzipped transfer sizes. Usage:
 *   BUDGET_URL=http://localhost:3001 tsx scripts/check-bundle-budget.ts [--json]
 */
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

export type Budget = { path: string; maxKb: number };
/**
 * Budgets are gzipped first-load JS. Founder decision (S3): target 250 KB per
 * page with 50 KB headroom, so the enforced ceiling is 300 KB. Next 16 + React
 * alone measure ~155 KB on an empty route; the limit exists to catch regressions,
 * not to drive quality trade-offs. Current: lesson ~222 KB, catalogue ~190 KB.
 */
export const TARGET_KB = 250;
export const CEILING_KB = 300;
export const budgets: Budget[] = [
  { path: "/courses/ai-engineering-foundations/welcome", maxKb: CEILING_KB },
  // Quiz and exercise shells: runners and editors load after hydration and are not counted.
  {
    path: "/courses/ai-engineering-foundations/foundations-check",
    maxKb: CEILING_KB,
  },
  {
    path: "/courses/ai-engineering-foundations/trace-the-refund",
    maxKb: CEILING_KB,
  },
  { path: "/courses", maxKb: CEILING_KB },
  { path: "/", maxKb: CEILING_KB },
];

export async function measure(baseUrl: string, list: Budget[] = budgets) {
  const results = [];
  for (const b of list) {
    const res = await fetch(new URL(b.path, baseUrl));
    const html = await res.text();
    const scripts = [
      ...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g),
    ].map((m) => m[1]!);
    let bytes = 0;
    for (const src of scripts) {
      const js = await fetch(new URL(src, baseUrl));
      if (!js.ok) continue;
      bytes += gzipSync(Buffer.from(await js.arrayBuffer())).byteLength;
    }
    const kb = Math.round((bytes / 1024) * 10) / 10;
    results.push({
      ...b,
      status: res.status,
      scripts: scripts.length,
      kb,
      ok: res.ok && kb <= b.maxKb,
    });
  }
  return results;
}

async function main() {
  const baseUrl = process.env.BUDGET_URL ?? "http://localhost:3001";
  const results = await measure(baseUrl);
  if (process.argv.includes("--json"))
    console.log(JSON.stringify(results, null, 2));
  else
    for (const r of results)
      console.log(
        `${r.ok ? "ok  " : "FAIL"} ${r.path}  ${r.kb} KB gz (target ${TARGET_KB}, ceiling ${r.maxKb})  ${r.kb > TARGET_KB ? "over target" : ""} (${r.scripts} scripts, HTTP ${r.status})`,
      );
  if (results.some((r) => !r.ok)) process.exit(1);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
