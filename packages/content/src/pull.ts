import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { extract } from "tar";
import {
  findRepoRoot,
  pulledContentDir,
  readLock,
  type ContentLock,
} from "./lock";

/**
 * Download the pinned content commit as a tarball into `.content/`.
 * No git history, no submodule; the sha is recorded in `.content/.sha`.
 */
export async function pullContent(
  opts: { root?: string; lock?: ContentLock; force?: boolean } = {},
) {
  const root = opts.root ?? findRepoRoot();
  const lock = opts.lock ?? readLock(root);
  // Always `.content/`; a CONTENT_DIR checkout is the author's and must never be replaced.
  const dest = pulledContentDir(root);
  const shaFile = join(dest, ".sha");
  if (
    !opts.force &&
    existsSync(shaFile) &&
    readFileSync(shaFile, "utf8").trim() === lock.sha
  ) {
    return { dest, sha: lock.sha, skipped: true };
  }
  const url = `https://codeload.github.com/${lock.repo}/tar.gz/${lock.sha}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      `content pull failed: ${res.status} ${res.statusText} for ${url}`,
    );
  const staging = `${dest}.tmp`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const tarball = join(staging, "content.tgz");
  writeFileSync(tarball, Buffer.from(await res.arrayBuffer()));
  await extract({ file: tarball, cwd: staging });
  rmSync(tarball);
  const [top] = readdirSync(staging);
  if (!top || !top.endsWith(`-${lock.sha}`)) {
    throw new Error(
      `tarball top-level directory "${top}" does not match sha ${lock.sha}`,
    );
  }
  rmSync(dest, { recursive: true, force: true });
  renameSync(join(staging, top), dest);
  rmSync(staging, { recursive: true, force: true });
  writeFileSync(shaFile, `${lock.sha}\n`);
  return { dest, sha: lock.sha, skipped: false };
}
