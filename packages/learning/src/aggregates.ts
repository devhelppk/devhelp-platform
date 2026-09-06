import { and, eq, isNull, schema, sql } from "@repo/database";
import type { Tx } from "./types";

/**
 * Lesson aggregates from lesson_feedback and comments (S6). Called inside the
 * transaction that changed them (N4.2), so a read never sees a stale column.
 */
export async function recomputeLessonAggregates(tx: Tx, lessonId: string) {
  const [f] = await tx
    .select({
      avg: sql<
        string | null
      >`round(avg(${schema.lessonFeedback.rating})::numeric, 2)`,
      count: sql<number>`count(*)::int`,
      unclear: sql<number>`count(*) filter (where 'unclear' = any(${schema.lessonFeedback.tags}))::int`,
    })
    .from(schema.lessonFeedback)
    .where(eq(schema.lessonFeedback.lessonId, lessonId));
  const [q] = await tx
    .select({ open: sql<number>`count(*)::int` })
    .from(schema.comments)
    .where(
      and(
        eq(schema.comments.subjectType, "lesson"),
        eq(schema.comments.subjectId, lessonId),
        isNull(schema.comments.parentId),
        eq(schema.comments.kind, "question"),
        eq(schema.comments.status, "visible"),
        eq(schema.comments.replyCount, 0),
        isNull(schema.comments.acceptedAt),
      ),
    );
  await tx
    .update(schema.lessons)
    .set({
      ratingAvg: f?.avg ?? null,
      ratingCount: f?.count ?? 0,
      unclearCount: f?.unclear ?? 0,
      openQuestionCount: q?.open ?? 0,
    })
    .where(eq(schema.lessons.id, lessonId));
}

/** Course aggregates from visible course_reviews. */
export async function recomputeCourseAggregates(tx: Tx, courseId: string) {
  const [r] = await tx
    .select({
      avg: sql<
        string | null
      >`round(avg(${schema.courseReviews.rating})::numeric, 2)`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.courseReviews)
    .where(
      and(
        eq(schema.courseReviews.courseId, courseId),
        eq(schema.courseReviews.status, "visible"),
      ),
    );
  await tx
    .update(schema.courses)
    .set({
      ratingAvg: r?.avg ?? null,
      ratingCount: r?.count ?? 0,
      reviewCount: r?.count ?? 0,
    })
    .where(eq(schema.courses.id, courseId));
}
