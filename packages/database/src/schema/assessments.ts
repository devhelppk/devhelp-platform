import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lessons } from "./courses";
import type { FileMap, QuestionAnswer, QuestionOption } from "./json";

export const questionType = pgEnum("question_type", [
  "single",
  "multi",
  "short",
]);
export const exerciseRunner = pgEnum("exercise_runner", [
  "sandpack",
  "pyodide",
]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const quizzes = pgTable("quizzes", {
  id: uuid().primaryKey().defaultRandom(),
  lessonId: uuid()
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "cascade" }),
  /** Percent needed to pass. */
  passScore: smallint().notNull().default(70),
  maxAttempts: smallint(),
  shuffle: boolean().notNull().default(false),
  version: integer().notNull().default(1),
  contentHash: text(),
  ...timestamps,
});

export const questions = pgTable(
  "questions",
  {
    id: uuid().primaryKey().defaultRandom(),
    quizId: uuid()
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
    type: questionType().notNull().default("single"),
    prompt: text().notNull(),
    options: jsonb().$type<QuestionOption[]>().notNull().default([]),
    /** Accepted answers for `short` questions. Server-only. */
    answer: jsonb().$type<QuestionAnswer>(),
    explanation: text(),
    points: smallint().notNull().default(1),
    version: integer().notNull().default(1),
  },
  (t) => [index("questions_quiz_id_idx").on(t.quizId)],
);

/**
 * The columns of `questions` that are safe to send to a browser.
 * Strips `isCorrect`/`feedback` from options and drops `answer`.
 */
export const questionPublicColumns = {
  id: questions.id,
  quizId: questions.quizId,
  position: questions.position,
  type: questions.type,
  prompt: questions.prompt,
  points: questions.points,
  version: questions.version,
} as const;

export function toPublicOptions(
  options: QuestionOption[],
): { id: string; text: string }[] {
  return options.map(({ id, text }) => ({ id, text }));
}

export const exercises = pgTable("exercises", {
  id: uuid().primaryKey().defaultRandom(),
  lessonId: uuid()
    .notNull()
    .unique()
    .references(() => lessons.id, { onDelete: "cascade" }),
  runner: exerciseRunner().notNull().default("sandpack"),
  language: text().notNull().default("typescript"),
  starterFiles: jsonb().$type<FileMap>().notNull().default({}),
  testFiles: jsonb().$type<FileMap>().notNull().default({}),
  instructions: text(),
  version: integer().notNull().default(1),
  contentHash: text(),
  ...timestamps,
});

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  lesson: one(lessons, {
    fields: [quizzes.lessonId],
    references: [lessons.id],
  }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  quiz: one(quizzes, { fields: [questions.quizId], references: [quizzes.id] }),
}));

export const exercisesRelations = relations(exercises, ({ one }) => ({
  lesson: one(lessons, {
    fields: [exercises.lessonId],
    references: [lessons.id],
  }),
}));

export type Quiz = typeof quizzes.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
