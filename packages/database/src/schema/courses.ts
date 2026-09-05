import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const courseLevel = pgEnum("course_level", [
  "beginner",
  "intermediate",
  "advanced",
]);

// "technical" = engineering skills, "career" = communication, interviews, freelancing, etc.
export const courseTrack = pgEnum("course_track", ["technical", "career"]);

export const courses = pgTable("courses", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  summary: text().notNull(),
  description: text(),
  track: courseTrack().notNull().default("technical"),
  level: courseLevel().notNull().default("beginner"),
  coverImageUrl: text(),
  isPublished: boolean().notNull().default(false),
  authorId: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const modules = pgTable("modules", {
  id: uuid().primaryKey().defaultRandom(),
  courseId: uuid()
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text().notNull(),
  position: integer().notNull().default(0),
});

export const lessonType = pgEnum("lesson_type", [
  "article",
  "video",
  "exercise",
  "quiz",
]);

export const lessons = pgTable("lessons", {
  id: uuid().primaryKey().defaultRandom(),
  moduleId: uuid()
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  slug: text().notNull(),
  title: text().notNull(),
  type: lessonType().notNull().default("article"),
  // Markdown/MDX body for articles; URL for videos; JSON for quizzes/exercises.
  content: text(),
  durationMinutes: integer(),
  position: integer().notNull().default(0),
  isFree: boolean().notNull().default(true),
});

export const coursesRelations = relations(courses, ({ one, many }) => ({
  author: one(users, { fields: [courses.authorId], references: [users.id] }),
  modules: many(modules),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, {
    fields: [modules.courseId],
    references: [courses.id],
  }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  module: one(modules, {
    fields: [lessons.moduleId],
    references: [modules.id],
  }),
}));

export type Course = typeof courses.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
