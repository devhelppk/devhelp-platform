import { db, eq, schema } from "@repo/database";
import { enroll, recordEvent } from "@repo/learning";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, learner: User, other: User;
let courseId: string, lessonId: string, badgeId: string;
const slug = `api-badge-${run}`;

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
      slug,
      title: `Badge api ${run}`,
      summary: "A private course for badge api tests.",
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
  const [b] = await db
    .insert(schema.badges)
    .values({
      slug: `api-finisher-${run}`,
      name: `Api finisher ${run}`,
      description: "Finished the private test course, which is enough.",
      icon: "award",
      rule: { kind: "course_completed", course: slug },
    })
    .returning();
  badgeId = b!.id;
});
afterAll(async () => {
  await db.delete(schema.badges).where(eq(schema.badges.id, badgeId));
  await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
  for (const u of [admin, learner, other])
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
});

describe("badges router", () => {
  it("the catalogue shows the caller's earned state and nobody else's", async () => {
    const signedOut = await as(null).badges.catalogue();
    expect(signedOut.every((b) => b.earnedAt === null)).toBe(true);
    await enroll(learner.id, courseId);
    await recordEvent({
      userId: learner.id,
      kind: "lesson_completed",
      lessonId,
      idempotencyKey: `api-badge:${run}`,
    });
    const mine = await as(learner).badges.catalogue();
    expect(mine.find((b) => b.id === badgeId)?.earnedAt).toBeTruthy();
    const theirs = await as(other).badges.catalogue();
    expect(theirs.find((b) => b.id === badgeId)?.earnedAt).toBeNull();
    expect((await as(learner).badges.mine()).map((m) => m.badge.id)).toContain(
      badgeId,
    );
    expect(await as(other).badges.mine()).toEqual([]);
  });

  it("admins award and revoke with a reason kept on the row", async () => {
    await expect(
      as(learner).badges.award({
        userId: other.id,
        badgeSlug: `api-finisher-${run}`,
        reason: "Because I said so.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      as(admin).badges.award({
        userId: other.id,
        badgeSlug: "does-not-exist",
        reason: "Nothing here.",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await as(admin).badges.award({
      userId: other.id,
      badgeSlug: `api-finisher-${run}`,
      reason: "Ran the course in a workshop.",
    });
    const row = await db.query.userBadges.findFirst({
      where: eq(schema.userBadges.userId, other.id),
    });
    expect(row).toMatchObject({
      awardedBy: admin.id,
      awardReason: "Ran the course in a workshop.",
      revokedAt: null,
    });
    expect((await as(other).notifications.list()).items[0]).toMatchObject({
      kind: "badge_awarded",
    });
    // Awarding twice is refused; revoking records who and why.
    await expect(
      as(admin).badges.award({
        userId: other.id,
        badgeSlug: `api-finisher-${run}`,
        reason: "Again.",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await as(admin).badges.revoke({
      userId: other.id,
      badgeSlug: `api-finisher-${run}`,
      reason: "Awarded to the wrong person.",
    });
    const revoked = await db.query.userBadges.findFirst({
      where: eq(schema.userBadges.userId, other.id),
    });
    expect(revoked).toMatchObject({
      revokedBy: admin.id,
      revokedReason: "Awarded to the wrong person.",
    });
    // A revoked badge disappears from the catalogue's earned state.
    expect(
      (await as(other).badges.catalogue()).find((b) => b.id === badgeId)
        ?.earnedAt,
    ).toBeNull();
    await expect(
      as(admin).badges.revoke({
        userId: other.id,
        badgeSlug: `api-finisher-${run}`,
        reason: "Once more.",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Awarding again restores it with the new reason.
    await as(admin).badges.award({
      userId: other.id,
      badgeSlug: `api-finisher-${run}`,
      reason: "Confirmed after all.",
    });
    expect(
      (await as(other).badges.catalogue()).find((b) => b.id === badgeId)
        ?.earnedAt,
    ).toBeTruthy();
    expect(
      (await as(admin).badges.adminList()).some((a) => a.user.id === other.id),
    ).toBe(true);
    await expect(as(learner).badges.adminList()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("streak and activity are the caller's own and reach a public profile", async () => {
    const s = await as(learner).learning.streak();
    expect(s.current).toBeGreaterThanOrEqual(1);
    expect(await as(learner).learning.activity({ weeks: 4 })).toHaveLength(28);
    await expect(as(null).learning.streak()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await as(learner).account.updatePublicProfile({
      handle: `badges-${run}`,
      profilePublic: true,
    });
    const profile = await as(null).profiles.byHandle({
      handle: `badges-${run}`,
    });
    expect(profile.badges.map((b) => b.badge.slug)).toContain(
      `api-finisher-${run}`,
    );
    expect(profile.streak.current).toBeGreaterThanOrEqual(1);
    expect(profile.activity.length).toBeGreaterThan(300);
  });
});
