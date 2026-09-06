import { asc, db, eq, schema } from "@repo/database";
import { applyEvent } from "./reducer";

/**
 * Recompute a learner's read models from their event stream. Derived events
 * are already in the stream, so replay never emits and never touches
 * course-level aggregates (enrollment_count). Events whose subject was hard-
 * deleted (course/lesson id nulled by ON DELETE SET NULL) are skipped.
 */
export async function rebuildLearner(
  userId: string,
): Promise<{ events: number }> {
  return db.transaction(async (tx) => {
    await tx
      .delete(schema.lessonProgress)
      .where(eq(schema.lessonProgress.userId, userId));
    await tx
      .delete(schema.enrollments)
      .where(eq(schema.enrollments.userId, userId));
    const events = await tx.query.progressEvents.findMany({
      where: eq(schema.progressEvents.userId, userId),
      // Insert order is the only total order: derived events share occurredAt/recordedAt with their trigger.
      orderBy: [asc(schema.progressEvents.seq)],
    });
    for (const ev of events) {
      await applyEvent(tx, ev, { emit: false });
    }
    return { events: events.length };
  });
}
