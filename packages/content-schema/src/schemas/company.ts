import { z } from "zod";
import { slug } from "./common.ts";

/** `companies/<slug>.yaml`: verified facts only. Reviews and salaries are user data (S10). */
export const companyFile = z
  .object({
    slug,
    name: z.string().min(2).max(100),
    website: z.url().optional(),
    description: z.string().max(500).optional(),
    industry: z.string().optional(),
    size: z
      .enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"])
      .optional(),
    cities: z.array(z.string().min(2)).default([]),
    founded: z.number().int().min(1900).max(2100).optional(),
    stack: z.array(z.string().min(1)).default([]),
    hiresJuniors: z.boolean().optional(),
    careersUrl: z.url().optional(),
    linkedin: z.url().optional(),
    sources: z.array(z.url()).default([]),
  })
  .strict();
export type CompanyFile = z.infer<typeof companyFile>;
