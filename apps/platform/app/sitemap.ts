import type { MetadataRoute } from "next";
import { and, asc, db, eq, isNull, schema } from "@repo/database";
import { clientEnv } from "@repo/env/client";

/**
 * Everything on devhelp worth indexing — one host now that the marketing
 * pages and the learning platform are the same app.
 *
 * This is the fix for a gap the S19 review found: F2.14 calls the company pages
 * the platform's main SEO entry point, and until now nothing told a crawler
 * they existed. Courses, lessons, companies and published profiles are all
 * here, alongside the marketing statics (About, Roadmap, Contribute, FAQ, the
 * policy documents); `robots.ts` handles the other half by keeping crawlers
 * out of the staff tools, out of `/search`, and out of `/home` and `/design`
 * (the dashboard and the style guide, deliberately absent here too — neither
 * is a page for a reader or a search engine).
 *
 * Revalidated hourly. A sitemap is read by machines on their own schedule, so
 * it does not need the freshness the company pages themselves have — and it
 * must never be the reason a deploy waits on a slow query.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly" as const, priority: 1 },
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
    {
      url: `${base}/about`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${base}/roadmap`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${base}/contribute`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    { url: `${base}/faq`, changeFrequency: "monthly" as const, priority: 0.6 },
    {
      url: `${base}/policy`,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    },
    {
      url: `${base}/privacy`,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    },
    { url: `${base}/terms`, changeFrequency: "yearly" as const, priority: 0.4 },
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
    console.error("[platform] sitemap could not read the database", e);
    return statics;
  }
}
