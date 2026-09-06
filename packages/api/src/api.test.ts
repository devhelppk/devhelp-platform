import { and, db, eq, inArray, schema } from "@repo/database";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

/**
 * Integration tests over a private course so real content stays untouched.
 * Sessions are stubbed: the router only reads `ctx.session.user`.
 */
const run = Date.now().toString(36);
const slug = `api-${run}`;
let user: typeof schema.users.$inferSelect;
let courseId: string;
let lessonIds: string[] = [];

const ctxFor = (u: typeof user | null): Context =>
  ({
    db,
    headers: new Headers(),
    session: u
      ? ({
          user: { ...u, role: u.role ?? "student" },
          session: { id: "s", userId: u.id },
        } as unknown as Context["session"])
      : null,
  }) as Context;
const as = (u: typeof user | null) => createCaller(ctxFor(u));

beforeAll(async () => {
  [user] = (await db
    .insert(schema.users)
    .values({ email: `api-${run}@devhelp.test`, name: "Api Tester" })
    .returning()) as [typeof user];
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug,
      title: `Api Course ${run}`,
      summary:
        "A private course for API tests, long enough for the summary rule.",
      isPublished: true,
      track: "career",
      level: "intermediate",
    })
    .returning();
  courseId = course!.id;
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId, slug: "m1", title: "Module 1", position: 1 })
    .returning();
  const rows = await db
    .insert(schema.lessons)
    .values([
      {
        moduleId: mod!.id,
        courseId,
        slug: "one",
        title: "One",
        position: 1001,
        type: "article",
        completionRule: "view",
      },
      {
        moduleId: mod!.id,
        courseId,
        slug: "two",
        title: "Two",
        position: 1002,
        type: "video",
        completionRule: "view",
        videoProvider: "youtube",
        videoId: "x".repeat(11),
      },
      {
        moduleId: mod!.id,
        courseId,
        slug: "optional",
        title: "Optional",
        position: 1003,
        type: "link",
        completionRule: "view",
        isRequired: false,
      },
      {
        moduleId: mod!.id,
        courseId,
        slug: "quiz",
        title: "Quiz",
        position: 1004,
        type: "quiz",
        completionRule: "quiz_pass",
        isRequired: false,
      },
    ])
    .returning();
  lessonIds = rows.map((r) => r.id);
  // An archived course that must never show up.
  await db.insert(schema.courses).values({
    slug: `${slug}-archived`,
    title: "Archived",
    summary: "Archived course summary text here.",
    isPublished: true,
    archivedAt: new Date(),
  });
});

afterAll(async () => {
  await db
    .delete(schema.courses)
    .where(inArray(schema.courses.slug, [slug, `${slug}-archived`]));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
});

describe("catalogue", () => {
  it("lists published, live courses with filters and lesson counts", async () => {
    const all = await as(null).catalogue.listCourses();
    expect(all.some((c) => c.slug === slug)).toBe(true);
    expect(all.some((c) => c.slug === `${slug}-archived`)).toBe(false);
    const mine = all.find((c) => c.slug === slug)!;
    expect(mine.lessonCount).toBe(4);
    const career = await as(null).catalogue.listCourses({
      track: "career",
      level: "intermediate",
      q: `Api Course ${run}`,
    });
    expect(career.map((c) => c.slug)).toEqual([slug]);
    expect(
      await as(null).catalogue.listCourses({
        track: "technical",
        q: `Api Course ${run}`,
      }),
    ).toEqual([]);
  });

  it("returns a course with modules and lessons in order", async () => {
    const course = await as(null).catalogue.getCourse({ slug });
    expect(course?.modules[0]!.lessons.map((l) => l.slug)).toEqual([
      "one",
      "two",
      "optional",
      "quiz",
    ]);
    expect(course?.lessonCount).toBe(4);
    expect(
      await as(null).catalogue.getCourse({ slug: `${slug}-archived` }),
    ).toBeNull();
  });
});

describe("learning", () => {
  it("rejects mutations without a session", async () => {
    await expect(
      as(null).learning.enroll({ courseSlug: slug }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("enrols, records progress through the engine, and computes Continue", async () => {
    const caller = as(user);
    expect((await caller.learning.continue({ courseSlug: slug }))?.slug).toBe(
      "one",
    );
    const r = await caller.learning.enroll({ courseSlug: slug });
    expect(r.duplicate).toBe(false);
    expect((await caller.learning.enroll({ courseSlug: slug })).duplicate).toBe(
      true,
    );

    await caller.learning.lessonStarted({
      courseSlug: slug,
      lessonSlug: "one",
    });
    await caller.learning.lessonProgressed({
      courseSlug: slug,
      lessonSlug: "two",
      percent: 40,
      positionSeconds: 30,
      nonce: "n1",
    });
    const done = await caller.learning.lessonCompleted({
      courseSlug: slug,
      lessonSlug: "one",
    });
    expect(done.courseCompleted).toBe(false);

    const progress = await caller.learning.myProgress({ courseSlug: slug });
    expect(progress.enrollment?.status).toBe("active");
    expect(
      progress.lessons.find((l) => l.slug === "one")?.progress?.status,
    ).toBe("completed");
    expect(
      progress.lessons.find((l) => l.slug === "two")?.progress?.progressPercent,
    ).toBe(40);
    expect(progress.continue?.slug).toBe("two");

    const events = await db.query.progressEvents.findMany({
      where: and(
        eq(schema.progressEvents.userId, user.id),
        inArray(schema.progressEvents.lessonId, lessonIds),
      ),
    });
    expect(events.map((e) => e.kind).sort()).toEqual([
      "lesson_completed",
      "lesson_progressed",
      "lesson_started",
    ]);

    const finished = await caller.learning.lessonCompleted({
      courseSlug: slug,
      lessonSlug: "two",
    });
    expect(finished.courseCompleted).toBe(true);
    expect((await caller.learning.myEnrollments())[0]?.status).toBe(
      "completed",
    );
    // Every required lesson done: Continue falls back to the first lesson.
    expect((await caller.learning.continue({ courseSlug: slug }))?.slug).toBe(
      "one",
    );
  });

  it("can complete the course again after drop and re-enrol (generation-scoped keys), and hides dropped enrolments", async () => {
    const caller = as(user);
    await caller.learning.drop({ courseSlug: slug, nonce: "d1" });
    expect(await caller.learning.myEnrollments()).toEqual([]);
    expect((await caller.learning.enroll({ courseSlug: slug })).duplicate).toBe(
      false,
    );
    const again = await caller.learning.lessonCompleted({
      courseSlug: slug,
      lessonSlug: "one",
    });
    expect(again.duplicate).toBe(false);
    expect(again.courseCompleted).toBe(true);
    expect((await caller.learning.myEnrollments())[0]?.status).toBe(
      "completed",
    );
  });

  it("lists paths with the same visibility rule as the path page", async () => {
    const [path] = await db
      .insert(schema.paths)
      .values({
        slug: `p-${run}`,
        title: "P",
        summary: "Path summary long enough to satisfy checks.",
        isPublished: true,
      })
      .returning();
    const archived = await db.query.courses.findFirst({
      where: eq(schema.courses.slug, `${slug}-archived`),
    });
    await db.insert(schema.pathCourses).values([
      { pathId: path!.id, courseId, position: 0 },
      { pathId: path!.id, courseId: archived!.id, position: 1 },
    ]);
    try {
      const listed = (await as(null).catalogue.listPaths()).find(
        (p) => p.slug === `p-${run}`,
      )!;
      const detail = await as(null).catalogue.getPath({ slug: `p-${run}` });
      expect(listed.courses.map((c) => c.slug)).toEqual([slug]);
      expect(detail?.courses.map((c) => c.slug)).toEqual([slug]);
    } finally {
      await db.delete(schema.paths).where(eq(schema.paths.id, path!.id));
    }
  });

  it("refuses to mark a quiz lesson done through the view path", async () => {
    await expect(
      as(user).learning.lessonCompleted({
        courseSlug: slug,
        lessonSlug: "quiz",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("derives the user from the session, never from input", async () => {
    const [other] = await db
      .insert(schema.users)
      .values({ email: `api-other-${run}@devhelp.test`, name: "Other" })
      .returning();
    try {
      // Extra keys are stripped by Zod; the enrolment lands on the session user.
      await as(other!).learning.enroll({
        courseSlug: slug,
        userId: user.id,
      } as never);
      const rows = await db.query.enrollments.findMany({
        where: eq(schema.enrollments.courseId, courseId),
      });
      expect(rows.map((r) => r.userId).sort()).toEqual(
        [other!.id, user.id].sort(),
      );
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, other!.id));
    }
  });

  it("returns NOT_FOUND for unknown or archived courses", async () => {
    await expect(
      as(user).learning.enroll({ courseSlug: `${slug}-archived` }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      as(user).learning.myProgress({ courseSlug: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
