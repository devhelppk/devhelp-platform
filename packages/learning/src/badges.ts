import { and, count, eq, gte, isNull, schema, sql } from "@repo/database";
import { badgeRuleSchema, type BadgeRule } from "@repo/database/schema";
import { streakFor } from "./activity";
import type { Tx } from "./types";

type EventRow = typeof schema.progressEvents.$inferSelect;

/** Which event kinds can possibly satisfy which rule kinds; nothing else is evaluated. */
const TRIGGERS: Record<BadgeRule["kind"], EventRow["kind"][]> = {
  lessons_in_window: ["lesson_completed"],
  streak_days: [
    "lesson_completed",
    "lesson_started",
    "lesson_progressed",
    "quiz_attempted",
    "exercise_submitted",
    "project_submitted",
  ],
  course_completed: ["course_completed"],
  path_completed: ["course_completed"],
  first_project_accepted: ["project_submitted"],
};

/** True when the learner's history satisfies the rule as of this event. */
async function satisfied(
  tx: Tx,
  userId: string,
  rule: BadgeRule,
  ev: EventRow,
): Promise<boolean> {
  switch (rule.kind) {
    case "lessons_in_window": {
      const since = new Date(ev.occurredAt);
      since.setUTCDate(since.getUTCDate() - rule.days);
      const [row] = await tx
        .select({ n: count(sql`distinct ${schema.progressEvents.lessonId}`) })
        .from(schema.progressEvents)
        .where(
          and(
            eq(schema.progressEvents.userId, userId),
            eq(schema.progressEvents.kind, "lesson_completed"),
            gte(schema.progressEvents.occurredAt, since),
          ),
        );
      return (row?.n ?? 0) >= rule.count;
    }
    case "streak_days": {
      const s = await streakFor(tx, userId, ev.occurredAt);
      return s.current >= rule.days || s.longest >= rule.days;
    }
    case "course_completed": {
      const course = await tx.query.courses.findFirst({
        where: eq(schema.courses.slug, rule.course),
        columns: { id: true },
      });
      return !!course && course.id === ev.courseId;
    }
    case "path_completed": {
      const path = await tx.query.paths.findFirst({
        where: eq(schema.paths.slug, rule.path),
        columns: { id: true },
        with: { pathCourses: { columns: { courseId: true } } },
      });
      if (!path || path.pathCourses.length === 0) return false;
      const done = await tx
        .select({ courseId: schema.enrollments.courseId })
        .from(schema.enrollments)
        .where(
          and(
            eq(schema.enrollments.userId, userId),
            eq(schema.enrollments.status, "completed"),
          ),
        );
      const doneIds = new Set(done.map((d) => d.courseId));
      return path.pathCourses.every((pc) => doneIds.has(pc.courseId));
    }
    case "first_project_accepted": {
      // Project lessons are post-MVP; when they run their automated checks the
      // event carries `passed`, and this rule starts awarding with no change here.
      const payload = ev.payload as { passed?: boolean } | null;
      return ev.kind === "project_submitted" && payload?.passed === true;
    }
  }
}

/** Records an award, ignoring a repeat. `silent` skips the notification (the backfill). */
export async function awardBadge(
  tx: Tx,
  input: {
    userId: string;
    badgeId: string;
    triggerEventId?: string;
    awardedBy?: string;
    awardReason?: string;
  },
): Promise<boolean> {
  const [row] = await tx
    .insert(schema.userBadges)
    .values({
      userId: input.userId,
      badgeId: input.badgeId,
      triggerEventId: input.triggerEventId ?? null,
      awardedBy: input.awardedBy ?? null,
      awardReason: input.awardReason ?? null,
    })
    .onConflictDoNothing()
    .returning({ badgeId: schema.userBadges.badgeId });
  return !!row;
}

/**
 * Evaluates every live badge this event could satisfy and awards what is new.
 * Runs inside the transaction that recorded the event, so an award is
 * immediate; `onConflictDoNothing` makes a replay a no-op.
 */
export async function evaluateBadges(tx: Tx, ev: EventRow): Promise<string[]> {
  const live = await tx.query.badges.findMany({
    where: isNull(schema.badges.archivedAt),
    columns: { id: true, rule: true },
  });
  if (live.length === 0) return [];
  // Revoked awards count as held: a revocation is final for the rules, and an
  // admin re-awards through `badges.award` if it was a mistake. Rules here are
  // monotonic (five lessons stay five), so re-evaluating a revoked badge would
  // simply undo the moderator on the learner's next click.
  const held = await tx.query.userBadges.findMany({
    where: eq(schema.userBadges.userId, ev.userId),
    columns: { badgeId: true },
  });
  const have = new Set(held.map((h) => h.badgeId));
  const awarded: string[] = [];
  for (const b of live) {
    if (have.has(b.id)) continue;
    const rule = badgeRuleSchema.safeParse(b.rule).data;
    if (!rule || !TRIGGERS[rule.kind].includes(ev.kind)) continue;
    if (!(await satisfied(tx, ev.userId, rule, ev))) continue;
    if (
      await awardBadge(tx, {
        userId: ev.userId,
        badgeId: b.id,
        triggerEventId: ev.id,
      })
    )
      awarded.push(b.id);
  }
  return awarded;
}
