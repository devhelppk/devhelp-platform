import { and, eq, isNull, schema, sql } from "@repo/database";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

const { companyProfiles, courses, lessons, organizations } = schema;

/**
 * Search across courses, lessons, and companies (X3, S14). Postgres full text,
 * no new infrastructure — the company bank already proved the shape works.
 *
 * Results are grouped by kind rather than interleaved: `ts_rank_cd` is not
 * comparable across tables, and pretending it is produces an order that reads
 * as random. Within a kind the ranking is real.
 */
export const searchRouter = router({
  query: publicProcedure
    .input(
      z.object({
        q: z.string().trim().min(2).max(100),
        limit: z.number().int().min(1).max(20).default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      // `websearch_to_tsquery` understands what a person types: quoted
      // phrases, `or`, a leading `-`. `plainto_` would treat those as words.
      const tsq = sql`websearch_to_tsquery('english', ${input.q})`;
      const like = `%${input.q}%`;

      const [foundCourses, foundLessons, foundCompanies] = await Promise.all([
        ctx.db
          .select({
            slug: courses.slug,
            title: courses.title,
            summary: courses.summary,
            level: courses.level,
            rank: sql<number>`ts_rank_cd(${courses.searchVector}, ${tsq})`,
          })
          .from(courses)
          .where(
            and(
              eq(courses.isPublished, true),
              isNull(courses.archivedAt),
              sql`${courses.searchVector} @@ ${tsq}`,
            ),
          )
          .orderBy(sql`ts_rank_cd(${courses.searchVector}, ${tsq}) desc`)
          .limit(input.limit),
        ctx.db
          .select({
            slug: lessons.slug,
            title: lessons.title,
            type: lessons.type,
            courseSlug: courses.slug,
            courseTitle: courses.title,
            rank: sql<number>`ts_rank_cd(${lessons.searchVector}, ${tsq})`,
          })
          .from(lessons)
          .innerJoin(courses, eq(courses.id, lessons.courseId))
          .where(
            and(
              isNull(lessons.archivedAt),
              // A lesson inside an unpublished course is not public either.
              eq(courses.isPublished, true),
              isNull(courses.archivedAt),
              sql`${lessons.searchVector} @@ ${tsq}`,
            ),
          )
          .orderBy(sql`ts_rank_cd(${lessons.searchVector}, ${tsq}) desc`)
          .limit(input.limit),
        ctx.db
          .select({
            slug: organizations.slug,
            name: organizations.name,
            industry: companyProfiles.industry,
            description: companyProfiles.description,
          })
          .from(organizations)
          .innerJoin(
            companyProfiles,
            eq(companyProfiles.organizationId, organizations.id),
          )
          .where(
            and(
              eq(organizations.kind, "company"),
              eq(companyProfiles.status, "published"),
              // Name matching as well as the prose vector: somebody searching
              // a company is usually typing its name, which the vector — built
              // from description and industry — does not contain.
              sql`(${companyProfiles.searchVector} @@ ${tsq} or ${organizations.name} ilike ${like})`,
            ),
          )
          .orderBy(organizations.name)
          .limit(input.limit),
      ]);

      return {
        q: input.q,
        courses: foundCourses,
        lessons: foundLessons,
        companies: foundCompanies,
        total:
          foundCourses.length + foundLessons.length + foundCompanies.length,
      };
    }),
});
