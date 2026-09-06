import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "./schema";

declare global {
  // Reuse the connection pool across Next.js hot reloads in development.
  var __devhelpSql: ReturnType<typeof postgres> | undefined;
}

// A single connection would serialise every transaction (and hide lock bugs in
// tests); DATABASE_POOL_MAX defaults to 10 and the globalThis cache above
// prevents pool multiplication on hot reload.
const sql =
  globalThis.__devhelpSql ??
  postgres(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });

if (process.env.NODE_ENV !== "production") {
  globalThis.__devhelpSql = sql;
}

export const db = drizzle(sql, { schema, casing: "snake_case" });
export type Database = typeof db;

export { schema };
export * from "drizzle-orm";
