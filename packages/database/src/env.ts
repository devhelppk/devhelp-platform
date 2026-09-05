import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Walk up from the current working directory to the monorepo root (marked by
 * pnpm-workspace.yaml) and load its `.env`, so the apps, drizzle-kit, and the
 * seed script all share one DATABASE_URL no matter where they are run from.
 */
function loadRootEnv() {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      config({ path: join(dir, ".env"), quiet: true });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

loadRootEnv();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the repo root and run `pnpm db:up`.",
  );
}

export const env = { DATABASE_URL };
