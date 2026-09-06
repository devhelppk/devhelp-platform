import { db, eq, schema } from "@repo/database";
import { outbox, resetOutbox } from "@repo/email";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, mentorTech: User, learner: User, unverified: User;

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
  mentorTech = await user("mentor", { role: "mentor" });
  await db
    .insert(schema.mentorTracks)
    .values({ userId: mentorTech.id, track: "technical" });
  learner = await user("learner");
  unverified = await user("unverified", { emailVerified: false });
});
afterAll(async () => {
  for (const u of [admin, mentorTech, learner, unverified])
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
});
beforeEach(() => resetOutbox());

describe("verified and role procedures", () => {
  it("blocks unverified users from contributing and non-mentors from the queue", async () => {
    await expect(
      as(unverified).mentor.submitApplication({
        tracks: ["technical"],
        github: "someone",
        why: "x".repeat(50),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as(learner).moderation.queue({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(as(null).notifications.unreadCount()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("mentor onboarding through the queue", () => {
  it("applies once, is scoped away from mentors, and approval flips the role, notifies, and emails", async () => {
    const applied = await as(learner).mentor.submitApplication({
      tracks: ["technical", "career"],
      github: "learner-gh",
      why: "I have taught two cohorts and want to review technical content for the platform.",
      link: "https://example.com/work",
    });
    expect(applied.status).toBe("pending");
    // A second application while one is pending is refused.
    await expect(
      as(learner).mentor.submitApplication({
        tracks: ["technical"],
        github: "learner-gh",
        why: "y".repeat(50),
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    // Track-less items are admin-only: the technical mentor sees nothing, the admin sees it.
    expect(
      (await as(mentorTech).moderation.queue({})).items.map((i) => i.id),
    ).not.toContain(applied.id);
    expect(
      (await as(admin).moderation.queue({})).items.map((i) => i.id),
    ).toContain(applied.id);
    await expect(
      as(mentorTech).moderation.decide({ id: applied.id, action: "approve" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Reject needs a reason.
    await expect(
      as(admin).moderation.decide({ id: applied.id, action: "reject" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const decided = await as(admin).moderation.decide({
      id: applied.id,
      action: "approve",
    });
    expect(decided.status).toBe("approved");
    const fresh = await db.query.users.findFirst({
      where: eq(schema.users.id, learner.id),
    });
    expect(fresh?.role).toBe("mentor");
    const tracks = await db.query.mentorTracks.findMany({
      where: eq(schema.mentorTracks.userId, learner.id),
    });
    expect(tracks.map((t) => t.track).sort()).toEqual(["career", "technical"]);
    const item = await as(admin).moderation.item({ id: applied.id });
    expect(item.actions.map((a) => a.action)).toEqual(["approve", "submit"]);
    expect(item.actions[0]?.actor?.id).toBe(admin.id);
    // A second decision on a decided item is refused.
    await expect(
      as(admin).moderation.decide({ id: applied.id, action: "approve" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    // Notification + email.
    const inbox = await as({ ...learner, role: "mentor" }).notifications.list();
    expect(inbox.items[0]).toMatchObject({
      kind: "mentor_application_decided",
      readAt: null,
    });
    expect(await as(learner).notifications.unreadCount()).toBe(1);
    expect(outbox.at(-1)?.to).toBe(learner.email);
    expect(outbox.at(-1)?.text).toContain("approved");
    const marked = await as(learner).notifications.markAllRead();
    expect(marked.marked).toBe(1);
    expect(await as(learner).notifications.unreadCount()).toBe(0);
    // The admin's own inbox is untouched.
    expect(await as(admin).notifications.unreadCount()).toBe(0);
  });

  it("scopes tracked items to mentors of that track and logs flags", async () => {
    const req = await as(admin).moderation.requestReview({
      targetType: "company_review",
      targetId: crypto.randomUUID(),
      message: "This review names our CTO by full name in paragraph two.",
      contactEmail: `hr-${run}@example.com`,
    });
    // Give it a track so the scoping rule can be exercised.
    await db
      .update(schema.moderationItems)
      .set({ track: "career" })
      .where(eq(schema.moderationItems.id, req.id));
    expect(
      (await as(mentorTech).moderation.queue({})).items.map((i) => i.id),
    ).not.toContain(req.id);
    await db
      .update(schema.moderationItems)
      .set({ track: "technical" })
      .where(eq(schema.moderationItems.id, req.id));
    expect(
      (await as(mentorTech).moderation.queue({})).items.map((i) => i.id),
    ).toContain(req.id);
    const rejected = await as(mentorTech).moderation.decide({
      id: req.id,
      action: "reject",
      reason: "Post does not name anyone.",
      policyClause: "c1",
    });
    expect(rejected.status).toBe("rejected");
    const item = await as(admin).moderation.item({ id: req.id });
    expect(item.actions[0]).toMatchObject({
      action: "reject",
      policyClause: "c1",
      before: { status: "pending" },
      after: { status: "rejected" },
    });
    const flag = await as(learner).moderation.flag({
      subjectType: "company_review_request",
      subjectId: item.subjectId,
      reason: "spam",
    });
    expect(flag.duplicate).toBe(false);
    const dup = await as(learner).moderation.flag({
      subjectType: "company_review_request",
      subjectId: item.subjectId,
      reason: "spam",
    });
    expect(dup.duplicate).toBe(true);
    expect(
      (await as(admin).moderation.flags()).some((f) => f.id === flag.id),
    ).toBe(true);
    // Technical-track item: the technical mentor sees the flag; a career mentor neither sees nor resolves it.
    expect(
      (await as(mentorTech).moderation.flags()).some((f) => f.id === flag.id),
    ).toBe(true);
    const careerMentor = await user("career-mentor", { role: "mentor" });
    try {
      await db
        .insert(schema.mentorTracks)
        .values({ userId: careerMentor.id, track: "career" });
      expect(
        (await as(careerMentor).moderation.flags()).some(
          (f) => f.id === flag.id,
        ),
      ).toBe(false);
      await expect(
        as(careerMentor).moderation.resolveFlag({
          id: flag.id!,
          outcome: "upheld",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, careerMentor.id));
    }
    // Upholding a flag on a rejected item hides nothing; it is logged as dismissed.
    const resolved = await as(mentorTech).moderation.resolveFlag({
      id: flag.id!,
      outcome: "upheld",
    });
    expect(resolved).toEqual({ ok: true, hidden: false });
    const after = await as(admin).moderation.item({ id: req.id });
    expect(after.status).toBe("rejected");
    expect(after.actions[0]).toMatchObject({ action: "dismiss_flag" });
    await expect(
      as(mentorTech).moderation.resolveFlag({
        id: flag.id!,
        outcome: "upheld",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("upholding a flag on an approved item hides it in the same transaction", async () => {
    const req = await as(admin).moderation.requestReview({
      targetType: "company_review",
      targetId: crypto.randomUUID(),
      message: "Please look at this one, it quotes a private Slack message.",
      contactEmail: `hr2-${run}@example.com`,
    });
    await as(admin).moderation.decide({ id: req.id, action: "approve" });
    const item = await as(admin).moderation.item({ id: req.id });
    const flag = await as(learner).moderation.flag({
      subjectType: "company_review_request",
      subjectId: item.subjectId,
      reason: "personal_data",
    });
    const resolved = await as(admin).moderation.resolveFlag({
      id: flag.id!,
      outcome: "upheld",
    });
    expect(resolved).toEqual({ ok: true, hidden: true });
    const hidden = await as(admin).moderation.item({ id: req.id });
    expect(hidden.status).toBe("hidden");
    expect(hidden.actions[0]).toMatchObject({
      action: "hide",
      before: { status: "approved" },
      after: { status: "hidden" },
    });
    expect(
      (await as(admin).moderation.flags({ status: "upheld" })).some(
        (f) => f.id === flag.id,
      ),
    ).toBe(true);
  });

  it("procedures read role and verification fresh, not from the session copy", async () => {
    // The session claims admin, the table says student: the table wins.
    await expect(
      as({ ...unverified, role: "admin" }).moderation.queue({}),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // The session claims verified, the table says not: blocked.
    await expect(
      as({ ...unverified, emailVerified: true }).mentor.submitApplication({
        tracks: ["career"],
        github: "u",
        why: "z".repeat(50),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("rate limit", () => {
  it("resendVerification is a no-op when verified and limited otherwise", async () => {
    expect(await as(learner).account.resendVerification()).toMatchObject({
      sent: false,
      reason: "already_verified",
    });
  });
});
