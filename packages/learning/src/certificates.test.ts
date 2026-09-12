import { db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertCertificateRow } from "./certificates";
import { enroll, recordEvent } from "./record-event";
import { rebuildLearner } from "./rebuild";

const run = crypto.randomUUID().slice(0, 8);
let user: { id: string }, courseId: string, lessonId: string;

beforeAll(async () => {
  [user] = (await db
    .insert(schema.users)
    .values({ email: `cert-${run}@devhelp.test`, name: "Cert Learner" })
    .returning()) as unknown as [{ id: string }];
  const [course] = await db
    .insert(schema.courses)
    .values({
      slug: `cert-${run}`,
      title: `Cert course ${run}`,
      summary: "A course for certificate tests, long enough.",
      isPublished: true,
    })
    .returning();
  courseId = course!.id;
  const [mod] = await db
    .insert(schema.modules)
    .values({ courseId, slug: "m1", title: "M1", position: 1 })
    .returning();
  const [lesson] = await db
    .insert(schema.lessons)
    .values({
      courseId,
      moduleId: mod!.id,
      slug: "only",
      title: "Only lesson",
      type: "article",
      position: 1,
    })
    .returning();
  lessonId = lesson!.id;
});
afterAll(async () => {
  await db.delete(schema.courses).where(eq(schema.courses.id, courseId));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
});

describe("certificates", () => {
  it("issues once inside completion with a snapshot, survives replay, and is not reissued after re-enrol", async () => {
    await enroll(user.id, courseId);
    const r = await recordEvent({
      userId: user.id,
      kind: "lesson_completed",
      lessonId,
      idempotencyKey: `cert:${run}:1`,
    });
    expect(r.courseCompleted).toBe(true);
    expect(r.certificateId).toBeTruthy();
    const cert = await db.query.certificates.findFirst({
      where: eq(schema.certificates.id, r.certificateId!),
    });
    expect(cert).toMatchObject({
      userId: user.id,
      courseId,
      learnerName: "Cert Learner",
      enrolmentGeneration: 1,
      revokedAt: null,
    });
    expect(cert?.criteria.lessons.map((l) => l.slug)).toEqual(["only"]);
    expect(cert?.criteria.quizzes).toEqual([]);
    // Replay keeps exactly one row with the same id.
    await rebuildLearner(user.id);
    const rows = await db.query.certificates.findMany({
      where: eq(schema.certificates.userId, user.id),
    });
    expect(rows.map((c) => c.id)).toEqual([cert!.id]);
    // Drop, re-enrol, complete again: still one certificate (founder decision).
    await recordEvent({
      userId: user.id,
      kind: "course_dropped",
      courseId,
      idempotencyKey: `cert:${run}:drop`,
    });
    await enroll(user.id, courseId);
    const again = await recordEvent({
      userId: user.id,
      kind: "lesson_completed",
      lessonId,
      idempotencyKey: `cert:${run}:2`,
    });
    expect(again.courseCompleted).toBe(true);
    expect(again.certificateId).toBeUndefined();
    expect(
      (
        await db.query.certificates.findMany({
          where: eq(schema.certificates.userId, user.id),
        })
      ).length,
    ).toBe(1);
    // The learner was notified once.
    const n = await db.query.notifications.findMany({
      where: eq(schema.notifications.userId, user.id),
    });
    expect(n.filter((x) => x.kind === "certificate_issued")).toHaveLength(1);
  });
  /**
   * Regression, S8/S10b/S11 intermittent failure: the content sync can delete
   * the `content_revisions` row between the snapshot read and the certificate
   * insert. The FK violation must not abort the surrounding transaction — it
   * used to, because the fallback insert ran in an already-aborted transaction
   * and failed with "current transaction is aborted", killing course completion.
   */
  it("survives a content revision deleted between snapshot and insert, without aborting the transaction", async () => {
    const [other] = (await db
      .insert(schema.users)
      .values({ email: `cert-fk-${run}@devhelp.test`, name: "FK Learner" })
      .returning()) as unknown as [{ id: string }];
    try {
      const afterwards = await db.transaction(async (tx) => {
        const [row] = await insertCertificateRow(tx, {
          userId: other.id,
          courseId,
          enrolmentGeneration: 1,
          learnerName: "FK Learner",
          courseTitle: `Cert course ${run}`,
          // A revision id that is not in the table: exactly what a concurrent
          // sync leaves behind.
          contentRevisionId: crypto.randomUUID(),
          criteria: {
            criteria: { requireAllRequiredLessons: true },
            lessons: [],
            quizzes: [],
            projects: [],
          },
          issuedAt: new Date(),
        });
        expect(row?.id).toBeTruthy();
        // The transaction is still usable: this is the assertion that fails
        // without the savepoint.
        const check = await tx.query.certificates.findFirst({
          where: eq(schema.certificates.id, row!.id),
          columns: { id: true, contentRevisionId: true },
        });
        return check;
      });
      expect(afterwards?.contentRevisionId).toBeNull();
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, other.id));
    }
  });
});
