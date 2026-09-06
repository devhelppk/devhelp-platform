import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** One row per published content commit; content rows point at the revision they came from. */
export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    repo: text().notNull(),
    commitSha: text().notNull(),
    publishedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    summary: text(),
    itemCount: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex("content_revisions_repo_sha_uidx").on(t.repo, t.commitSha),
  ],
);

export type ContentRevision = typeof contentRevisions.$inferSelect;
