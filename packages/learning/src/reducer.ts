import { and, eq, isNull, schema, sql } from "@repo/database";
import { evaluateCompletion } from "./criteria";
import type { Tx } from "./types";
import { courseEnrolledPayload, lessonProgressedPayload } from "./types";

type EventRow = typeof schema.progressEvents.$inferSelect;
type ApplyOptions = {
  /** When true, derived events (course_enrolled on first lesson, course_completed) are appended to the stream. */
  emit: boolean;
};
export type ApplyResult = { courseCompleted: boolean };

const { enrollments, lessonProgress, lessons, courses, progressEvents } =
  schema;

/** Single place where read models change. Used by recordEvent (emit) and rebuildLearner (replay). */
export async function applyEvent(
  tx: Tx,
  ev: EventRow,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  // A hard-deleted course/lesson nulls the subject (ON DELETE SET NULL); the
  // event stays as history but can no longer move any read model.
  if (!ev.courseId || (!ev.kind.startsWith("course_") && !ev.lessonId)) {
    return { courseCompleted: false };
  }
  switch (ev.kind) {
    case "course_enrolled":
      await upsertEnrollment(tx, ev, opts);
      return { courseCompleted: false };
    case "course_dropped":
      await tx
        .update(enrollments)
        .set({
          status: "dropped",
          droppedAt: ev.occurredAt,
          updatedAt: ev.recordedAt,
        })
        .where(
          and(
            eq(enrollments.userId, ev.userId),
            eq(enrollments.courseId, requireCourse(ev)),
          ),
        );
      return { courseCompleted: false };
    case "course_completed":
      await tx
        .update(enrollments)
        .set({
          status: "completed",
          progressPercent: 100,
          completedAt: ev.occurredAt,
          updatedAt: ev.recordedAt,
        })
        .where(
          and(
            eq(enrollments.userId, ev.userId),
            eq(enrollments.courseId, requireCourse(ev)),
          ),
        );
      return { courseCompleted: true };
    case "lesson_started":
    case "lesson_progressed":
    case "lesson_completed": {
      const courseId = requireCourse(ev);
      const lessonId = requireLesson(ev);
      await ensureEnrollment(tx, ev, courseId, opts);
      await upsertLessonProgress(tx, ev, courseId, lessonId);
      await tx
        .update(enrollments)
        .set({ lastLessonId: lessonId, updatedAt: ev.recordedAt })
        .where(
          and(
            eq(enrollments.userId, ev.userId),
            eq(enrollments.courseId, courseId),
          ),
        );
      if (ev.kind === "lesson_completed") {
        return recomputeCourse(tx, ev, courseId, opts);
      }
      return { courseCompleted: false };
    }
    case "quiz_attempted":
    case "exercise_submitted":
    case "project_submitted":
      // Stored only; S4 / S8 attach behaviour.
      return { courseCompleted: false };
  }
}

function requireCourse(ev: EventRow): string {
  if (!ev.courseId)
    throw new Error(`${ev.kind} event ${ev.id} has no courseId`);
  return ev.courseId;
}
function requireLesson(ev: EventRow): string {
  if (!ev.lessonId)
    throw new Error(`${ev.kind} event ${ev.id} has no lessonId`);
  return ev.lessonId;
}

async function upsertEnrollment(tx: Tx, ev: EventRow, opts: ApplyOptions) {
  const courseId = requireCourse(ev);
  const payload = courseEnrolledPayload.parse(ev.payload ?? {});
  const [row] = await tx
    .insert(enrollments)
    .values({
      userId: ev.userId,
      courseId,
      status: "active",
      teamId: payload.teamId ?? null,
      enrolledAt: ev.occurredAt,
      updatedAt: ev.recordedAt,
    })
    .onConflictDoUpdate({
      target: [enrollments.userId, enrollments.courseId],
      set: {
        // Re-enrolling after a drop starts a fresh attempt; an active/completed enrolment is untouched.
        status: sql`case when ${enrollments.status} = 'dropped' then 'active'::enrollment_status else ${enrollments.status} end`,
        droppedAt: sql`case when ${enrollments.status} = 'dropped' then null else ${enrollments.droppedAt} end`,
        completedAt: sql`case when ${enrollments.status} = 'dropped' then null else ${enrollments.completedAt} end`,
        progressPercent: sql`case when ${enrollments.status} = 'dropped' then 0 else ${enrollments.progressPercent} end`,
        teamId: payload.teamId ? payload.teamId : sql`${enrollments.teamId}`,
        updatedAt: ev.recordedAt,
      },
    })
    // xmax = 0 means the row was inserted, not updated.
    .returning({ inserted: sql<boolean>`(xmax = 0)` });
  // Course-level aggregates move only on live writes; replay must not re-count.
  if (opts.emit && row?.inserted) {
    await tx
      .update(courses)
      .set({ enrollmentCount: sql`${courses.enrollmentCount} + 1` })
      .where(eq(courses.id, courseId));
  }
}

async function ensureEnrollment(
  tx: Tx,
  ev: EventRow,
  courseId: string,
  opts: ApplyOptions,
) {
  const existing = await tx.query.enrollments.findFirst({
    where: and(
      eq(enrollments.userId, ev.userId),
      eq(enrollments.courseId, courseId),
    ),
    columns: { status: true },
  });
  // Learning again after a drop re-enrols implicitly, like a first lesson would.
  if (existing && existing.status !== "dropped") return;
  if (!opts.emit) {
    // Replaying: the derived course_enrolled event is already in the stream and
    // will follow, but the live path created the enrolment *before* applying this
    // lesson event, so do the same here (no count bump: gated on emit).
    await upsertEnrollment(
      tx,
      { ...ev, kind: "course_enrolled", payload: null },
      opts,
    );
    return;
  }
  const derived = await appendDerived(tx, {
    userId: ev.userId,
    kind: "course_enrolled",
    courseId,
    lessonId: null,
    payload: null,
    // Keyed by the triggering event so it can never collide with an explicit enrol.
    idempotencyKey: `course_enrolled:${ev.userId}:${courseId}:derived:${ev.id}`,
    occurredAt: ev.occurredAt,
  });
  if (derived) await upsertEnrollment(tx, derived, opts);
}

async function upsertLessonProgress(
  tx: Tx,
  ev: EventRow,
  courseId: string,
  lessonId: string,
) {
  const payload =
    ev.kind === "lesson_progressed"
      ? lessonProgressedPayload.parse(ev.payload ?? {})
      : {};
  const completed = ev.kind === "lesson_completed";
  const percent = completed ? 100 : (payload.percent ?? 0);
  await tx
    .insert(lessonProgress)
    .values({
      userId: ev.userId,
      lessonId,
      courseId,
      status: completed ? "completed" : "in_progress",
      progressPercent: percent,
      lastPositionSeconds: payload.positionSeconds ?? null,
      startedAt: ev.occurredAt,
      completedAt: completed ? ev.occurredAt : null,
      updatedAt: ev.recordedAt,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        status: completed
          ? "completed"
          : sql`case when ${lessonProgress.status} = 'completed' then 'completed'::progress_status else 'in_progress'::progress_status end`,
        // Monotonic: never regress, and a completed lesson stays at 100.
        progressPercent: sql`greatest(${lessonProgress.progressPercent}, ${percent})`,
        lastPositionSeconds:
          payload.positionSeconds !== undefined
            ? payload.positionSeconds
            : sql`${lessonProgress.lastPositionSeconds}`,
        startedAt: sql`coalesce(${lessonProgress.startedAt}, ${ev.occurredAt.toISOString()}::timestamptz)`,
        completedAt: completed
          ? sql`coalesce(${lessonProgress.completedAt}, ${ev.occurredAt.toISOString()}::timestamptz)`
          : sql`${lessonProgress.completedAt}`,
        updatedAt: ev.recordedAt,
      },
    });
}

async function recomputeCourse(
  tx: Tx,
  ev: EventRow,
  courseId: string,
  opts: ApplyOptions,
): Promise<ApplyResult> {
  // Serialise concurrent completions in the same course for this learner.
  const [enrollment] = await tx
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, ev.userId),
        eq(enrollments.courseId, courseId),
      ),
    )
    .for("update");
  if (!enrollment) return { courseCompleted: false };

  const [counts] = await tx
    .select({
      requiredTotal: sql<number>`count(*)::int`,
      requiredDone: sql<number>`count(${lessonProgress.lessonId}) filter (where ${lessonProgress.status} = 'completed')::int`,
    })
    .from(lessons)
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.lessonId, lessons.id),
        eq(lessonProgress.userId, ev.userId),
      ),
    )
    .where(
      and(
        eq(lessons.courseId, courseId),
        eq(lessons.isRequired, true),
        isNull(lessons.archivedAt),
      ),
    );
  const requiredTotal = counts?.requiredTotal ?? 0;
  const requiredDone = counts?.requiredDone ?? 0;
  const percent =
    requiredTotal === 0 ? 0 : Math.round((requiredDone / requiredTotal) * 100);

  if (enrollment.status !== "completed") {
    await tx
      .update(enrollments)
      .set({ progressPercent: percent, updatedAt: ev.recordedAt })
      .where(
        and(
          eq(enrollments.userId, ev.userId),
          eq(enrollments.courseId, courseId),
        ),
      );
  }
  if (enrollment.status !== "active") return { courseCompleted: false };

  const [course] = await tx
    .select({ criteria: courses.completionCriteria })
    .from(courses)
    .where(eq(courses.id, courseId));
  const verdict = evaluateCompletion(course?.criteria, {
    requiredTotal,
    requiredDone,
  });
  if (!verdict.complete) return { courseCompleted: false };
  if (!opts.emit) return { courseCompleted: false }; // replay: the course_completed event follows in the stream

  const derived = await appendDerived(tx, {
    userId: ev.userId,
    kind: "course_completed",
    courseId,
    lessonId: null,
    payload: { triggeredBy: ev.id },
    // Per trigger, not per course: a course can be completed again after drop + re-enrol.
    // Concurrency is handled by the FOR UPDATE lock plus the status check above.
    idempotencyKey: `course_completed:${ev.userId}:${courseId}:derived:${ev.id}`,
    occurredAt: ev.occurredAt,
  });
  if (!derived) return { courseCompleted: false };
  return applyEvent(tx, derived, opts);
}

/** Append a derived event; returns null when its idempotency key already exists. */
async function appendDerived(
  tx: Tx,
  values: Omit<typeof progressEvents.$inferInsert, "id" | "recordedAt">,
): Promise<EventRow | null> {
  const [row] = await tx
    .insert(progressEvents)
    .values(values)
    .onConflictDoNothing({ target: progressEvents.idempotencyKey })
    .returning();
  return row ?? null;
}
