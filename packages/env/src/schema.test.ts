import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  checkPairs,
  clientSchema,
  databaseSchema,
  serverSchema,
} from "./schema";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3001",
};
const schema = z.object(serverSchema);

describe("server env schema", () => {
  it("accepts the minimum and applies defaults", () => {
    const parsed = schema.parse(base);
    expect(parsed.DATABASE_POOL_MAX).toBe(10);
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.CONTENT_DIR).toBeUndefined();
  });
  it("rejects a missing DATABASE_URL and a short secret", () => {
    expect(schema.safeParse({ ...base, DATABASE_URL: undefined }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ ...base, BETTER_AUTH_SECRET: "short" }).success,
    ).toBe(false);
  });
  it("treats empty optional strings as unset", () => {
    expect(
      schema.parse({ ...base, CONTENT_DIR: "" }).CONTENT_DIR,
    ).toBeUndefined();
  });
  it("requires OAuth pairs together", () => {
    expect(checkPairs({ GITHUB_CLIENT_ID: "id" })).toHaveLength(1);
    expect(
      checkPairs({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "s" }),
    ).toHaveLength(0);
  });
});

describe("client and database env", () => {
  it("defaults public URLs outside production (this test runs with NODE_ENV=test)", () => {
    const parsed = z.object(clientSchema).parse({});
    expect(parsed.NEXT_PUBLIC_LMS_URL).toBe("http://localhost:3001");
  });
  it("database slice needs only DATABASE_URL", () => {
    expect(
      z.object(databaseSchema).safeParse({ DATABASE_URL: base.DATABASE_URL })
        .success,
    ).toBe(true);
  });
});
