#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contentDir, findRepoRoot, readLock } from "../src/lock";
import { syncContent } from "../src/sync";

const root = findRepoRoot();
const lock = readLock(root);
const dir = contentDir(root);
const shaFile = join(dir, ".sha");
// A sibling checkout (CONTENT_DIR) has no .sha; fall back to the lock's sha.
const sha = existsSync(shaFile)
  ? readFileSync(shaFile, "utf8").trim()
  : lock.sha;

syncContent({ dir, sha, repo: lock.repo })
  .then((s) => {
    const fmt = (c: {
      created: number;
      updated: number;
      unchanged: number;
      archived: number;
    }) => `+${c.created} ~${c.updated} =${c.unchanged} -${c.archived}`;
    console.log(
      `synced ${lock.repo}@${sha.slice(0, 7)} (revision ${s.revisionId})`,
    );
    console.log(
      `  courses ${fmt(s.courses)}  modules ${fmt(s.modules)}  lessons ${fmt(s.lessons)}`,
    );
    console.log(
      `  quizzes ${fmt(s.quizzes)}  exercises ${fmt(s.exercises)}  paths ${fmt(s.paths)}  badges ${fmt(s.badges)}`,
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
