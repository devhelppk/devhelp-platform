import { and, db, eq, schema } from "@repo/database";
import { applyEvent } from "./reducer";
import {
  courseEnrolledPayload,
  lessonProgressedPayload,
  recordEventInput,
  type RecordEventInput,
  type RecordEventResult,
} from "./types";

/**
 * Append one event to the learner's stream and update the read models in the
 * same transaction. Duplicate idempotency keys are ignored (`duplicate: true`).
 */
export async function recordEvent(
  raw: RecordEventInput,
): Promise<RecordEventResult> {
  const input = recordEventInput.parse(raw);

  let courseId = input.courseId;
  if (input.lessonId) {
    const lesson = await db.query.lessons.findFirst({
      where: eq(schema.lessons.id, input.lessonId),
      columns: { courseId: true },
    });
    if (!lesson) throw new Error(`Unknown lesson ${input.lessonId}`);
    if (courseId && courseId !== lesson.courseId) {
      throw new Error(
        `Lesson ${input.lessonId} does not belong to course ${courseId}`,
      );
    }
    courseId = lesson.courseId;
  }
  if (input.kind.startsWith("course_") && !courseId) {
    throw new Error(`${input.kind} requires courseId`);
  }
  if (!input.kind.startsWith("course_") && !input.lessonId) {
    throw new Error(`${input.kind} requires lessonId`);
  }
  // Per-kind payload validation happens before anything is written.
  if (input.kind === "lesson_progressed")
    lessonProgressedPayload.parse(input.payload ?? {});
  if (input.kind === "course_enrolled")
    courseEnrolledPayload.parse(input.payload ?? {});

  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(schema.progressEvents)
      .values({
        userId: input.userId,
        kind: input.kind,
        courseId: courseId ?? null,
        lessonId: input.lessonId ?? null,
        payload: input.payload ?? null,
        idempotencyKey: input.idempotencyKey,
        occurredAt: input.occurredAt ?? new Date(),
      })
      .onConflictDoNothing({ target: schema.progressEvents.idempotencyKey })
      .returning();
    if (!event) return { duplicate: true };
    const { courseCompleted } = await applyEvent(tx, event, { emit: true });
    return { duplicate: false, eventId: event.id, courseCompleted };
  });
}

/**
 * One-click enrol. Same event path as the implicit enrol on a first lesson.
 * Already-enrolled learners get `duplicate: true` without a write; after a drop
 * the key carries the drop time as a "generation", so re-enrolling works while
 * retries in the same state stay idempotent.
 */
export async function enroll(
  userId: string,
  courseId: string,
  opts: { teamId?: string } = {},
) {
  const current = await db.query.enrollments.findFirst({
    where: and(
      eq(schema.enrollments.userId, userId),
      eq(schema.enrollments.courseId, courseId),
    ),
    columns: { status: true, droppedAt: true },
  });
  // Already enrolled (active or completed): nothing to record.
  if (current && current.status !== "dropped") return { duplicate: true };
  const generation = current ? (current.droppedAt?.getTime() ?? 0) : 0;
  return recordEvent({
    userId,
    kind: "course_enrolled",
    courseId,
    payload: opts.teamId ? { teamId: opts.teamId } : undefined,
    idempotencyKey: `course_enrolled:${userId}:${courseId}:${generation}`,
  });
}
