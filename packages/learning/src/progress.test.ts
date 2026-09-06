import { db, eq, schema } from "@repo/database";
import { afterAll, describe, expect, it } from "vitest";
import { enroll, rebuildLearner, recordEvent } from "./index";
import {
  cleanup,
  createCourse,
  createUser,
  events,
  snapshot,
} from "./test-helpers";

const users: string[] = [];
const courses: string[] = [];
afterAll(() => cleanup(users, courses));

async function setup(
  opts: Parameters<typeof createCourse>[0] = { required: 2 },
) {
  const user = await createUser();
  const c = await createCourse(opts);
  users.push(user.id);
  courses.push(c.course.id);
  return { user, ...c };
}

const complete = (userId: string, lessonId: string, at?: Date) =>
  recordEvent({
    userId,
    kind: "lesson_completed",
    lessonId,
    idempotencyKey: `lesson_completed:${userId}:${lessonId}`,
    occurredAt: at,
  });

describe("recordEvent", () => {
  it("ignores a duplicate idempotency key and leaves read models unchanged", async () => {
    const { user, required } = await setup();
    const first = await complete(user.id, required[0]!.id);
    expect(first.duplicate).toBe(false);
    const before = await snapshot(user.id);

    const second = await complete(user.id, required[0]!.id);
    expect(second.duplicate).toBe(true);
    expect(second.eventId).toBeUndefined();

    const after = await snapshot(user.id);
    expect(after.enrollments).toEqual(before.enrollments);
    expect(after.progress).toEqual(before.progress);
    expect(after.updatedAts).toEqual(before.updatedAts);
    expect((await events(user.id, "lesson_completed")).length).toBe(1);
  });

  it("auto-enrols on the first lesson event and emits course_enrolled", async () => {
    const { user, course, required } = await setup();
    await recordEvent({
      userId: user.id,
      kind: "lesson_started",
      lessonId: required[0]!.id,
      idempotencyKey: `lesson_started:${user.id}:${required[0]!.id}`,
    });
    const enrolled = await events(user.id, "course_enrolled");
    expect(enrolled).toHaveLength(1);
    const snap = await snapshot(user.id);
    expect(snap.enrollments[0]).toMatchObject({
      courseId: course.id,
      status: "active",
      lastLessonId: required[0]!.id,
      progressPercent: 0,
    });
    expect(snap.progress[0]).toMatchObject({
      status: "in_progress",
      progressPercent: 0,
    });
    const [row] = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, course.id));
    expect(row!.enrollmentCount).toBe(1);
  });

  it("flips the enrolment to completed in the same call that completes the last required lesson", async () => {
    const { user, course, required, optional } = await setup({
      required: 2,
      optional: 1,
    });
    // An optional lesson never completes the course.
    const opt = await complete(user.id, optional[0]!.id);
    expect(opt.courseCompleted).toBe(false);
    const a = await complete(user.id, required[0]!.id);
    expect(a.courseCompleted).toBe(false);
    let snap = await snapshot(user.id);
    expect(snap.enrollments[0]!.progressPercent).toBe(50);

    const b = await complete(user.id, required[1]!.id);
    expect(b.courseCompleted).toBe(true);
    snap = await snapshot(user.id);
    expect(snap.enrollments[0]).toMatchObject({
      courseId: course.id,
      status: "completed",
      progressPercent: 100,
    });
    expect(snap.enrollments[0]!.completedAt).not.toBeNull();
    expect(await events(user.id, "course_completed")).toHaveLength(1);
  });

  it("emits exactly one course_completed when the last two lessons complete concurrently", async () => {
    // The pool is > 1 (DATABASE_POOL_MAX), so these transactions really overlap;
    // repeat so the interleaving is exercised, not just one lucky ordering.
    for (let i = 0; i < 8; i++) {
      const { user, required } = await setup({ required: 2 });
      const results = await Promise.all([
        complete(user.id, required[0]!.id),
        complete(user.id, required[1]!.id),
      ]);
      expect(results.filter((r) => r.courseCompleted)).toHaveLength(1);
      expect(await events(user.id, "course_completed")).toHaveLength(1);
      expect((await snapshot(user.id)).enrollments[0]!.status).toBe(
        "completed",
      );
    }
  });

  it("keeps progress monotonic and reactivates a dropped enrolment", async () => {
    const { user, course, required } = await setup({ required: 2 });
    const tick = (percent: number, n: number) =>
      recordEvent({
        userId: user.id,
        kind: "lesson_progressed",
        lessonId: required[0]!.id,
        payload: { percent, positionSeconds: n * 10 },
        idempotencyKey: `lesson_progressed:${user.id}:${required[0]!.id}:${n}`,
      });
    await tick(40, 1);
    await tick(20, 2); // a late, lower tick must not regress percent
    let snap = await snapshot(user.id);
    expect(snap.progress[0]).toMatchObject({
      progressPercent: 40,
      lastPositionSeconds: 20,
    });

    await recordEvent({
      userId: user.id,
      kind: "course_dropped",
      courseId: course.id,
      idempotencyKey: `course_dropped:${user.id}:${course.id}:1`,
    });
    snap = await snapshot(user.id);
    expect(snap.enrollments[0]!.status).toBe("dropped");

    // One-click enrol after a drop reactivates; retrying it is a no-op.
    const re = await enroll(user.id, course.id);
    expect(re.duplicate).toBe(false);
    expect((await enroll(user.id, course.id)).duplicate).toBe(true);
    snap = await snapshot(user.id);
    expect(snap.enrollments[0]).toMatchObject({
      status: "active",
      droppedAt: null,
      completedAt: null,
      progressPercent: 0,
    });
    // Drop and enrol a second time: a new generation, so it is not a duplicate.
    await recordEvent({
      userId: user.id,
      kind: "course_dropped",
      courseId: course.id,
      idempotencyKey: `course_dropped:${user.id}:${course.id}:2`,
    });
    expect((await enroll(user.id, course.id)).duplicate).toBe(false);
    expect((await snapshot(user.id)).enrollments[0]!.status).toBe("active");
  });

  it("re-enrols implicitly when a dropped learner keeps learning, and can complete a course twice", async () => {
    const { user, course, required } = await setup({ required: 1 });
    const first = await complete(user.id, required[0]!.id);
    expect(first.courseCompleted).toBe(true);
    await recordEvent({
      userId: user.id,
      kind: "course_dropped",
      courseId: course.id,
      idempotencyKey: `drop:${user.id}`,
    });
    // A new required lesson is added; the learner comes back and finishes it.
    const [mod] = await db
      .select()
      .from(schema.modules)
      .where(eq(schema.modules.courseId, course.id));
    const [added] = await db
      .insert(schema.lessons)
      .values({
        moduleId: mod!.id,
        courseId: course.id,
        slug: "req-new",
        title: "New",
        position: 9,
      })
      .returning();
    const again = await complete(user.id, added!.id);
    expect(again.courseCompleted).toBe(true);
    expect(await events(user.id, "course_completed")).toHaveLength(2);
    expect(await events(user.id, "course_enrolled")).toHaveLength(2);
    const [row] = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, course.id));
    expect(row!.enrollmentCount).toBe(1); // reactivation is not a new enrolment
  });

  it("validates per-kind payloads before writing and requires a lesson for lesson-scoped kinds", async () => {
    const { user, course, required } = await setup({ required: 1 });
    await expect(
      recordEvent({
        userId: user.id,
        kind: "lesson_progressed",
        lessonId: required[0]!.id,
        payload: { percent: 500 },
        idempotencyKey: `bad-payload:${user.id}`,
      }),
    ).rejects.toThrow();
    await expect(
      recordEvent({
        userId: user.id,
        kind: "quiz_attempted",
        courseId: course.id,
        idempotencyKey: `no-lesson:${user.id}`,
      }),
    ).rejects.toThrow(/requires lessonId/);
    expect(await events(user.id)).toHaveLength(0);
  });

  it("rejects a lesson that does not belong to the given course", async () => {
    const { user, required } = await setup({ required: 1 });
    const other = await setup({ required: 1 });
    await expect(
      recordEvent({
        userId: user.id,
        kind: "lesson_completed",
        courseId: other.course.id,
        lessonId: required[0]!.id,
        idempotencyKey: `bad:${user.id}`,
      }),
    ).rejects.toThrow(/does not belong/);
  });
});

describe("rebuildLearner", () => {
  it("reproduces the read models byte-for-byte from the stream", async () => {
    const { user, course, required } = await setup({
      required: 3,
      optional: 1,
    });
    const t = (s: number) => new Date(Date.UTC(2026, 8, 1, 0, 0, s));
    await recordEvent({
      userId: user.id,
      kind: "lesson_started",
      lessonId: required[0]!.id,
      idempotencyKey: `s:${user.id}:0`,
      occurredAt: t(1),
    });
    await recordEvent({
      userId: user.id,
      kind: "lesson_progressed",
      lessonId: required[0]!.id,
      payload: { percent: 50, positionSeconds: 30 },
      idempotencyKey: `p:${user.id}:0`,
      occurredAt: t(2),
    });
    await complete(user.id, required[0]!.id, t(3));
    await recordEvent({
      userId: user.id,
      kind: "course_dropped",
      courseId: course.id,
      idempotencyKey: `d:${user.id}`,
      occurredAt: t(4),
    });
    await recordEvent({
      userId: user.id,
      kind: "course_enrolled",
      courseId: course.id,
      idempotencyKey: `e2:${user.id}`,
      occurredAt: t(5),
    });
    await complete(user.id, required[1]!.id, t(6));
    await complete(user.id, required[2]!.id, t(7));

    const before = await snapshot(user.id);
    expect(before.enrollments[0]!.status).toBe("completed");
    const eventsBefore = (await events(user.id)).length;

    const { events: replayed } = await rebuildLearner(user.id);
    expect(replayed).toBe(eventsBefore);
    expect((await events(user.id)).length).toBe(eventsBefore); // replay never appends

    const after = await snapshot(user.id);
    expect(after.enrollments).toEqual(before.enrollments);
    expect(after.progress).toEqual(before.progress);
    // updatedAt is derived from each event's recordedAt, so even it reproduces exactly.
    expect(after.updatedAts).toEqual(before.updatedAts);
    // Course-level aggregates are untouched by replay.
    const [row] = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, course.id));
    expect(row!.enrollmentCount).toBe(1);
    await rebuildLearner(user.id);
    expect(
      (
        await db
          .select()
          .from(schema.courses)
          .where(eq(schema.courses.id, course.id))
      )[0]!.enrollmentCount,
    ).toBe(1);
  });

  it("is deterministic across repeated rebuilds of a one-event history", async () => {
    // Trigger + two derived events share occurredAt/recordedAt; only seq orders them.
    const { user, required } = await setup({ required: 1 });
    await complete(user.id, required[0]!.id);
    const before = await snapshot(user.id);
    expect(before.enrollments[0]).toMatchObject({
      status: "completed",
      lastLessonId: required[0]!.id,
    });
    for (let i = 0; i < 10; i++) {
      await rebuildLearner(user.id);
      const after = await snapshot(user.id);
      expect(after.enrollments).toEqual(before.enrollments);
      expect(after.progress).toEqual(before.progress);
    }
  });

  it("still rebuilds a learner whose course was hard-deleted", async () => {
    const { user, required } = await setup({ required: 1 });
    const other = await setup({ required: 1 });
    await complete(user.id, required[0]!.id);
    await complete(user.id, other.required[0]!.id);
    await db
      .delete(schema.courses)
      .where(eq(schema.courses.id, other.course.id));
    const { events: replayed } = await rebuildLearner(user.id);
    expect(replayed).toBeGreaterThan(0);
    const snap = await snapshot(user.id);
    expect(snap.enrollments).toHaveLength(1);
    expect(snap.enrollments[0]!.status).toBe("completed");
  });

  it("excludes archived required lessons, and rebuild agrees", async () => {
    const { user, required } = await setup({ required: 3 });
    await complete(user.id, required[0]!.id);
    await db
      .update(schema.lessons)
      .set({ archivedAt: new Date() })
      .where(eq(schema.lessons.id, required[2]!.id));
    const r = await complete(user.id, required[1]!.id);
    expect(r.courseCompleted).toBe(true);
    const before = await snapshot(user.id);
    await rebuildLearner(user.id);
    const after = await snapshot(user.id);
    expect(after.enrollments).toEqual(before.enrollments);
    expect(after.progress).toEqual(before.progress);
  });
});
