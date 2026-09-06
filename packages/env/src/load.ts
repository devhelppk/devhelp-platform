import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Load the monorepo root `.env` (marked by pnpm-workspace.yaml) so apps,
 * drizzle-kit, the seed, and CLIs share one file. No-op if not found
 * (CI and production provide real environment variables).
 */
export function loadRootEnv(from = process.cwd()) {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      config({ path: join(dir, ".env"), quiet: true });
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
