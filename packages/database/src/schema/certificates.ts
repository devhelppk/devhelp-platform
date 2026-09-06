import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { contentRevisions } from "./content";
import { courses } from "./courses";
import type { CertificateCriteria } from "./json";

/**
 * Issued inside the course-completion transaction (S7). `id` is the public
 * verify uuid. One completion certificate per course per learner (founder
 * decision); the snapshot records exactly what was done and on which
 * content revision. Rows are never deleted; revocation is a state.
 */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Enrolment count when it was issued (drop + re-enrol raises it). */
    enrolmentGeneration: integer().notNull().default(1),
    learnerName: text().notNull(),
    courseTitle: text().notNull(),
    contentRevisionId: uuid().references(() => contentRevisions.id, {
      onDelete: "set null",
    }),
    criteria: jsonb().$type<CertificateCriteria>().notNull(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
    revokedReason: text(),
    revokedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Storage key of the cached PDF; null until first download or after invalidation. */
    pdfKey: text(),
  },
  (t) => [
    uniqueIndex("certificates_user_course_uidx").on(t.userId, t.courseId),
    index("certificates_course_idx").on(t.courseId, t.issuedAt),
    index("certificates_issued_idx").on(t.issuedAt),
  ],
);

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, {
    fields: [certificates.userId],
    references: [users.id],
    relationName: "holder",
  }),
  course: one(courses, {
    fields: [certificates.courseId],
    references: [courses.id],
  }),
  contentRevision: one(contentRevisions, {
    fields: [certificates.contentRevisionId],
    references: [contentRevisions.id],
  }),
  revoker: one(users, {
    fields: [certificates.revokedBy],
    references: [users.id],
    relationName: "revoker",
  }),
}));
