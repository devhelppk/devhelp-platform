import { and, asc, count, eq, isNull, max, schema } from "@repo/database";
import type { Tx } from "./types";

/**
 * Certificates (S7). Issued inside the course-completion transaction; one
 * per learner per course. `certificateSnapshot` freezes what was done so the
 * verify page can show it after the course changes.
 */
export async function certificateSnapshot(
  tx: Tx,
  userId: string,
  courseId: string,
) {
  const course = await tx.query.courses.findFirst({
    where: eq(schema.courses.id, courseId),
    columns: { id: true, title: true, completionCriteria: true },
  });
  if (!course) throw new Error(`course ${courseId} not found`);
  // The deployed content at issue time is the newest revision, not the one
  // that last touched this course's row: lessons change without the course.
  const deployed = await tx.query.contentRevisions.findFirst({
    orderBy: (r, { desc: d }) => [d(r.publishedAt)],
    columns: { id: true, commitSha: true, repo: true },
  });
  const lessons = await tx
    .select({
      slug: schema.lessons.slug,
      title: schema.lessons.title,
      type: schema.lessons.type,
      lessonId: schema.lessons.id,
      completedAt: schema.lessonProgress.completedAt,
    })
    .from(schema.lessons)
    .innerJoin(
      schema.lessonProgress,
      and(
        eq(schema.lessonProgress.lessonId, schema.lessons.id),
        eq(schema.lessonProgress.userId, userId),
        eq(schema.lessonProgress.status, "completed"),
      ),
    )
    .where(
      and(
        eq(schema.lessons.courseId, courseId),
        eq(schema.lessons.isRequired, true),
        isNull(schema.lessons.archivedAt),
      ),
    )
    .orderBy(asc(schema.lessons.position));
  const quizzes = await tx
    .select({
      lessonSlug: schema.lessons.slug,
      title: schema.lessons.title,
      passScore: schema.quizzes.passScore,
      bestScore: max(schema.quizAttempts.score),
    })
    .from(schema.quizzes)
    .innerJoin(schema.lessons, eq(schema.lessons.id, schema.quizzes.lessonId))
    .leftJoin(
      schema.quizAttempts,
      and(
        eq(schema.quizAttempts.quizId, schema.quizzes.id),
        eq(schema.quizAttempts.userId, userId),
      ),
    )
    .where(
      and(
        eq(schema.lessons.courseId, courseId),
        isNull(schema.lessons.archivedAt),
      ),
    )
    .groupBy(
      schema.lessons.slug,
      schema.lessons.title,
      schema.quizzes.passScore,
      schema.lessons.position,
    )
    .orderBy(asc(schema.lessons.position));
  return {
    course: { ...course, contentRevisionId: deployed?.id ?? null },
    criteria: {
      criteria: course.completionCriteria,
      lessons: lessons.map((l) => ({
        slug: l.slug,
        title: l.title,
        type: l.type,
        completedAt: (l.completedAt ?? new Date()).toISOString(),
      })),
      quizzes: quizzes
        .filter((q) => q.bestScore !== null)
        .map((q) => ({
          lessonSlug: q.lessonSlug,
          title: q.title,
          bestScore: Number(q.bestScore),
          passScore: q.passScore,
        })),
      // Accepted projects arrive with S8; the shape is fixed now so the verify page and PDF need no change.
      projects: [] as { lessonSlug: string; title: string; repoUrl: string }[],
      contentCommit: deployed?.commitSha ?? undefined,
      contentRepo: deployed?.repo ?? undefined,
    },
  };
}

/** Issues the certificate if the learner has none for the course. Idempotent; never overwrites. */
export async function issueCertificate(
  tx: Tx,
  input: {
    userId: string;
    courseId: string;
    issuedAt: Date;
    enrolmentGeneration: number;
  },
) {
  const existing = await tx.query.certificates.findFirst({
    where: and(
      eq(schema.certificates.userId, input.userId),
      eq(schema.certificates.courseId, input.courseId),
    ),
    columns: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const user = await tx.query.users.findFirst({
    where: eq(schema.users.id, input.userId),
    columns: { name: true },
  });
  if (!user) throw new Error(`user ${input.userId} not found`);
  const { course, criteria } = await certificateSnapshot(
    tx,
    input.userId,
    input.courseId,
  );
  const values = {
    userId: input.userId,
    courseId: input.courseId,
    enrolmentGeneration: input.enrolmentGeneration,
    learnerName: user.name,
    courseTitle: course.title,
    contentRevisionId: course.contentRevisionId,
    criteria,
    issuedAt: input.issuedAt,
  };
  // The commit lives in `criteria` (immutable); the revision row is only a
  // convenience and the content sync may prune it between read and write.
  const [row] = await tx
    .insert(schema.certificates)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: schema.certificates.id })
    .catch(async (e: unknown) => {
      const code =
        (e as { code?: string }).code ??
        (e as { cause?: { code?: string } }).cause?.code;
      if (code !== "23503") throw e;
      return tx
        .insert(schema.certificates)
        .values({ ...values, contentRevisionId: null })
        .onConflictDoNothing()
        .returning({ id: schema.certificates.id });
    });
  if (!row) {
    const again = await tx.query.certificates.findFirst({
      where: and(
        eq(schema.certificates.userId, input.userId),
        eq(schema.certificates.courseId, input.courseId),
      ),
      columns: { id: true },
    });
    return { id: again!.id, created: false };
  }
  return { id: row.id, created: true };
}

/**
 * How many times the learner has enrolled in the course so far. Recorded on
 * the certificate as the enrolment that earned it; during a replay or the
 * backfill this is the count at that moment, not a historical reconstruction.
 */
export async function generationAt(tx: Tx, userId: string, courseId: string) {
  const [row] = await tx
    .select({ n: count() })
    .from(schema.progressEvents)
    .where(
      and(
        eq(schema.progressEvents.userId, userId),
        eq(schema.progressEvents.courseId, courseId),
        eq(schema.progressEvents.kind, "course_enrolled"),
      ),
    );
  return Math.max(row?.n ?? 0, 1);
}
