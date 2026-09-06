import { and, count, eq, schema } from "@repo/database";
import { db } from "@repo/database";

type Db = typeof db;

/**
 * How many times this learner has enrolled in the course (auto-enrol counts).
 * Lesson start/complete idempotency keys carry it (`:g<n>`) so a lesson can be
 * re-done after drop + re-enrol.
 */
export async function enrolmentGeneration(
  conn: Db,
  userId: string,
  courseId: string,
): Promise<number> {
  const [row] = await conn
    .select({ n: count() })
    .from(schema.progressEvents)
    .where(
      and(
        eq(schema.progressEvents.userId, userId),
        eq(schema.progressEvents.courseId, courseId),
        eq(schema.progressEvents.kind, "course_enrolled"),
      ),
    );
  return row?.n ?? 0;
}

/** Idempotency key for a lesson start/complete in the current enrolment generation. */
export function lessonEventKey(
  kind: "lesson_started" | "lesson_completed",
  userId: string,
  lessonId: string,
  generation: number,
) {
  return `${kind}:${userId}:${lessonId}:g${generation}`;
}
