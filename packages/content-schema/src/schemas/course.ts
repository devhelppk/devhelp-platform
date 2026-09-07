import { z } from "zod";
import { slug } from "./common.ts";

export const completionCriteria = z
  .object({
    requireAllRequiredLessons: z.boolean().optional(),
    minQuizScore: z.number().int().min(0).max(100).optional(),
    requireProjectAccepted: z.boolean().optional(),
  })
  .strict();

/**
 * `course.yaml` at the root of a course directory.
 *
 * Identity, structure, and the rules that decide completion. Everything a
 * reader is *shown* — title, summary, level, cover, whether it is published,
 * who wrote it — lives in Postgres and is edited in the studio (S11). See
 * `MOVED_FIELDS` for what left and why.
 */
export const courseMeta = z
  .object({
    slug,
    prerequisites: z.array(slug).default([]),
    completionCriteria: completionCriteria.default({
      requireAllRequiredLessons: true,
    }),
  })
  .strict();
export type CourseMeta = z.infer<typeof courseMeta>;

/** `module.yaml` inside a module directory. Identity only; the title is the studio's. */
export const moduleMeta = z.object({ slug }).strict();
export type ModuleMeta = z.infer<typeof moduleMeta>;
