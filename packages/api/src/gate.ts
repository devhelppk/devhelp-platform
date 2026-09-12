import { and, eq, gte, inArray, schema, sql } from "@repo/database";
import type { Database } from "@repo/database";
import { env } from "@repo/env";
import { TRPCError } from "@trpc/server";

/**
 * The company bank's give-to-get gate (S15 part B).
 *
 * A viewer sees contributed content — reviews, interview experiences, pay — when
 * they have a verified email **and** have contributed to any company in the last
 * year. Facts about a company stay public: see `companies.bySlug`.
 *
 * Founder decisions, recorded here because the rule is otherwise inscrutable:
 *
 * - **D2.** Taken literally the rule is circular at launch: nobody may read
 *   without contributing, nobody contributes to a bank they cannot read, and
 *   there are no users. So below `WARM_AT` published contributions a verified
 *   email is enough, and the contribution rule switches itself on once the bank
 *   is warm. One number, no migration to flip — `COMPANY_BANK_WARM_AT`, which
 *   defaults to 250 and is the only way to see the `needs_contribution` wall in
 *   development, where the bank is always cold.
 * - **D3.** A `pending` contribution counts and a `rejected` or `hidden` one
 *   does not. Counting only approved work would lock someone out for as long as
 *   moderation takes, which punishes them for our latency. The cost accepted is
 *   that one plausible-looking submission buys access until it is rejected.
 * - **D4.** Admins and mentors are never gated (moderation is impossible
 *   through a wall), and a member of a company's own organisation is not gated
 *   on that company (S13 gave representatives a reason to be there, and a
 *   company that cannot read its own reviews cannot reply to them).
 */
export const WARM_AT = env.COMPANY_BANK_WARM_AT;

export type Eligibility =
  | { allowed: true; reason: "role" | "member" | "contributor" | "bank_cold" }
  | {
      allowed: false;
      reason: "signed_out" | "needs_verification" | "needs_contribution";
    };

/**
 * Has this person contributed anything since `since`?
 *
 * Three one-row lookups rather than one `exists(... union all ...)`: each is a
 * single index seek (migration 0021 added the author/createdAt indexes), and
 * they run together. The first person to contribute usually has a review, so
 * this is normally answered by the first of them.
 */
async function hasContributed(db: Database, userId: string, since: Date) {
  const kept = ["pending", "published"] as const;
  const [review, interview, salary] = await Promise.all([
    db.query.companyReviews.findFirst({
      where: and(
        eq(schema.companyReviews.authorId, userId),
        inArray(schema.companyReviews.status, kept),
        gte(schema.companyReviews.createdAt, since),
      ),
      columns: { id: true },
    }),
    db.query.interviewExperiences.findFirst({
      where: and(
        eq(schema.interviewExperiences.authorId, userId),
        inArray(schema.interviewExperiences.status, kept),
        gte(schema.interviewExperiences.createdAt, since),
      ),
      columns: { id: true },
    }),
    db.query.salaryPoints.findFirst({
      where: and(
        eq(schema.salaryPoints.authorId, userId),
        inArray(schema.salaryPoints.status, kept),
        gte(schema.salaryPoints.createdAt, since),
      ),
      columns: { id: true },
    }),
  ]);
  return Boolean(review ?? interview ?? salary);
}

/** Published contributions across the bank, for the D2 cold-start rule. */
async function bankSize(db: Database) {
  const [row] = await db.execute(sql`
    select
      (select count(*) from ${schema.companyReviews} where ${schema.companyReviews.status} = 'published')
      + (select count(*) from ${schema.interviewExperiences} where ${schema.interviewExperiences.status} = 'published')
      + (select count(*) from ${schema.salaryPoints} where ${schema.salaryPoints.status} = 'published')
      as n
  `);
  return Number((row as { n?: string | number } | undefined)?.n ?? 0);
}

export async function checkEligibility(
  db: Database,
  viewer: { id: string; role: string | null; emailVerified: boolean } | null,
  /** The company being read, when the question is about one. */
  organizationId?: string,
  /**
   * The cold-start threshold, defaulting to the configured one. A parameter
   * only so a test can set it to 0 and exercise the contribution rule without
   * seeding 250 published rows; every caller in the product leaves it alone.
   */
  warmAt: number = WARM_AT,
): Promise<Eligibility> {
  if (!viewer) return { allowed: false, reason: "signed_out" };
  if (viewer.role === "admin" || viewer.role === "mentor")
    return { allowed: true, reason: "role" };

  if (organizationId) {
    const member = await db.query.members.findFirst({
      where: and(
        eq(schema.members.organizationId, organizationId),
        eq(schema.members.userId, viewer.id),
      ),
      columns: { id: true },
    });
    if (member) return { allowed: true, reason: "member" };
  }

  if (!viewer.emailVerified)
    return { allowed: false, reason: "needs_verification" };

  // D2: while the bank is cold, a verified email is the whole gate.
  if ((await bankSize(db)) < warmAt)
    return { allowed: true, reason: "bank_cold" };

  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  if (await hasContributed(db, viewer.id, since))
    return { allowed: true, reason: "contributor" };
  return { allowed: false, reason: "needs_contribution" };
}

/**
 * Throws unless the viewer may read contributed content about this company.
 *
 * Called at the top of every procedure that returns contributions, so the gate
 * holds against a hand-made API call and not only through the UI — the page
 * choosing a different panel is a presentation decision, not a boundary.
 *
 * Role and verification come from the table rather than the session cookie,
 * which caches its copy for five minutes and cannot see a verify link being
 * followed (the same reason `freshUser` exists).
 */
export async function requireBankAccess(
  db: Database,
  session: { user: { id: string } } | null,
  organizationId?: string,
) {
  const viewer = session
    ? await db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { id: true, role: true, emailVerified: true },
      })
    : null;
  const verdict = await checkEligibility(db, viewer ?? null, organizationId);
  if (verdict.allowed) return verdict;
  throw new TRPCError({
    code: verdict.reason === "signed_out" ? "UNAUTHORIZED" : "FORBIDDEN",
    message:
      verdict.reason === "signed_out"
        ? "Sign in to read what people say about this company."
        : verdict.reason === "needs_verification"
          ? "Verify your email to read what people say about this company."
          : "Share one experience of your own to read the rest.",
    cause: verdict.reason.toUpperCase(),
  });
}
