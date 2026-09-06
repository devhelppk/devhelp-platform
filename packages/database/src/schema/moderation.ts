import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courseTrack } from "./courses";
import type { AuditChange, ModerationPayload } from "./json";

/**
 * One moderation system for every area (X2). An item is a snapshot of what
 * someone submitted plus its status; every change to an item writes an
 * append-only action row in the same transaction. Subject types grow as
 * specs add contributions (S6 reviews, S10 company bank, S12 comments).
 */
export const moderationSubject = pgEnum("moderation_subject", [
  "mentor_application",
  "company_review_request",
  "comment",
  "course_review",
]);
export const moderationStatus = pgEnum("moderation_status", [
  "pending",
  "approved",
  "rejected",
  "hidden",
  "merged",
]);
export const moderationAction = pgEnum("moderation_action", [
  "submit",
  "approve",
  "reject",
  "edit",
  "merge",
  "hide",
  "unhide",
  "flag",
  "dismiss_flag",
  "request_review",
]);
export const flagReason = pgEnum("flag_reason", [
  "names_individual",
  "unverifiable",
  "personal_data",
  "spam",
  "off_topic",
  "other",
]);
export const flagStatus = pgEnum("flag_status", [
  "open",
  "upheld",
  "dismissed",
]);

export const moderationItems = pgTable(
  "moderation_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    subjectType: moderationSubject().notNull(),
    /** Id of the subject row in its own table; the item outlives it. */
    subjectId: uuid().notNull(),
    status: moderationStatus().notNull().default("pending"),
    /** Null = admin-only (mentor applications, company review requests). */
    track: courseTrack(),
    submittedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    assignedTo: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    reason: text(),
    /** Clause anchor on the content policy page, e.g. "c2". */
    policyClause: text(),
    /** Snapshot of the submission at the time it entered the queue. */
    payload: jsonb().$type<ModerationPayload>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("moderation_items_subject_uidx").on(t.subjectType, t.subjectId),
    // Queue pages filter by status and order by created_at; track is a secondary filter.
    index("moderation_items_queue_idx").on(t.status, t.createdAt),
    index("moderation_items_submitted_by_idx").on(t.submittedBy),
  ],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid().primaryKey().defaultRandom(),
    itemId: uuid()
      .notNull()
      .references(() => moderationItems.id, { onDelete: "cascade" }),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: moderationAction().notNull(),
    reason: text(),
    policyClause: text(),
    before: jsonb().$type<AuditChange>(),
    after: jsonb().$type<AuditChange>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("moderation_actions_item_idx").on(t.itemId, t.createdAt)],
);

export const contentFlags = pgTable(
  "content_flags",
  {
    id: uuid().primaryKey().defaultRandom(),
    subjectType: moderationSubject().notNull(),
    subjectId: uuid().notNull(),
    reporterId: uuid().references(() => users.id, { onDelete: "set null" }),
    reason: flagReason().notNull(),
    details: text(),
    status: flagStatus().notNull().default("open"),
    itemId: uuid().references(() => moderationItems.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("content_flags_subject_idx").on(t.subjectType, t.subjectId, t.status),
    uniqueIndex("content_flags_reporter_uidx").on(
      t.subjectType,
      t.subjectId,
      t.reporterId,
    ),
  ],
);

/** Which tracks a mentor may moderate. Admins moderate everything. */
export const mentorTracks = pgTable(
  "mentor_tracks",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    track: courseTrack().notNull(),
    grantedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.track] })],
);

/** Fixed-window counters for per-user limits (F2.11, F4.5); Postgres so no extra service. */
export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
  windowStartedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const moderationItemsRelations = relations(
  moderationItems,
  ({ one, many }) => ({
    submitter: one(users, {
      fields: [moderationItems.submittedBy],
      references: [users.id],
      relationName: "submitted",
    }),
    decider: one(users, {
      fields: [moderationItems.decidedBy],
      references: [users.id],
      relationName: "decided",
    }),
    actions: many(moderationActions),
    flags: many(contentFlags),
  }),
);
export const moderationActionsRelations = relations(
  moderationActions,
  ({ one }) => ({
    item: one(moderationItems, {
      fields: [moderationActions.itemId],
      references: [moderationItems.id],
    }),
    actor: one(users, {
      fields: [moderationActions.actorId],
      references: [users.id],
    }),
  }),
);
export const contentFlagsRelations = relations(contentFlags, ({ one }) => ({
  item: one(moderationItems, {
    fields: [contentFlags.itemId],
    references: [moderationItems.id],
  }),
  reporter: one(users, {
    fields: [contentFlags.reporterId],
    references: [users.id],
  }),
}));
export const mentorTracksRelations = relations(mentorTracks, ({ one }) => ({
  user: one(users, { fields: [mentorTracks.userId], references: [users.id] }),
}));
