import { db as defaultDb, schema } from "./index";

/**
 * Reference rows for the company bank (S10a). Cities and job roles are not
 * curriculum, so they do not live in the content repo; they are small, stable
 * lists that filters and aggregates group on. Seeding is idempotent and safe in
 * production: `pnpm db:reference`.
 */
const CITIES: { slug: string; name: string; province: string }[] = [
  { slug: "karachi", name: "Karachi", province: "Sindh" },
  { slug: "lahore", name: "Lahore", province: "Punjab" },
  { slug: "islamabad", name: "Islamabad", province: "Islamabad" },
  { slug: "rawalpindi", name: "Rawalpindi", province: "Punjab" },
  { slug: "faisalabad", name: "Faisalabad", province: "Punjab" },
  { slug: "multan", name: "Multan", province: "Punjab" },
  { slug: "peshawar", name: "Peshawar", province: "Khyber Pakhtunkhwa" },
  { slug: "quetta", name: "Quetta", province: "Balochistan" },
  { slug: "hyderabad", name: "Hyderabad", province: "Sindh" },
  { slug: "sialkot", name: "Sialkot", province: "Punjab" },
  { slug: "gujranwala", name: "Gujranwala", province: "Punjab" },
  { slug: "abbottabad", name: "Abbottabad", province: "Khyber Pakhtunkhwa" },
  { slug: "remote", name: "Remote", province: "Pakistan" },
];

const JOB_ROLES: { slug: string; name: string; family: string }[] = [
  {
    slug: "frontend-engineer",
    name: "Frontend engineer",
    family: "engineering",
  },
  { slug: "backend-engineer", name: "Backend engineer", family: "engineering" },
  {
    slug: "full-stack-engineer",
    name: "Full-stack engineer",
    family: "engineering",
  },
  { slug: "mobile-engineer", name: "Mobile engineer", family: "engineering" },
  {
    slug: "devops-engineer",
    name: "DevOps / platform engineer",
    family: "engineering",
  },
  { slug: "qa-engineer", name: "QA / test engineer", family: "engineering" },
  { slug: "data-engineer", name: "Data engineer", family: "data" },
  { slug: "data-scientist", name: "Data scientist", family: "data" },
  { slug: "ml-engineer", name: "Machine learning engineer", family: "data" },
  { slug: "product-designer", name: "Product designer", family: "design" },
  { slug: "product-manager", name: "Product manager", family: "product" },
  {
    slug: "engineering-manager",
    name: "Engineering manager",
    family: "management",
  },
  { slug: "intern", name: "Intern / trainee", family: "engineering" },
  { slug: "other", name: "Other", family: "other" },
];

/** Insert any missing cities and job roles. Existing rows are left alone. */
export async function ensureReferenceData(db = defaultDb) {
  await db.insert(schema.cities).values(CITIES).onConflictDoNothing();
  await db.insert(schema.jobRoles).values(JOB_ROLES).onConflictDoNothing();
  return { cities: CITIES.length, jobRoles: JOB_ROLES.length };
}

if (process.argv[1]?.endsWith("reference.ts")) {
  ensureReferenceData()
    .then((n) => {
      console.log(
        `Reference data ready: ${n.cities} cities, ${n.jobRoles} job roles.`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
