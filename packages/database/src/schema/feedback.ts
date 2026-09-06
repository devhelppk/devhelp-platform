import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons } from "./courses";

/** Area 4: lesson feedback (private), course reviews (public), discussions. */
export const feedbackTag = pgEnum("feedback_tag", [
  "unclear",
  "too_long",
  "outdated",
  "error",
  "loved_it",
]);
export const commentSubject = pgEnum("comment_subject", ["lesson", "course"]);
export const commentKind = pgEnum("comment_kind", [
  "question",
  "note",
  "answer",
]);
export const commentStatus = pgEnum("comment_status", [
  "visible",
  "held",
  "hidden",
  "deleted",
]);
export const courseReviewStatus = pgEnum("course_review_status", [
  "visible",
  "hidden",
]);

/** One private rating per learner per lesson; feeds aggregates and the mentor dashboard, never other learners. */
export const lessonFeedback = pgTable(
  "lesson_feedback",
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
    rating: smallint().notNull(),
    tags: feedbackTag().array().notNull().default([]),
    text: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    index("lesson_feedback_lesson_idx").on(t.lessonId),
  ],
);

/** One public review per learner per course, gated on progress at write time. */
export const courseReviews = pgTable(
  "course_reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    rating: smallint().notNull(),
    title: text(),
    body: text().notNull(),
    progressAtReview: smallint().notNull(),
    completedAtReview: integer().notNull().default(0),
    status: courseReviewStatus().notNull().default("visible"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("course_reviews_user_course_uidx").on(t.userId, t.courseId),
    index("course_reviews_course_idx").on(t.courseId, t.status, t.createdAt),
  ],
);

/** Discussions: one level deep (a reply's parent is a top-level comment). Markdown in `body`, sanitised HTML in `bodyHtml`. */
export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    subjectType: commentSubject().notNull(),
    subjectId: uuid().notNull(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    parentId: uuid(),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    kind: commentKind().notNull(),
    body: text().notNull(),
    bodyHtml: text().notNull(),
    /** Heading id inside the lesson body the comment is about, if any. */
    anchor: text(),
    status: commentStatus().notNull().default("visible"),
    voteCount: integer().notNull().default(0),
    replyCount: integer().notNull().default(0),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    editedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("comments_subject_idx").on(
      t.subjectType,
      t.subjectId,
      t.status,
      t.createdAt,
    ),
    index("comments_parent_idx").on(t.parentId),
    index("comments_author_idx").on(t.authorId),
  ],
);

export const commentVotes = pgTable(
  "comment_votes",
  {
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

/** Mentors who want a notification for every new question on a lesson. */
export const lessonWatchers = pgTable(
  "lesson_watchers",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    index("lesson_watchers_lesson_idx").on(t.lessonId),
  ],
);

export const lessonFeedbackRelations = relations(lessonFeedback, ({ one }) => ({
  user: one(users, { fields: [lessonFeedback.userId], references: [users.id] }),
  lesson: one(lessons, {
    fields: [lessonFeedback.lessonId],
    references: [lessons.id],
  }),
}));
export const courseReviewsRelations = relations(courseReviews, ({ one }) => ({
  user: one(users, { fields: [courseReviews.userId], references: [users.id] }),
  course: one(courses, {
    fields: [courseReviews.courseId],
    references: [courses.id],
  }),
}));
export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
    relationName: "author",
  }),
  acceptedByUser: one(users, {
    fields: [comments.acceptedBy],
    references: [users.id],
    relationName: "acceptor",
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "replies",
  }),
  replies: many(comments, { relationName: "replies" }),
  votes: many(commentVotes),
}));
export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  comment: one(comments, {
    fields: [commentVotes.commentId],
    references: [comments.id],
  }),
}));
