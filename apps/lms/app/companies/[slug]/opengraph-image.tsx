import { and, db, eq, schema } from "@repo/database";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A company on devhelp";

/**
 * The share card for a company page.
 *
 * Facts only — the name, the industry, the cities. What people wrote about the
 * company is gated (S15), and an image is the one place a gate cannot be
 * enforced per viewer: a card is generated once and cached by whoever renders
 * the link preview. So nothing from a contribution goes on it, not even a
 * rating.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [row] = await db
    .select({
      name: schema.organizations.name,
      industry: schema.companyProfiles.industry,
      cities: schema.companyProfiles.cities,
    })
    .from(schema.organizations)
    .innerJoin(
      schema.companyProfiles,
      eq(schema.companyProfiles.organizationId, schema.organizations.id),
    )
    .where(
      and(
        eq(schema.organizations.slug, slug),
        eq(schema.companyProfiles.status, "published"),
      ),
    )
    .limit(1);
  return ogCard({
    eyebrow: "Working in Pakistan",
    title: row?.name ?? "devhelp",
    detail:
      [row?.industry, row?.cities?.join(", ")].filter(Boolean).join(" · ") ||
      "Reviews, interviews and pay, written by the people who were there.",
  });
}
