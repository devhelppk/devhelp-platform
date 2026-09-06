import { db, sql } from "@repo/database";
import { env } from "@repo/env";
import { describe, expect, it } from "vitest";

describe("connection pool", () => {
  it("has more than one connection so transactions can overlap", async () => {
    expect(env.DATABASE_POOL_MAX).toBeGreaterThanOrEqual(2);
    // Two 300 ms sleeps in parallel must finish in well under 600 ms on a real pool.
    const started = Date.now();
    await Promise.all([
      db.execute(sql`select pg_sleep(0.3)`),
      db.execute(sql`select pg_sleep(0.3)`),
    ]);
    expect(Date.now() - started).toBeLessThan(550);
  });
});
