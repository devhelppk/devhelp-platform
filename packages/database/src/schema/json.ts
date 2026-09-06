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
