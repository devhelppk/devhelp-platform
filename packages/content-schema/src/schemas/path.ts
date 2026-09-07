import { z } from "zod";
import { slug } from "./common.ts";

/**
 * `paths/<slug>.yaml`. Which courses, in what order — the curation itself. The
 * title, summary, and whether it is published live in Postgres and are edited
 * in the studio (S11).
 */
export const pathFile = z
  .object({
    slug,
    courses: z.array(slug).min(1),
    position: z.number().int().min(0).default(0),
  })
  .strict();
export type PathFile = z.infer<typeof pathFile>;
