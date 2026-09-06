import { z } from "zod";

export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case");

export const author = z.object({
  /** GitHub handle; matched to a devhelp user later. */
  github: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
