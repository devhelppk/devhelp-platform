import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "./schema";

declare global {
  // Reuse the connection across Next.js hot reloads in development.
  var __devhelpSql: ReturnType<typeof postgres> | undefined;
}

const sql =
  globalThis.__devhelpSql ??
  postgres(env.DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__devhelpSql = sql;
}

export const db = drizzle(sql, { schema, casing: "snake_case" });
export type Database = typeof db;

export { schema };
export * from "drizzle-orm";
