#!/usr/bin/env tsx
/**
 * Delete test fixtures left behind in a development database.
 *
 * Integration tests create real rows and clean up in `afterAll`. An
 * `afterAll` does not run when a run is killed — an OOM, a Ctrl-C, a dev
 * server that took the machine's memory — and what it leaves behind is not
 * inert: `createCourse` in `packages/learning/src/test-helpers.ts` inserts with
 * `isPublished: true`, so nineteen abandoned courses from one interrupted run
 * on 2026-09-12 were sitting in the dev catalogue, two of them visible in the
 * rendered `/courses` HTML.
 *
 * Matching is by the fixture naming conventions the suites already use, and
 * only those: a slug or email that a person would not type. Nothing here
 * touches real content, which comes from the content repo with real slugs.
 *
 *   pnpm db:clean-fixtures          # report what would go, delete nothing
 *   pnpm db:clean-fixtures --yes    # delete it
 *
 * Development only: it refuses to run against production, like the seed and
 * `dev:admin`.
 */
import { and, like, or, sql } from "drizzle-orm";
import { db } from "./index";
import * as schema from "./schema";

/**
 * Course slugs the suites generate. `course-` comes from the learning
 * test-helpers, `sync-` from the content sync tests, and the rest name their
 * own suite. Real content slugs are words (`ai-engineering-foundations`), so
 * the risk of a collision is a course someone deliberately calls "cert-…".
 */
const COURSE_PREFIXES = [
  "course-",
  "sync-",
  "cert-",
  "badge-",
  "search-",
  "studio-",
  "disc-",
];
/**
 * Every suite makes its users at this domain. `pnpm dev:admin` also defaults
 * to `devadmin@devhelp.test`, so an admin is excluded below: deleting the
 * account you are signed in as, to tidy up test data, is a surprise nobody
 * wants twice.
 */
const USER_EMAIL_LIKE = "%@devhelp.test";
/** Company fixtures: `flagco-`, `payco-`, `gateco-`, `claimco-`, `acme-`… */
const COMPANY_PREFIXES = [
  "flagco-",
  "payco-",
  "gateco-",
  "claimco-",
  "mergeco-",
  "acme-",
  "hidden-",
  "odd-",
];

/** Never a dev admin, however its email is spelled. */
const notAdmin = sql`coalesce(${schema.users.role}, 'student') <> 'admin'`;

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing to delete fixtures in production.");
  const apply = process.argv.includes("--yes");

  const courses = await db
    .select({ id: schema.courses.id, slug: schema.courses.slug })
    .from(schema.courses)
    .where(
      or(...COURSE_PREFIXES.map((p) => like(schema.courses.slug, `${p}%`))),
    );
  const users = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(and(like(schema.users.email, USER_EMAIL_LIKE), notAdmin));
  const orgs = await db
    .select({ id: schema.organizations.id, slug: schema.organizations.slug })
    .from(schema.organizations)
    .where(
      and(
        sql`${schema.organizations.kind} = 'company'`,
        or(
          ...COMPANY_PREFIXES.map((p) =>
            like(schema.organizations.slug, `${p}%`),
          ),
        ),
      ),
    );
  const paths = await db
    .select({ id: schema.paths.id, slug: schema.paths.slug })
    .from(schema.paths)
    .where(
      or(
        like(schema.paths.slug, "p-%"),
        like(schema.paths.slug, "path-%"),
        like(schema.paths.slug, "sync-%"),
      ),
    );

  const published = courses.filter((c) => c.slug.startsWith("course-")).length;
  console.log(
    `Fixtures found: ${courses.length} courses (${published} of them the ` +
      `published course-* kind), ${paths.length} paths, ${orgs.length} ` +
      `companies, ${users.length} users.`,
  );
  for (const c of courses.slice(0, 5)) console.log(`  course ${c.slug}`);
  if (courses.length > 5) console.log(`  … and ${courses.length - 5} more`);

  if (!apply) {
    console.log("\nNothing deleted. Re-run with --yes to delete.");
    return;
  }

  // Order matters only for legibility: every dependent row is `on delete
  // cascade` from these four (certificates included, checked against the live
  // constraint list), so each delete takes its own subtree with it.
  const del = async (label: string, fn: () => Promise<unknown>) => {
    await fn();
    console.log(`deleted ${label}`);
  };
  if (courses.length)
    await del(`${courses.length} courses`, () =>
      db
        .delete(schema.courses)
        .where(
          or(...COURSE_PREFIXES.map((p) => like(schema.courses.slug, `${p}%`))),
        ),
    );
  if (paths.length)
    await del(`${paths.length} paths`, () =>
      db
        .delete(schema.paths)
        .where(
          or(
            like(schema.paths.slug, "p-%"),
            like(schema.paths.slug, "path-%"),
            like(schema.paths.slug, "sync-%"),
          ),
        ),
    );
  if (orgs.length)
    await del(`${orgs.length} companies`, () =>
      db
        .delete(schema.organizations)
        .where(
          and(
            sql`${schema.organizations.kind} = 'company'`,
            or(
              ...COMPANY_PREFIXES.map((p) =>
                like(schema.organizations.slug, `${p}%`),
              ),
            ),
          ),
        ),
    );
  if (users.length)
    await del(`${users.length} users`, () =>
      db
        .delete(schema.users)
        .where(and(like(schema.users.email, USER_EMAIL_LIKE), notAdmin)),
    );

  // Content revisions from a fixture repo, which the sync tests write and
  // whose rows outlive the courses they published.
  const revisions = await db
    .delete(schema.contentRevisions)
    // The sync tests write `test/<run>`; the real repo is `devhelppk/…`.
    .where(like(schema.contentRevisions.repo, "test/%"))
    .returning({ id: schema.contentRevisions.id });
  if (revisions.length) console.log(`deleted ${revisions.length} revisions`);

  // Unreferenced archived rows are left alone deliberately: `content:sync`
  // archives rather than deletes so learner history survives, and this script
  // is about fixtures, not about tidying real content.
  console.log("\nDone.");
}

void main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);
