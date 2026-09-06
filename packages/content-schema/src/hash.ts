import { createHash } from "node:crypto";

/** Stable hash of any JSON-serialisable value: keys sorted, so key order never changes the hash. */
export function stableHash(value: unknown, extra = ""): string {
  return createHash("sha256")
    .update(canonical(value))
    .update(extra)
    .digest("hex")
    .slice(0, 32);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
