import { and, asc, db, eq, isNull, schema } from "@repo/database";

export type CurriculumCourse = {
  slug: string;
  title: string;
  summary: string;
  track: "technical" | "career";
  level: "beginner" | "intermediate" | "advanced";
};

/**
 * The published courses, for the landing page's curriculum section.
 *
 * Read straight through Drizzle rather than through `@repo/api`'s server
 * caller. The caller is the right tool inside the LMS, which is the app the API
 * belongs to; pulling `@repo/api` into the marketing site would drag learning,
 * notify, email, storage and the exercise runner into this build for one public
 * select of five columns. Nothing here is user-scoped or gated, so there is no
 * authorisation to route through a procedure.
 *
 * **It returns an empty list instead of throwing.** The front page of a project
 * must not 500 because Postgres hiccuped, and a page that lists no courses for
 * an hour is a smaller failure than a page that lists nothing at all. The
 * section renders only when this is non-empty.
 */
export async function publishedCourses(): Promise<CurriculumCourse[]> {
  try {
    return await db
      .select({
        slug: schema.courses.slug,
        title: schema.courses.title,
        summary: schema.courses.summary,
        track: schema.courses.track,
        level: schema.courses.level,
      })
      .from(schema.courses)
      .where(
        and(
          eq(schema.courses.isPublished, true),
          isNull(schema.courses.archivedAt),
          // A course the content repo created but nobody has described yet has
          // its slug as a placeholder title. It is not ready to be advertised.
          eq(schema.courses.needsMetadata, false),
        ),
      )
      .orderBy(asc(schema.courses.track), asc(schema.courses.title));
  } catch (e) {
    console.error("[web] could not read the curriculum", e);
    return [];
  }
}
