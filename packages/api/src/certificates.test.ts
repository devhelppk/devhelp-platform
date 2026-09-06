import { db, eq, schema } from "@repo/database";
import { outbox, resetOutbox } from "@repo/email";
import { enroll, recordEvent } from "@repo/learning";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, learner: User, other: User;
let courseId: string, lessonId: string, certId: string;

const as = (u: User | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({ user: u, session: { id: "s" } } as unknown as Context["session"])
      : null,
  } as Context);
async function user(
  name: string,
  extra: Partial<typeof schema.users.$inferInsert> = {},
) {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${name}-${run}@devhelp.test`,
      name,
      emailVerified: true,
      ...extra,
    })
    .returning();
  return u!;
}

beforeAll(async () => {
  admin = await user("admin", { role: "admin" });
  learner = await user("learner");
  other = await user("other");
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug: `cert-${run}`,
      title: `Cert ${run}`,
      summary: "A private course for certificate tests, long enough.",
      isPublished: true,
    })
    .returning();
  courseId = course!.id;
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId, slug: "m1", title: "M1", position: 1 })
    .returning();
  const [l] = await db
    .insert(schema.lessons)
    .values({
      courseId,
      moduleId: mod!.id,
      slug: "l1",
      title: "Only lesson",
      type: "article",
      position: 1,
    })
    .returning();
  lessonId = l!.id;
  await enroll(learner.id, courseId);
  const r = await recordEvent({
    userId: learner.id,
    kind: "lesson_completed",
    lessonId,
    idempotencyKey: `cert-api:${run}`,
  });
  certId = r.certificateId!;
});
afterAll(async () => {
  await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
  for (const u of [admin, learner, other])
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
});
beforeEach(() => resetOutbox());

describe("certificates", () => {
  it("verify data is public, unknown ids 404, mine is scoped", async () => {
    const c = await as(null).certificates.byId({ id: certId });
    expect(c).toMatchObject({
      learnerName: "learner",
      courseTitle: `Cert ${run}`,
      revokedAt: null,
    });
    expect(c.criteria.lessons.map((l) => l.slug)).toEqual(["l1"]);
    await expect(
      as(null).certificates.byId({ id: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await as(learner).certificates.mine()).map((x) => x.id)).toEqual([
      certId,
    ]);
    expect(await as(other).certificates.mine()).toEqual([]);
  });

  it("revoke needs admin and a reason, logs, notifies, emails; restore reverses", async () => {
    await expect(
      as(learner).certificates.revoke({ id: certId, reason: "Not allowed" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      as(admin).certificates.revoke({ id: certId, reason: "x" }),
    ).rejects.toBeTruthy();
    await as(admin).certificates.revoke({
      id: certId,
      reason: "Issued to the wrong account after a support request.",
    });
    const c = await as(null).certificates.byId({ id: certId });
    expect(c.revokedAt).toBeTruthy();
    expect(c.revokedReason).toContain("wrong account");
    const item = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.subjectId, certId),
      with: { actions: true },
    });
    expect(item).toMatchObject({
      subjectType: "certificate",
      status: "hidden",
    });
    expect(item?.actions.map((a) => a.action)).toEqual(["hide"]);
    expect((await as(learner).notifications.list()).items[0]).toMatchObject({
      kind: "certificate_revoked",
    });
    expect(outbox.at(-1)?.text).toContain("revoked");
    await expect(
      as(admin).certificates.revoke({ id: certId, reason: "again please" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await as(admin).certificates.restore({
      id: certId,
      reason: "Support confirmed the account.",
    });
    expect(
      (await as(null).certificates.byId({ id: certId })).revokedAt,
    ).toBeNull();
    const again = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.subjectId, certId),
      with: { actions: true },
    });
    expect(again?.status).toBe("approved");
    expect(again?.actions.map((a) => a.action).sort()).toEqual([
      "hide",
      "unhide",
    ]);
    const list = await as(admin).certificates.adminList({
      q: "learner",
      limit: 30,
    });
    expect(list.items.some((x) => x.id === certId)).toBe(true);
    await expect(as(learner).certificates.adminList()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("profiles", () => {
  it("handles are validated, unique, reserved; profiles are private by default", async () => {
    await expect(
      as(learner).profiles.byHandle({ handle: "nobody" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      as(learner).account.updatePublicProfile({ profilePublic: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as(learner).account.updatePublicProfile({
        handle: "admin",
        profilePublic: false,
      }),
    ).rejects.toBeTruthy();
    await expect(
      as(learner).account.updatePublicProfile({
        handle: "ab",
        profilePublic: false,
      }),
    ).rejects.toBeTruthy();
    await as(learner).account.updatePublicProfile({
      handle: `Ayesha-${run}`,
      profilePublic: false,
      bio: "Backend, Karachi.",
      links: { github: "ayesha", website: "https://example.com" },
    });
    // Private: not visible, even with the right handle, in any case.
    await expect(
      as(null).profiles.byHandle({ handle: `ayesha-${run}` }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      as(other).account.updatePublicProfile({
        handle: `AYESHA-${run}`,
        profilePublic: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await as(learner).account.updatePublicProfile({
      handle: `ayesha-${run}`,
      profilePublic: true,
      links: { github: "ayesha" },
    });
    const p = await as(null).profiles.byHandle({ handle: `AYESHA-${run}` });
    expect(p).toMatchObject({
      name: "learner",
      handle: `ayesha-${run}`,
      links: { github: "ayesha" },
    });
    expect(p.certificates.map((c) => c.id)).toEqual([certId]);
    const me = await as(learner).account.me();
    expect(me).toMatchObject({ handle: `ayesha-${run}`, profilePublic: true });
    // A public profile never carries the internal user id.
    expect(Object.keys(p)).not.toContain("id");
    // One-character handles are refused (the message promises 3 to 30).
    await expect(
      as(other).account.updatePublicProfile({
        handle: "x",
        profilePublic: false,
      }),
    ).rejects.toBeTruthy();
    // Only http(s) links: a javascript: URL never reaches a public page.
    await expect(
      as(learner).account.updatePublicProfile({
        handle: `ayesha-${run}`,
        profilePublic: true,
        links: { website: "javascript:alert(1)" },
      }),
    ).rejects.toBeTruthy();
  });

  it("the database enforces handle uniqueness even without the check", async () => {
    // users_handle_lower_uidx (migration 0011) is the guarantee; the router's
    // pre-check only makes the message friendly.
    await expect(
      db
        .update(schema.users)
        .set({ handle: `AYESHA-${run}` })
        .where(eq(schema.users.id, other.id)),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

describe("certificate moderation items", () => {
  it("are an audit trail, not a second control: the queue cannot un-revoke", async () => {
    await as(admin).certificates.revoke({
      id: certId,
      reason: "Checking that the queue cannot undo this.",
    });
    const item = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.subjectId, certId),
      columns: { id: true },
    });
    await expect(
      as(admin).moderation.decide({ id: item!.id, action: "unhide" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (await as(null).certificates.byId({ id: certId })).revokedAt,
    ).toBeTruthy();
    await as(admin).certificates.restore({
      id: certId,
      reason: "Done checking.",
    });
  });
});
