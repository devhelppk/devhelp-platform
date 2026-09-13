import { and, db, eq, isNull, schema } from "@repo/database";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A course on devhelp";

/**
 * The share card for a course page: the course's own title, not the site's.
 *
 * A course link is the thing people paste into a WhatsApp group, which is how
 * this audience actually shares anything.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const { course } = await params;
  const [row] = await db
    .select({ title: schema.courses.title, summary: schema.courses.summary })
    .from(schema.courses)
    .where(
      and(
        eq(schema.courses.slug, course),
        eq(schema.courses.isPublished, true),
        isNull(schema.courses.archivedAt),
      ),
    )
    .limit(1);
  return ogCard({
    eyebrow: "Course",
    title: row?.title ?? "devhelp",
    detail: row?.summary ?? "Free, open-source engineering courses.",
  });
}
