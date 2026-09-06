import { z } from "zod";
import { author, isoDate, slug } from "./common.ts";

export const lessonMode = z.enum(["foundation", "industry"]);
export const completionRule = z.enum([
  "view",
  "quiz_pass",
  "exercise_pass",
  "submit",
]);

const base = {
  slug,
  title: z.string().min(3).max(100),
  mode: lessonMode.default("foundation"),
  isRequired: z.boolean().default(true),
  isFree: z.boolean().default(true),
  durationMinutes: z.number().int().positive().optional(),
  authors: z.array(author).default([]),
  reviewers: z.array(author).default([]),
  updated: isoDate.optional(),
};

/** Lesson MDX frontmatter, discriminated on `type`. */
export const lessonFrontmatter = z.discriminatedUnion("type", [
  z
    .object({
      ...base,
      type: z.literal("article"),
      completionRule: completionRule.default("view"),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("link"),
      completionRule: completionRule.default("view"),
      href: z.url(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("video"),
      completionRule: completionRule.default("view"),
      video: z
        .object({ provider: z.literal("youtube"), id: z.string().min(5) })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("quiz"),
      completionRule: completionRule.default("quiz_pass"),
      /** Quiz id: `quizzes/<id>.yaml` in the same course. */
      quiz: slug,
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("exercise"),
      completionRule: completionRule.default("exercise_pass"),
      /** Exercise id: `exercises/<id>/` in the same course. */
      exercise: slug,
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("project"),
      completionRule: completionRule.default("submit"),
      project: z
        .object({
          rubric: z.array(z.string().min(3)).min(1),
          submitVia: z.enum(["github"]).default("github"),
        })
        .strict(),
    })
    .strict(),
]);
export type LessonFrontmatter = z.infer<typeof lessonFrontmatter>;
export type LessonType = LessonFrontmatter["type"];
