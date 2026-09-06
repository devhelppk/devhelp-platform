import { z } from "zod";
import { slug } from "./common.ts";

export const questionOption = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    correct: z.boolean().default(false),
    feedback: z.string().optional(),
  })
  .strict();

const questionBase = {
  id: z.string().min(1),
  prompt: z.string().min(5),
  explanation: z.string().optional(),
  points: z.number().int().positive().default(1),
};

export const question = z.discriminatedUnion("type", [
  z
    .object({
      ...questionBase,
      type: z.literal("single"),
      options: z.array(questionOption).min(2),
    })
    .strict(),
  z
    .object({
      ...questionBase,
      type: z.literal("multi"),
      options: z.array(questionOption).min(2),
    })
    .strict(),
  z
    .object({
      ...questionBase,
      type: z.literal("short"),
      answer: z.array(z.string().min(1)).min(1),
    })
    .strict(),
]);
export type Question = z.infer<typeof question>;

/** `quizzes/<id>.yaml` */
export const quizFile = z
  .object({
    id: slug,
    passScore: z.number().int().min(0).max(100).default(70),
    maxAttempts: z.number().int().positive().optional(),
    shuffle: z.boolean().default(false),
    questions: z.array(question).min(1),
  })
  .strict();
export type QuizFile = z.infer<typeof quizFile>;
