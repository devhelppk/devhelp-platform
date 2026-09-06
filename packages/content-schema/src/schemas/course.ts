import { z } from "zod";
import { author, slug } from "./common.ts";

export const courseTrack = z.enum(["technical", "career"]);
export const courseLevel = z.enum(["beginner", "intermediate", "advanced"]);

export const completionCriteria = z
  .object({
    requireAllRequiredLessons: z.boolean().optional(),
    minQuizScore: z.number().int().min(0).max(100).optional(),
    requireProjectAccepted: z.boolean().optional(),
  })
  .strict();

/** `course.yaml` at the root of a course directory. */
export const courseMeta = z
  .object({
    slug,
    title: z.string().min(3).max(80),
    summary: z.string().min(20).max(200),
    description: z.string().optional(),
    track: courseTrack.default("technical"),
    level: courseLevel.default("beginner"),
    estimatedHours: z.number().int().positive().optional(),
    cover: z.string().optional(),
    prerequisites: z.array(slug).default([]),
    completionCriteria: completionCriteria.default({
      requireAllRequiredLessons: true,
    }),
    published: z.boolean().default(false),
    authors: z.array(author).default([]),
  })
  .strict();
export type CourseMeta = z.infer<typeof courseMeta>;

/** `module.yaml` inside a module directory. */
export const moduleMeta = z
  .object({
    slug,
    title: z.string().min(3).max(80),
    summary: z.string().max(200).optional(),
  })
  .strict();
export type ModuleMeta = z.infer<typeof moduleMeta>;
