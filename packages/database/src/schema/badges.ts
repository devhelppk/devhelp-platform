import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { contentRevisions } from "./content";
import type { BadgeRule } from "./json";
import { progressEvents } from "./progress";

/**
 * Badges are content (S8): `badges/<slug>.yaml` in the content repo, synced
 * like a course. The rule is evaluated against `progress_events`, so an award
 * is computed rather than judged.
 */
export const badges = pgTable(
  "badges",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    /** lucide icon name, validated by `content:check`. */
    icon: text().notNull(),
    rule: jsonb().$type<BadgeRule>().notNull(),
    contentPath: text(),
    contentHash: text(),
    contentRevisionId: uuid().references(() => contentRevisions.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("badges_slug_uidx").on(t.slug)],
);

/** An award. Never deleted by a replay; revocation is a state, like a certificate. */
export const userBadges = pgTable(
  "user_badges",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: uuid()
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    awardedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Null when the rule awarded it; set when an admin did. */
    awardedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    awardReason: text(),
    /** The event that satisfied the rule, for "why did I get this". */
    triggerEventId: uuid().references(() => progressEvents.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp({ withTimezone: true }),
    revokedReason: text(),
    revokedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.badgeId] }),
    index("user_badges_user_idx").on(t.userId, t.awardedAt),
  ],
);

/**
 * One row per learner per active day (Asia/Karachi), maintained by the
 * reducer and rebuilt by `rebuildLearner`. Streaks and the activity grid read
 * it; no counters to drift.
 */
export const userActivity = pgTable(
  "user_activity",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date().notNull(),
    events: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    index("user_activity_user_day_idx").on(t.userId, t.day.desc()),
  ],
);

export const badgesRelations = relations(badges, ({ many }) => ({
  awards: many(userBadges),
}));
export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  badge: one(badges, { fields: [userBadges.badgeId], references: [badges.id] }),
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
    relationName: "holder",
  }),
  awarder: one(users, {
    fields: [userBadges.awardedBy],
    references: [users.id],
    relationName: "awarder",
  }),
}));
