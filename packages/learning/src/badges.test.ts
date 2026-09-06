import { db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activityFor, streakFor, today } from "./activity";
import { rebuildLearner } from "./rebuild";
import { enroll, recordEvent } from "./record-event";

const run = crypto.randomUUID().slice(0, 8);
let user: { id: string };
let courseId: string;
const lessons: string[] = [];
const badgeIds: Record<string, string> = {};

const dayAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

beforeAll(async () => {
  [user] = (await db
    .insert(schema.users)
    .values({ email: `badge-${run}@devhelp.test`, name: "Badge Learner" })
    .returning()) as unknown as [{ id: string }];
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug: `badge-${run}`,
      title: `Badge course ${run}`,
      summary: "A course for badge tests, long enough.",
      isPublished: true,
    })
    .returning();
  courseId = course!.id;
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId, slug: "m1", title: "M1", position: 1 })
    .returning();
  for (let i = 1; i <= 6; i++) {
    const [l] = await db
      .insert(schema.lessons)
      .values({
        courseId,
        moduleId: mod!.id,
        slug: `l${i}`,
        title: `Lesson ${i}`,
        type: "article",
        position: i,
        isRequired: i <= 6,
      })
      .returning();
    lessons.push(l!.id);
  }
  for (const [slug, rule] of [
    [`three-fast-${run}`, { kind: "lessons_in_window", count: 3, days: 7 }],
    [`finisher-${run}`, { kind: "course_completed", course: `badge-${run}` }],
    [`project-${run}`, { kind: "first_project_accepted" }],
  ] as const) {
    const [b] = await db
      .insert(schema.badges)
      .values({
        slug,
        name: slug,
        description: "A badge for tests, long enough.",
        icon: "award",
        rule,
      })
      .returning();
    badgeIds[slug] = b!.id;
  }
});
afterAll(async () => {
  await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  for (const id of Object.values(badgeIds))
    await db.delete(schema.badges).where(eq(schema.badges.id, id));
});

const held = async () =>
  (
    await db.query.userBadges.findMany({
      where: eq(schema.userBadges.userId, user.id),
    })
  ).map((b) => b.badgeId);

describe("badges", () => {
  it("awards on the event that satisfies the rule, exactly once, and never on replay", async () => {
    await enroll(user.id, courseId);
    for (let i = 0; i < 2; i++)
      await recordEvent({
        userId: user.id,
        kind: "lesson_completed",
        lessonId: lessons[i]!,
        idempotencyKey: `b:${run}:${i}`,
      });
    expect(await held()).not.toContain(badgeIds[`three-fast-${run}`]);
    // The third lesson inside the window earns it, and the event says so.
    const third = await recordEvent({
      userId: user.id,
      kind: "lesson_completed",
      lessonId: lessons[2]!,
      idempotencyKey: `b:${run}:2`,
    });
    expect(third.badgeIds).toContain(badgeIds[`three-fast-${run}`]);
    expect(await held()).toContain(badgeIds[`three-fast-${run}`]);
    // A fourth does not award it again.
    const fourth = await recordEvent({
      userId: user.id,
      kind: "lesson_completed",
      lessonId: lessons[3]!,
      idempotencyKey: `b:${run}:3`,
    });
    expect(fourth.badgeIds).not.toContain(badgeIds[`three-fast-${run}`]);
    // Told exactly once about this badge (the seeded content badges fire too).
    const notes = await db.query.notifications.findMany({
      where: eq(schema.notifications.userId, user.id),
    });
    expect(
      notes.filter(
        (n) =>
          n.kind === "badge_awarded" &&
          n.subjectId === badgeIds[`three-fast-${run}`],
      ),
    ).toHaveLength(1);
    // A replay keeps the award and rebuilds activity without doubling it.
    const before = await db.query.userActivity.findMany({
      where: eq(schema.userActivity.userId, user.id),
    });
    await rebuildLearner(user.id);
    expect(await held()).toContain(badgeIds[`three-fast-${run}`]);
    const after = await db.query.userActivity.findMany({
      where: eq(schema.userActivity.userId, user.id),
    });
    expect(after.map((a) => `${a.day}:${a.events}`)).toEqual(
      before.map((a) => `${a.day}:${a.events}`),
    );
  });

  it("awards a course badge from the derived completion event, and never a project badge yet", async () => {
    for (let i = 4; i < 6; i++)
      await recordEvent({
        userId: user.id,
        kind: "lesson_completed",
        lessonId: lessons[i]!,
        idempotencyKey: `b:${run}:${i}`,
      });
    const enrolment = await db.query.enrollments.findFirst({
      where: eq(schema.enrollments.userId, user.id),
    });
    expect(enrolment?.status).toBe("completed");
    expect(await held()).toContain(badgeIds[`finisher-${run}`]);
    // first_project_accepted is valid content but nothing emits a passing project yet.
    expect(await held()).not.toContain(badgeIds[`project-${run}`]);
  });

  it("awards a path badge when the last course completes, and reports both badges from one event", async () => {
    const [pathLearner] = (await db
      .insert(schema.users)
      .values({ email: `path-${run}@devhelp.test`, name: "Path Learner" })
      .returning()) as unknown as [{ id: string }];
    const [path] = await db
      .insert(schema.paths)
      .values({
        slug: `p-${run}`,
        title: `Path ${run}`,
        summary: "A path for badge tests, long enough.",
        isPublished: true,
      })
      .returning();
    await db
      .insert(schema.pathCourses)
      .values({ pathId: path!.id, courseId, position: 0 });
    const [pathBadge] = await db
      .insert(schema.badges)
      .values({
        slug: `path-${run}`,
        name: `Path badge ${run}`,
        description: "Finished every course in the test path.",
        icon: "route",
        rule: { kind: "path_completed", path: `p-${run}` },
      })
      .returning();
    try {
      await enroll(pathLearner.id, courseId);
      // The last lesson completes the course, which completes the path: one
      // event, two badges, both reported.
      let last;
      for (let i = 0; i < 6; i++)
        last = await recordEvent({
          userId: pathLearner.id,
          kind: "lesson_completed",
          lessonId: lessons[i]!,
          idempotencyKey: `p:${run}:${i}`,
        });
      expect(last!.courseCompleted).toBe(true);
      expect(last!.badgeIds).toContain(pathBadge!.id);
      expect(last!.badgeIds).toContain(badgeIds[`finisher-${run}`]);
      const notes = await db.query.notifications.findMany({
        where: eq(schema.notifications.userId, pathLearner.id),
      });
      const subjects = notes
        .filter((n) => n.kind === "badge_awarded")
        .map((n) => n.subjectId);
      expect(subjects).toContain(pathBadge!.id);
      expect(subjects).toContain(badgeIds[`finisher-${run}`]);
    } finally {
      await db.delete(schema.badges).where(eq(schema.badges.id, pathBadge!.id));
      await db.delete(schema.paths).where(eq(schema.paths.id, path!.id));
      await db.delete(schema.users).where(eq(schema.users.id, pathLearner.id));
    }
  });

  it("a rebuild reproduces activity exactly for a learner who never enrolled explicitly", async () => {
    const [implicit] = (await db
      .insert(schema.users)
      .values({ email: `implicit-${run}@devhelp.test`, name: "Implicit" })
      .returning()) as unknown as [{ id: string }];
    try {
      // No enroll() call: the first lesson enrols implicitly through a derived event.
      await recordEvent({
        userId: implicit.id,
        kind: "lesson_completed",
        lessonId: lessons[0]!,
        idempotencyKey: `imp:${run}:0`,
      });
      const before = await db.query.userActivity.findMany({
        where: eq(schema.userActivity.userId, implicit.id),
      });
      await rebuildLearner(implicit.id);
      const after = await db.query.userActivity.findMany({
        where: eq(schema.userActivity.userId, implicit.id),
      });
      expect(after.map((a) => `${a.day}:${a.events}`)).toEqual(
        before.map((a) => `${a.day}:${a.events}`),
      );
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, implicit.id));
    }
  });

  it("computes the streak and the activity grid in Karachi days", async () => {
    const s = await db.transaction((tx) => streakFor(tx, user.id));
    expect(s.current).toBeGreaterThanOrEqual(1);
    expect(s.lastActiveDay).toBe(today());
    expect(s.activeDays).toBe(1);
    const grid = await db.transaction((tx) => activityFor(tx, user.id, 53));
    expect(grid).toHaveLength(53 * 7);
    expect(grid.at(-1)).toMatchObject({ day: today() });
    expect(grid.at(-1)!.events).toBeGreaterThan(0);
    expect(grid.filter((d) => d.events > 0)).toHaveLength(1);
  });

  it("a streak breaks when a day is missed and survives a gap of one day", async () => {
    const [other] = (await db
      .insert(schema.users)
      .values({ email: `streak-${run}@devhelp.test`, name: "Streak" })
      .returning()) as unknown as [{ id: string }];
    try {
      // Three days in a row ending yesterday, then a five-day-old day on its own.
      for (const n of [1, 2, 3, 8])
        await db.insert(schema.userActivity).values({
          userId: other.id,
          day: dayAgo(n).toLocaleDateString("en-CA", {
            timeZone: "Asia/Karachi",
          }),
          events: 1,
        });
      const s = await db.transaction((tx) => streakFor(tx, other.id));
      // Last active day is yesterday, so the streak is still current.
      expect(s.current).toBe(3);
      expect(s.longest).toBe(3);
      expect(s.activeDays).toBe(4);
      // Push the last day further back and the streak is over.
      await db
        .delete(schema.userActivity)
        .where(eq(schema.userActivity.userId, other.id));
      for (const n of [4, 5])
        await db.insert(schema.userActivity).values({
          userId: other.id,
          day: dayAgo(n).toLocaleDateString("en-CA", {
            timeZone: "Asia/Karachi",
          }),
          events: 1,
        });
      const cold = await db.transaction((tx) => streakFor(tx, other.id));
      expect(cold).toMatchObject({ current: 0, longest: 2 });
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, other.id));
    }
  });
});
