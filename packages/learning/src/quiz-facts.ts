import { and, eq, isNull, max, schema } from "@repo/database";
import type { Tx } from "./types";

/**
 * Best score per live quiz on a required lesson, averaged; undefined when the
 * learner has not attempted one of them (so `minQuizScore` stays unmet).
 * Optional lessons never gate completion, so their quizzes are not counted.
 */
export async function quizScoreFacts(
  tx: Tx,
  userId: string,
  courseId: string,
): Promise<{
  quizScoreAvg?: number;
  quizzesTotal: number;
  quizzesAttempted: number;
}> {
  const quizzes = await tx
    .select({ id: schema.quizzes.id })
    .from(schema.quizzes)
    .innerJoin(schema.lessons, eq(schema.lessons.id, schema.quizzes.lessonId))
    .where(
      and(
        eq(schema.lessons.courseId, courseId),
        eq(schema.lessons.isRequired, true),
        isNull(schema.lessons.archivedAt),
      ),
    );
  if (quizzes.length === 0) return { quizzesTotal: 0, quizzesAttempted: 0 };
  const best = await tx
    .select({
      quizId: schema.quizAttempts.quizId,
      best: max(schema.quizAttempts.score),
    })
    .from(schema.quizAttempts)
    .where(
      and(
        eq(schema.quizAttempts.userId, userId),
        eq(schema.quizAttempts.courseId, courseId),
      ),
    )
    .groupBy(schema.quizAttempts.quizId);
  const byQuiz = new Map(best.map((b) => [b.quizId, Number(b.best ?? 0)]));
  const attempted = quizzes.filter((q) => byQuiz.has(q.id));
  if (attempted.length < quizzes.length)
    return { quizzesTotal: quizzes.length, quizzesAttempted: attempted.length };
  const avg =
    attempted.reduce((n, q) => n + (byQuiz.get(q.id) ?? 0), 0) /
    attempted.length;
  return {
    quizScoreAvg: Math.round(avg),
    quizzesTotal: quizzes.length,
    quizzesAttempted: attempted.length,
  };
}
