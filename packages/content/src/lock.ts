import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

export const contentLock = z
  .object({
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "owner/name"),
    ref: z.string().min(1),
    sha: z.string().regex(/^[0-9a-f]{40}$/, "full commit sha"),
  })
  .strict();
export type ContentLock = z.infer<typeof contentLock>;

/** Walk up from cwd to the workspace root (pnpm-workspace.yaml). */
export function findRepoRoot(from = process.cwd()): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error("pnpm-workspace.yaml not found above " + from);
    dir = parent;
  }
}

export function readLock(root = findRepoRoot()): ContentLock {
  return contentLock.parse(
    JSON.parse(readFileSync(join(root, "content.lock.json"), "utf8")),
  );
}

/** Where pulled content lives: `<root>/.content`. */
export function pulledContentDir(root = findRepoRoot()): string {
  return join(root, ".content");
}

/**
 * Where content is read from. `CONTENT_DIR` (a sibling checkout while authoring)
 * overrides; a relative value resolves from the repo root, and an empty value
 * counts as unset, so every tool agrees on one directory.
 */
export function contentDir(root = findRepoRoot()): string {
  const override = process.env.CONTENT_DIR?.trim();
  return override ? resolve(root, override) : pulledContentDir(root);
}
