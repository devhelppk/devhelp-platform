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
  console.log(
    "Seeded dev admin user (team@devhelp.pk), reference data, and one company. Run `pnpm content:refresh` for courses.",
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
