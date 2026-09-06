import { databaseEnv } from "@repo/env/database";

/** Database-only slice; drizzle-kit and the seed never need auth secrets. */
export const env = {
  DATABASE_URL: databaseEnv.DATABASE_URL,
  DATABASE_POOL_MAX: databaseEnv.DATABASE_POOL_MAX,
};
