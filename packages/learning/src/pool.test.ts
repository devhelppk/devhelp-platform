import { db, sql } from "@repo/database";
import { env } from "@repo/env";
import { describe, expect, it } from "vitest";

describe("connection pool", () => {
  it("has more than one connection so transactions can overlap", async () => {
    expect(env.DATABASE_POOL_MAX).toBeGreaterThanOrEqual(2);
    // Two 300 ms sleeps in parallel must finish in well under the 600 ms a
    // single connection would take. The bound is 580 rather than 550: at 550
    // this failed on a loaded machine ("expected 550 to be less than 550")
    // while still proving nothing about serialisation, and anything under 600
    // is only reachable with two connections.
    const started = Date.now();
    await Promise.all([
      db.execute(sql`select pg_sleep(0.3)`),
      db.execute(sql`select pg_sleep(0.3)`),
    ]);
    expect(Date.now() - started).toBeLessThan(580);
  });
});
