import { eq } from "drizzle-orm";
import { db, schema } from "./index";
import { ensureReferenceData } from "./reference";

/**
 * Dev fixtures only. Course content is not seeded here: it comes from the
 * content repo (`pnpm content:refresh` = pull + check + sync). Idempotent and
 * never touches an existing account.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production.");
  }
  await db
    .insert(schema.users)
    .values({
      email: "team@devhelp.pk",
      name: "devhelp team",
      role: "admin",
      city: "Karachi",
    })
    .onConflictDoNothing();
  await ensureReferenceData();
  await seedDevCompany();
  await describeSyncedContent();
  console.log(
    "Seeded dev admin user (team@devhelp.pk), reference data, and one company. Run `pnpm content:refresh` for courses.",
  );
}

/**
 * Give synced content a readable title and publish it (S11).
 *
 * Since metadata left the content repo, a course arrives with its slug as a
 * placeholder and stays unpublished until a person describes it in the studio.
 * That is the point in production — but it means a fresh checkout, and CI,
 * have an empty catalogue and no lesson pages at all. This does what a mentor
 * would do on their first visit, so `pnpm db:seed` leaves a working site.
 *
 * Development only: `main()` refuses to run in production above.
 */
async function describeSyncedContent() {
  const title = (slug: string) =>
    slug
      .split("-")
      .map((w, i) => (i === 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(" ");
  const courses = await db.query.courses.findMany({
    where: eq(schema.courses.needsMetadata, true),
    columns: { id: true, slug: true },
  });
  for (const c of courses)
    await db
      .update(schema.courses)
      .set({
        title: title(c.slug),
        summary: `A seeded description for ${title(c.slug)}, written by nobody.`,
        isPublished: true,
        publishedAt: new Date(),
        needsMetadata: false,
      })
      .where(eq(schema.courses.id, c.id));
  const paths = await db.query.paths.findMany({
    where: eq(schema.paths.needsMetadata, true),
    columns: { id: true, slug: true },
  });
  for (const p of paths)
    await db
      .update(schema.paths)
      .set({
        title: title(p.slug),
        summary: `A seeded description for the ${title(p.slug)} path.`,
        isPublished: true,
        needsMetadata: false,
      })
      .where(eq(schema.paths.id, p.id));
  const lessons = await db.query.lessons.findMany({
    where: eq(schema.lessons.needsMetadata, true),
    columns: { id: true, slug: true },
  });
  for (const l of lessons)
    await db
      .update(schema.lessons)
      .set({ title: title(l.slug), needsMetadata: false })
      .where(eq(schema.lessons.id, l.id));
  const modules = await db.query.modules.findMany({
    columns: { id: true, slug: true, title: true },
  });
  for (const m of modules)
    if (m.title === m.slug)
      await db
        .update(schema.modules)
        .set({ title: title(m.slug) })
        .where(eq(schema.modules.id, m.id));
  if (courses.length || lessons.length)
    console.log(
      `Described ${courses.length} course(s), ${paths.length} path(s), and ${lessons.length} lesson(s) that arrived without metadata.`,
    );
}

/**
 * One published company so the directory is not empty in development. A company
 * is an organisation (`kind = "company"`); in production companies arrive
 * through the proposal queue, so this is dev-only.
 */
async function seedDevCompany() {
  const slug = "arbisoft";
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: "Arbisoft",
      slug,
      kind: "company",
      city: "Lahore",
      website: "https://arbisoft.com",
      // Better Auth sets timestamps in application code, not with a DB default.
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: schema.organizations.slug })
    .returning({ id: schema.organizations.id });
  const id =
    org?.id ??
    (
      await db.query.organizations.findFirst({
        where: eq(schema.organizations.slug, slug),
        columns: { id: true },
      })
    )?.id;
  if (!id) return;
  await db
    .insert(schema.companyProfiles)
    .values({
      organizationId: id,
      description:
        "Software consultancy building products for clients in the US and Europe, with a large engineering office in Lahore.",
      industry: "Software consultancy",
      size: "1000+",
      cities: ["Lahore", "Islamabad"],
      founded: 2007,
      stack: ["Python", "Django", "React", "TypeScript", "AWS"],
      hiresJuniors: true,
      careersUrl: "https://arbisoft.com/careers",
      linkedin: "https://www.linkedin.com/company/arbisoft",
      sources: ["https://arbisoft.com/about"],
      status: "published",
    })
    .onConflictDoNothing();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
