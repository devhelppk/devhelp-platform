import { z } from "zod";
import { slug } from "./common.ts";

export const completionRule = z.enum([
  "view",
  "quiz_pass",
  "exercise_pass",
  "submit",
]);

/**
 * What every lesson declares about itself: which lesson it is, and what kind.
 * The title, how long it takes, who wrote it, and whether it is free are the
 * studio's (S11); a `video`, `quiz`, or `exercise` reference stays here,
 * because that is what the lesson *is* and `content:check` validates it.
 */
const base = { slug };

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
