import { db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "./server";

/**
 * Integration test against the local Postgres from `pnpm db:up`.
 * Requires DATABASE_URL and BETTER_AUTH_SECRET (root .env) and applied migrations.
 */
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const owner = {
  email: `owner-${run}@devhelp.test`,
  password: "correct-horse-battery",
  name: "Ayesha Khan",
};
const student = {
  email: `student-${run}@devhelp.test`,
  password: "correct-horse-battery",
  name: "Bilal Ahmed",
};

async function signUp(u: typeof owner, city?: string) {
  const res = await auth.api.signUpEmail({
    body: { ...u, city },
    asResponse: true,
  });
  expect(res.ok).toBe(true);
  const cookie = res.headers.get("set-cookie") ?? "";
  const body = (await res.json()) as {
    user: { id: string; role: string; city?: string };
  };
  return { user: body.user, headers: new Headers({ cookie }) };
}

describe("auth + organizations", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created)
      await db.delete(schema.users).where(eq(schema.users.id, id));
  });

  let ownerCtx: Awaited<ReturnType<typeof signUp>>;
  let studentCtx: Awaited<ReturnType<typeof signUp>>;

  beforeAll(async () => {
    ownerCtx = await signUp(owner, "Karachi");
    studentCtx = await signUp(student, "Lahore");
    created.push(ownerCtx.user.id, studentCtx.user.id);
  });

  it("creates users with the student platform role and custom fields", async () => {
    expect(ownerCtx.user.role).toBe("student");
    expect(ownerCtx.user.city).toBe("Karachi");
    const row = await db.query.users.findFirst({
      where: eq(schema.users.id, ownerCtx.user.id),
    });
    expect(row?.email).toBe(owner.email);
  });

  it("returns a session for the signed-up user", async () => {
    const session = await auth.api.getSession({ headers: ownerCtx.headers });
    expect(session?.user.email).toBe(owner.email);
  });

  it("blocks students from creating organizations until promoted", async () => {
    await expect(
      auth.api.createOrganization({
        body: { name: "FAST Karachi CS Society", slug: `fast-khi-${run}` },
        headers: ownerCtx.headers,
      }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("lets a mentor create an organization with devhelp fields, then a cohort team", async () => {
    await db
      .update(schema.users)
      .set({ role: "mentor" })
      .where(eq(schema.users.id, ownerCtx.user.id));

    const org = await auth.api.createOrganization({
      body: {
        name: "FAST Karachi CS Society",
        slug: `fast-khi-${run}`,
        kind: "university",
        city: "Karachi",
      },
      headers: ownerCtx.headers,
    });
    expect(org?.kind).toBe("university");
    expect(org?.members[0]?.role).toBe("owner");

    const team = await auth.api.createTeam({
      body: {
        name: "Fall 2026 cohort",
        organizationId: org!.id,
        startsAt: new Date("2026-10-01"),
      },
      headers: ownerCtx.headers,
    });
    expect(team.organizationId).toBe(org!.id);

    // Owner adds the student directly (server-side, no email round-trip).
    const member = await auth.api.addMember({
      body: {
        userId: studentCtx.user.id,
        organizationId: org!.id,
        role: "member",
        teamId: team.id,
      },
    });
    expect(member?.role).toBe("member");

    const full = await auth.api.getFullOrganization({
      query: { organizationId: org!.id },
      headers: ownerCtx.headers,
    });
    expect(full?.members.map((m) => m.userId).sort()).toEqual(
      [ownerCtx.user.id, studentCtx.user.id].sort(),
    );
    // With teams enabled, Better Auth also creates a default team named after the org.
    expect(full?.teams?.map((t) => t.name).sort()).toEqual([
      "FAST Karachi CS Society",
      "Fall 2026 cohort",
    ]);
  });
});
