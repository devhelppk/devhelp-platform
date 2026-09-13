import type { MetadataRoute } from "next";
import { and, asc, db, eq, isNull, schema } from "@repo/database";
import { clientEnv } from "@repo/env/client";

/**
 * Everything on the learning platform worth indexing.
 *
 * This is the fix for a gap the S19 review found: F2.14 calls the company pages
 * the platform's main SEO entry point, and until now nothing told a crawler
 * they existed. Courses, lessons, companies and published profiles are all
 * here; `robots.ts` handles the other half by keeping crawlers out of the staff
 * tools and out of `/search`.
 *
 * Revalidated hourly. A sitemap is read by machines on their own schedule, so
 * it does not need the freshness the company pages themselves have — and it
 * must never be the reason a deploy waits on a slow query.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = clientEnv.NEXT_PUBLIC_LMS_URL.replace(/\/$/, "");
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${base}/courses`, changeFrequency: "daily" as const, priority: 1 },
    {
      url: `${base}/companies`,
      changeFrequency: "daily" as const,
      priority: 1,
    },
    {
      url: `${base}/contributors`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    },
  ].map((e) => ({ ...e, lastModified: now }));

  try {
    const [courses, lessons, companies, paths, profiles] = await Promise.all([
      db
        .select({
          slug: schema.courses.slug,
          updatedAt: schema.courses.updatedAt,
        })
        .from(schema.courses)
        .where(
          and(
            eq(schema.courses.isPublished, true),
            isNull(schema.courses.archivedAt),
          ),
        )
        .orderBy(asc(schema.courses.slug)),
      db
        .select({
          course: schema.courses.slug,
          slug: schema.lessons.slug,
          updatedAt: schema.lessons.updatedAt,
        })
        .from(schema.lessons)
        .innerJoin(
          schema.courses,
          eq(schema.courses.id, schema.lessons.courseId),
        )
        .where(
          and(
            eq(schema.courses.isPublished, true),
            isNull(schema.courses.archivedAt),
            isNull(schema.lessons.archivedAt),
          ),
        ),
      // Published only: a pending proposal and a company merged into another
      // are both `status != 'published'`, and the merged one only exists to
      // redirect.
      db
        .select({
          slug: schema.organizations.slug,
          updatedAt: schema.companyProfiles.updatedAt,
        })
        .from(schema.organizations)
        .innerJoin(
          schema.companyProfiles,
          eq(schema.companyProfiles.organizationId, schema.organizations.id),
        )
        .where(
          and(
            eq(schema.organizations.kind, "company"),
            eq(schema.companyProfiles.status, "published"),
          ),
        )
        .orderBy(asc(schema.organizations.slug)),
      db
        .select({ slug: schema.paths.slug })
        .from(schema.paths)
        .where(
          and(
            eq(schema.paths.isPublished, true),
            isNull(schema.paths.archivedAt),
          ),
        ),
      // Only the profiles their owners chose to make public.
      db
        .select({ handle: schema.users.handle })
        .from(schema.users)
        .where(eq(schema.users.profilePublic, true)),
    ]);

    return [
      ...statics,
      ...courses.map((c) => ({
        url: `${base}/courses/${c.slug}`,
        lastModified: c.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      })),
      ...lessons.map((l) => ({
        url: `${base}/courses/${l.course}/${l.slug}`,
        lastModified: l.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...paths.map((p) => ({
        url: `${base}/paths/${p.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...companies.map((c) => ({
        url: `${base}/companies/${c.slug}`,
        lastModified: c.updatedAt ?? now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...profiles
        .filter((p): p is { handle: string } => Boolean(p.handle))
        .map((p) => ({
          url: `${base}/u/${p.handle}`,
          lastModified: now,
          changeFrequency: "monthly" as const,
          priority: 0.4,
        })),
    ];
  } catch (e) {
    // A sitemap that lists the four static pages is worth more than a 500 that
    // teaches a crawler the endpoint is broken.
    console.error("[lms] sitemap could not read the database", e);
    return statics;
  }
}
