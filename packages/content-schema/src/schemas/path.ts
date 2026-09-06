import { z } from "zod";
import { slug } from "./common.ts";

/** `paths/<slug>.yaml` */
export const pathFile = z
  .object({
    slug,
    title: z.string().min(3).max(80),
    summary: z.string().min(20).max(200),
    description: z.string().optional(),
    courses: z.array(slug).min(1),
    published: z.boolean().default(false),
    position: z.number().int().min(0).default(0),
  })
  .strict();
export type PathFile = z.infer<typeof pathFile>;
