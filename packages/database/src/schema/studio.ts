import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons } from "./courses";
import type { MetadataChanges } from "./json";

/**
 * Studio (S11). The content repo owns what a lesson *is*; Postgres owns how it
 * is described. These tables are the second half of that: who is credited, and
 * who changed what.
 */
export const contentSubject = pgEnum("content_subject", [
  "course",
  "module",
  "lesson",
]);
export const creditRole = pgEnum("credit_role", ["author", "reviewer"]);

/**
 * Who wrote and who reviewed. Credits point at users (founder decision, S11):
 * a byline always resolves to a real profile, and nobody is credited by a
 * string somebody typed. `position` keeps the order an editor chose.
 */
export const contentCredits = pgTable(
  "content_credits",
  {
    id: uuid().primaryKey().defaultRandom(),
    subjectType: contentSubject().notNull(),
    subjectId: uuid().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: creditRole().notNull(),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("content_credits_uidx").on(
      t.subjectType,
      t.subjectId,
      t.userId,
      t.role,
    ),
    index("content_credits_subject_idx").on(t.subjectType, t.subjectId),
    index("content_credits_user_idx").on(t.userId),
  ],
);

/**
 * Append-only record of metadata edits. A mentor changing the title of a
 * published lesson deserves the same trail as a moderation decision, and for
 * the same reason: it is a change to what learners see, made by a person.
 */
export const contentEdits = pgTable(
  "content_edits",
  {
    id: uuid().primaryKey().defaultRandom(),
    subjectType: contentSubject().notNull(),
    subjectId: uuid().notNull(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    changes: jsonb().$type<MetadataChanges>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("content_edits_subject_idx").on(
      t.subjectType,
      t.subjectId,
      t.createdAt,
    ),
  ],
);

export const contentCreditsRelations = relations(contentCredits, ({ one }) => ({
  user: one(users, {
    fields: [contentCredits.userId],
    references: [users.id],
  }),
}));
export const contentEditsRelations = relations(contentEdits, ({ one }) => ({
  actor: one(users, {
    fields: [contentEdits.actorId],
    references: [users.id],
  }),
}));

/** Re-exported so the studio router can name what it edits. */
export const studioSubjects = { courses, lessons } as const;
