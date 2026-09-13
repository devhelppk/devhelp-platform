import { describe, expect, it, vi } from "vitest";
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
  BETTER_AUTH_URL: "http://localhost:3000",
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
  it("defaults the public site URL outside production (this test runs with NODE_ENV=test)", () => {
    const parsed = z.object(clientSchema).parse({});
    expect(parsed.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });
  it("requires the public site URL in production", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    vi.resetModules();
    try {
      const mod = await import("./schema");
      expect(z.object(mod.clientSchema).safeParse({}).success).toBe(false);
      expect(
        z
          .object(mod.clientSchema)
          .safeParse({ NEXT_PUBLIC_SITE_URL: "https://learn.devhelp.pk" })
          .success,
      ).toBe(true);
    } finally {
      process.env.NODE_ENV = original;
      vi.resetModules();
    }
  });
  it("database slice needs only DATABASE_URL", () => {
    expect(
      z.object(databaseSchema).safeParse({ DATABASE_URL: base.DATABASE_URL })
        .success,
    ).toBe(true);
  });
});

describe("email env", () => {
  it("defaults to the log transport and checks provider credentials", () => {
    const parsed = schema.parse(base);
    expect(parsed.EMAIL_PROVIDER).toBe("log");
    expect(parsed.EMAIL_FROM).toContain("@");
    expect(checkPairs({ EMAIL_PROVIDER: "resend" })).toEqual([
      "EMAIL_PROVIDER=resend needs RESEND_API_KEY",
    ]);
    expect(checkPairs({ EMAIL_PROVIDER: "smtp" })).toHaveLength(1);
    expect(
      checkPairs({ EMAIL_PROVIDER: "smtp", SMTP_URL: "smtp://localhost:1025" }),
    ).toHaveLength(0);
  });
});
