import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { teams, users } from "./auth";
import { courses, lessons } from "./courses";
import type { ProgressEventPayload } from "./json";

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "completed",
  "dropped",
]);
export const progressStatus = pgEnum("progress_status", [
  "not_started",
  "in_progress",
  "completed",
]);
export const progressEventKind = pgEnum("progress_event_kind", [
  "course_enrolled",
  "course_completed",
  "course_dropped",
  "lesson_started",
  "lesson_progressed",
  "lesson_completed",
  "quiz_attempted",
  "exercise_submitted",
  "project_submitted",
]);

/** Read model: one row per (learner, course). Derived from `progress_events`. */
export const enrollments = pgTable(
  "enrollments",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: enrollmentStatus().notNull().default("active"),
    progressPercent: smallint().notNull().default(0),
    lastLessonId: uuid().references(() => lessons.id, { onDelete: "set null" }),
    /** Cohort this enrolment belongs to, if any. */
    teamId: uuid().references(() => teams.id, { onDelete: "set null" }),
    enrolledAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
    droppedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.courseId] }),
    index("enrollments_course_id_idx").on(t.courseId),
    index("enrollments_team_id_idx").on(t.teamId),
    index("enrollments_last_lesson_id_idx").on(t.lastLessonId),
  ],
);

/** Read model: one row per (learner, lesson). Derived from `progress_events`. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: progressStatus().notNull().default("not_started"),
    progressPercent: smallint().notNull().default(0),
    lastPositionSeconds: integer(),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    index("lesson_progress_user_course_idx").on(t.userId, t.courseId),
    index("lesson_progress_lesson_id_idx").on(t.lessonId),
  ],
);

/**
 * Append-only source of truth for everything a learner does.
 * Read models above are rebuilt from this stream (see @repo/learning).
 */
export const progressEvents = pgTable(
  "progress_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Monotonic insert order; the only reliable replay order (occurredAt/recordedAt can tie). */
    seq: bigint({ mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: progressEventKind().notNull(),
    courseId: uuid().references(() => courses.id, { onDelete: "set null" }),
    lessonId: uuid().references(() => lessons.id, { onDelete: "set null" }),
    payload: jsonb().$type<ProgressEventPayload>(),
    idempotencyKey: text().notNull(),
    /** When it happened on the client; drives replay order. */
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** When the server accepted it. */
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("progress_events_idempotency_key_uidx").on(t.idempotencyKey),
    uniqueIndex("progress_events_seq_uidx").on(t.seq),
    index("progress_events_user_seq_idx").on(t.userId, t.seq),
    index("progress_events_user_occurred_idx").on(t.userId, t.occurredAt),
    index("progress_events_course_id_idx").on(t.courseId),
    index("progress_events_lesson_id_idx").on(t.lessonId),
  ],
);

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  lastLesson: one(lessons, {
    fields: [enrollments.lastLessonId],
    references: [lessons.id],
  }),
  team: one(teams, { fields: [enrollments.teamId], references: [teams.id] }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(lessons, {
    fields: [lessonProgress.lessonId],
    references: [lessons.id],
  }),
  course: one(courses, {
    fields: [lessonProgress.courseId],
    references: [courses.id],
  }),
}));

export const progressEventsRelations = relations(progressEvents, ({ one }) => ({
  user: one(users, { fields: [progressEvents.userId], references: [users.id] }),
  course: one(courses, {
    fields: [progressEvents.courseId],
    references: [courses.id],
  }),
  lesson: one(lessons, {
    fields: [progressEvents.lessonId],
    references: [lessons.id],
  }),
}));

export type Enrollment = typeof enrollments.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type ProgressEvent = typeof progressEvents.$inferSelect;
export type NewProgressEvent = typeof progressEvents.$inferInsert;
export type ProgressEventKind = (typeof progressEventKind.enumValues)[number];
