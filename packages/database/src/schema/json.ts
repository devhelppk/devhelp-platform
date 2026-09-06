import { z } from "zod";

/**
 * Zod schemas for every jsonb column. Drizzle's `.$type<>()` gives compile-time
 * shape; these give runtime validation at write boundaries (sync, seed,
 * @repo/learning). Infer the TS types from here so they cannot drift.
 */

export const completionCriteriaSchema = z
  .object({
    requireAllRequiredLessons: z.boolean().optional(),
    minQuizScore: z.number().int().min(0).max(100).optional(),
    requireProjectAccepted: z.boolean().optional(),
  })
  .strict();
export type CompletionCriteria = z.infer<typeof completionCriteriaSchema>;

export const questionOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** Server-only. Never send to the client; use `questionPublicColumns`. */
  isCorrect: z.boolean(),
  feedback: z.string().optional(),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;
export const questionOptionsSchema = z.array(questionOptionSchema);

/** Accepted answers for `short` questions. Server-only. */
export const questionAnswerSchema = z.array(z.string().min(1)).min(1);
export type QuestionAnswer = z.infer<typeof questionAnswerSchema>;

/** A file map as Sandpack / Pyodide expect it: path -> contents. */
export const fileMapSchema = z.record(z.string().min(1), z.string());
export type FileMap = z.infer<typeof fileMapSchema>;

export const progressEventPayloadSchema = z.record(z.string(), z.unknown());
export type ProgressEventPayload = z.infer<typeof progressEventPayloadSchema>;

/** A learner's answers to a quiz: option ids for single/multi, free text for short. */
export const quizAnswersSchema = z.array(
  z.object({
    questionId: z.uuid(),
    value: z.union([z.string(), z.array(z.string())]),
  }),
);
export type QuizAnswers = z.infer<typeof quizAnswersSchema>;

/** Per-question grading snapshot, frozen at submit time so regrading and history survive content changes. */
export const quizSnapshotSchema = z.array(
  z.object({
    questionId: z.uuid(),
    version: z.number().int(),
    points: z.number().int(),
    earned: z.number().int(),
    correct: z.boolean(),
  }),
);
export type QuizSnapshot = z.infer<typeof quizSnapshotSchema>;

/** Results reported by the exercise runner (browser harness or Node parity run). */
export const exerciseResultsSchema = z.array(
  z.object({
    name: z.string().min(1),
    passed: z.boolean(),
    error: z.string().optional(),
    durationMs: z.number().optional(),
  }),
);
export type ExerciseResults = z.infer<typeof exerciseResultsSchema>;
