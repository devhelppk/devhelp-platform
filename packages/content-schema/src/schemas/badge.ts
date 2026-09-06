import { z } from "zod";
import { slug } from "./common.ts";

/** Badge rules are evaluated against progress_events (S8). Defined now so authors can write them. */
export const badgeRule = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("lessons_in_window"),
      count: z.number().int().positive(),
      days: z.number().int().positive(),
    })
    .strict(),
  z.object({ kind: z.literal("course_completed"), course: slug }).strict(),
  z.object({ kind: z.literal("path_completed"), path: slug }).strict(),
  z.object({ kind: z.literal("first_project_accepted") }).strict(),
  z
    .object({
      kind: z.literal("streak_days"),
      days: z.number().int().positive(),
    })
    .strict(),
]);

/** `badges/<slug>.yaml` */
export const badgeFile = z
  .object({
    slug,
    name: z.string().min(3).max(60),
    description: z.string().min(10).max(200),
    icon: z.string().min(1),
    rule: badgeRule,
  })
  .strict();
export type BadgeFile = z.infer<typeof badgeFile>;
