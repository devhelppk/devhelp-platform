import { and, asc, eq, ilike, isNull, schema, sql } from "@repo/database";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

const live = (t: { archivedAt: unknown }) => isNull(t.archivedAt as never);

export const listCoursesInput = z.object({
  track: z.enum(schema.courseTrack.enumValues).optional(),
  level: z.enum(schema.courseLevel.enumValues).optional(),
  q: z.string().trim().max(80).optional(),
});

export const catalogueRouter = router({
  listPaths: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.paths.findMany({
      where: and(eq(schema.paths.isPublished, true), live(schema.paths)),
      orderBy: [asc(schema.paths.position)],
      with: {
        pathCourses: {
          orderBy: [asc(schema.pathCourses.position)],
          with: {
            course: {
              columns: {
                id: true,
                slug: true,
                title: true,
                summary: true,
                level: true,
                track: true,
                estimatedHours: true,
                isPublished: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    });
    // Same visibility rule as getPath, so counts agree across pages.
    return rows.map((p) => ({
      ...p,
      courses: p.pathCourses
        .map((pc) => pc.course)
        .filter((c) => c.isPublished && !c.archivedAt),
    }));
  }),

  getPath: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const path = await ctx.db.query.paths.findFirst({
        where: and(
          eq(schema.paths.slug, input.slug),
          eq(schema.paths.isPublished, true),
          live(schema.paths),
        ),
        with: {
          pathCourses: {
            orderBy: [asc(schema.pathCourses.position)],
            with: {
              course: {
                columns: {
                  id: true,
                  slug: true,
                  title: true,
                  summary: true,
                  level: true,
                  track: true,
                  estimatedHours: true,
                  isPublished: true,
                  archivedAt: true,
                },
              },
            },
          },
        },
      });
      if (!path) return null;
      return {
        ...path,
        courses: path.pathCourses
          .map((pc) => pc.course)
          .filter((c) => c.isPublished && !c.archivedAt),
      };
    }),

  listCourses: publicProcedure
    .input(listCoursesInput.optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(schema.courses.isPublished, true),
        live(schema.courses),
      ];
      if (input?.track) conditions.push(eq(schema.courses.track, input.track));
      if (input?.level) conditions.push(eq(schema.courses.level, input.level));
      if (input?.q)
        conditions.push(
          ilike(schema.courses.title, `%${input.q.replace(/[%_]/g, "")}%`),
        );
      const rows = await ctx.db
        .select({
          id: schema.courses.id,
          slug: schema.courses.slug,
          title: schema.courses.title,
          summary: schema.courses.summary,
          track: schema.courses.track,
          level: schema.courses.level,
          estimatedHours: schema.courses.estimatedHours,
          coverImageUrl: schema.courses.coverImageUrl,
          enrollmentCount: schema.courses.enrollmentCount,
          ratingAvg: schema.courses.ratingAvg,
          ratingCount: schema.courses.ratingCount,
          // Drizzle renders `${schema.courses.id}` unqualified inside a subquery, so name the outer table explicitly.
          lessonCount: sql<number>`(select count(*)::int from lessons l where l.course_id = courses.id and l.archived_at is null)`,
          durationMinutes: sql<number>`(select coalesce(sum(l.duration_minutes), 0)::int from lessons l where l.course_id = courses.id and l.archived_at is null)`,
        })
        .from(schema.courses)
        .where(and(...conditions))
        .orderBy(asc(schema.courses.title));
      return rows;
    }),

  getCourse: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const course = await ctx.db.query.courses.findFirst({
        where: and(
          eq(schema.courses.slug, input.slug),
          eq(schema.courses.isPublished, true),
          live(schema.courses),
        ),
        with: {
          modules: {
            where: live(schema.modules),
            orderBy: [asc(schema.modules.position)],
            with: {
              lessons: {
                where: live(schema.lessons),
                orderBy: [asc(schema.lessons.position)],
                columns: {
                  id: true,
                  slug: true,
                  title: true,
                  type: true,
                  mode: true,
                  isRequired: true,
                  isFree: true,
                  durationMinutes: true,
                  position: true,
                  completionRule: true,
                  contentPath: true,
                  videoProvider: true,
                  videoId: true,
                },
              },
            },
          },
          prerequisites: {
            with: { prerequisite: { columns: { slug: true, title: true } } },
          },
        },
      });
      if (!course) return null;
      const lessons = course.modules.flatMap((m) => m.lessons);
      return {
        ...course,
        lessonCount: lessons.length,
        durationMinutes: lessons.reduce(
          (n, l) => n + (l.durationMinutes ?? 0),
          0,
        ),
        prerequisites: course.prerequisites.map((p) => p.prerequisite),
      };
    }),
});
