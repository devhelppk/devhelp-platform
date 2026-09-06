import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/** In-app notifications (X4). `@repo/notify` is the only writer; kinds declare whether they also email. */
export const notificationKind = pgEnum("notification_kind", [
  "mentor_application_decided",
  "moderation_decided",
  "org_invitation",
  "role_changed",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKind().notNull(),
    subjectType: text(),
    subjectId: text(),
    title: text().notNull(),
    body: text(),
    /** Internal path to open, e.g. "/moderate/…". */
    href: text(),
    /** Optional dedupe key: one notification per (user, key). */
    dedupeKey: text(),
    readAt: timestamp({ withTimezone: true }),
    emailedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.readAt),
    uniqueIndex("notifications_dedupe_uidx").on(t.userId, t.dedupeKey),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
