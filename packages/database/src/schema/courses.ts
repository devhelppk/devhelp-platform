import { relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tsvector } from "./companies";
import { contentRevisions } from "./content";
import type { CompletionCriteria } from "./json";

export const courseTrack = pgEnum("course_track", ["technical", "career"]);
export const courseLevel = pgEnum("course_level", [
  "beginner",
  "intermediate",
  "advanced",
]);
export const lessonType = pgEnum("lesson_type", [
  "article",
  "video",
  "exercise",
  "quiz",
  "project",
  "link",
]);
export const completionRule = pgEnum("completion_rule", [
  "view",
  "quiz_pass",
  "exercise_pass",
  "submit",
]);
/** Foundation = no AI assistance expected; industry = AI allowed, learner owns correctness. */
export const lessonMode = pgEnum("lesson_mode", ["foundation", "industry"]);
export const videoProvider = pgEnum("video_provider", ["youtube"]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const courses = pgTable(
  "courses",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    summary: text().notNull(),
    description: text(),
    track: courseTrack().notNull().default("technical"),
    level: courseLevel().notNull().default("beginner"),
    coverImageUrl: text(),
    estimatedHours: integer(),
    isPublished: boolean().notNull().default(false),
    publishedAt: timestamp({ withTimezone: true }),
    /**
     * True from the moment the sync creates the row until a person fills in
     * the metadata the content repo no longer carries (S11). Such a course
     * cannot be published, so it never reaches the catalogue half-formed.
     */
    needsMetadata: boolean().notNull().default(false),
    archivedAt: timestamp({ withTimezone: true }),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    contentPath: text(),
    contentHash: text(),
    contentRevisionId: uuid().references(() => contentRevisions.id, {
      onDelete: "set null",
    }),
    completionCriteria: jsonb()
      .$type<CompletionCriteria>()
      .notNull()
      .default({ requireAllRequiredLessons: true }),
    // Aggregates: reviews (S6, recomputed on write) and the enrolment reducer.
    /**
     * Free-text search (S14). Title first: somebody typing a course name
     * should find that course above a lesson that merely mentions it, which
     * is what the `A`/`B` weights buy.
     */
    searchVector: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(description, '')), 'B')`,
    ),
    ratingAvg: numeric({ precision: 3, scale: 2 }),
    ratingCount: integer().notNull().default(0),
    reviewCount: integer().notNull().default(0),
    enrollmentCount: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("courses_is_published_idx").on(t.isPublished),
    index("courses_search_idx").using("gin", t.searchVector),
  ],
);

export const coursePrerequisites = pgTable(
  "course_prerequisites",
  {
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    prerequisiteId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.prerequisiteId] }),
    index("course_prerequisites_prerequisite_id_idx").on(t.prerequisiteId),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: uuid().primaryKey().defaultRandom(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    title: text().notNull(),
    summary: text(),
    position: integer().notNull().default(0),
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("modules_course_slug_uidx").on(t.courseId, t.slug),
    // Lets lessons carry a composite FK so lessons.course_id can never disagree with the module's course.
    uniqueIndex("modules_id_course_id_uidx").on(t.id, t.courseId),
    index("modules_course_id_idx").on(t.courseId),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid().primaryKey().defaultRandom(),
    moduleId: uuid()
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    // Denormalised from modules so progress maths never needs a join through modules.
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    slug: text().notNull(),
    title: text().notNull(),
    type: lessonType().notNull().default("article"),
    completionRule: completionRule().notNull().default("view"),
    mode: lessonMode().notNull().default("foundation"),
    isRequired: boolean().notNull().default(true),
    isFree: boolean().notNull().default(true),
    durationMinutes: integer(),
    position: integer().notNull().default(0),
    videoProvider: videoProvider(),
    videoId: text(),
    /** As on courses: created by the sync, cleared by a person. */
    needsMetadata: boolean().notNull().default(false),
    /**
     * A lesson's body is compiled from the content repo and never stored here,
     * so this covers the title alone. Searching lesson prose would mean
     * putting bodies in Postgres, which is a different decision.
     */
    searchVector: tsvector().generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(title, ''))`,
    ),
    contentPath: text(),
    contentHash: text(),
    contentRevisionId: uuid().references(() => contentRevisions.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp({ withTimezone: true }),
    // Aggregates from lesson_feedback and comments (S6, recomputed on write).
    ratingAvg: numeric({ precision: 3, scale: 2 }),
    ratingCount: integer().notNull().default(0),
    unclearCount: integer().notNull().default(0),
    openQuestionCount: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("lessons_search_idx").using("gin", t.searchVector),
    uniqueIndex("lessons_course_slug_uidx").on(t.courseId, t.slug),
    index("lessons_module_id_idx").on(t.moduleId),
    index("lessons_course_id_idx").on(t.courseId),
    foreignKey({
      name: "lessons_module_course_fk",
      columns: [t.moduleId, t.courseId],
      foreignColumns: [modules.id, modules.courseId],
    }).onDelete("cascade"),
  ],
);

export const paths = pgTable("paths", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  summary: text().notNull(),
  description: text(),
  isPublished: boolean().notNull().default(false),
  /** As on courses (S11): seeded by the sync, cleared by a person. */
  needsMetadata: boolean().notNull().default(false),
  position: integer().notNull().default(0),
  contentRevisionId: uuid().references(() => contentRevisions.id, {
    onDelete: "set null",
  }),
  archivedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const pathCourses = pgTable(
  "path_courses",
  {
    pathId: uuid()
      .notNull()
      .references(() => paths.id, { onDelete: "cascade" }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.pathId, t.courseId] }),
    index("path_courses_course_id_idx").on(t.courseId),
  ],
);

export const coursesRelations = relations(courses, ({ one, many }) => ({
  author: one(users, { fields: [courses.authorId], references: [users.id] }),
  contentRevision: one(contentRevisions, {
    fields: [courses.contentRevisionId],
    references: [contentRevisions.id],
  }),
  modules: many(modules),
  lessons: many(lessons),
  prerequisites: many(coursePrerequisites, {
    relationName: "course_prerequisites",
  }),
  pathCourses: many(pathCourses),
}));

export const coursePrerequisitesRelations = relations(
  coursePrerequisites,
  ({ one }) => ({
    course: one(courses, {
      fields: [coursePrerequisites.courseId],
      references: [courses.id],
      relationName: "course_prerequisites",
    }),
    prerequisite: one(courses, {
      fields: [coursePrerequisites.prerequisiteId],
      references: [courses.id],
      relationName: "prerequisite_of",
    }),
  }),
);

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
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  contentRevision: one(contentRevisions, {
    fields: [lessons.contentRevisionId],
    references: [contentRevisions.id],
  }),
}));

export const pathsRelations = relations(paths, ({ one, many }) => ({
  contentRevision: one(contentRevisions, {
    fields: [paths.contentRevisionId],
    references: [contentRevisions.id],
  }),
  pathCourses: many(pathCourses),
}));

export const pathCoursesRelations = relations(pathCourses, ({ one }) => ({
  path: one(paths, { fields: [pathCourses.pathId], references: [paths.id] }),
  course: one(courses, {
    fields: [pathCourses.courseId],
    references: [courses.id],
  }),
}));

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Module = typeof modules.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type Path = typeof paths.$inferSelect;
