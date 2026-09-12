import { db, eq, schema } from "@repo/database";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { checkEligibility } from "./gate";
import { createCaller } from "./root";

/**
 * The give-to-get gate (S15 part B).
 *
 * These assert on the **procedures**, not on a rendered page: the page choosing
 * a wall is a presentation decision, and the boundary has to hold against a
 * hand-made API call. The page's own guarantee — that an ineligible viewer's
 * HTML contains no contributed content — follows from the procedures throwing,
 * because the page cannot render what it could not fetch.
 */

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, unverified: User, verified: User, member: User;
let orgId: string;
const slug = `gateco-${run}`;
const made: string[] = [];

const as = (u: User | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({ user: u, session: { id: "s" } } as unknown as Context["session"])
      : null,
  } as Context);

async function user(
  name: string,
  opts: { role?: "admin" | "mentor"; emailVerified?: boolean } = {},
) {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${name}-${run}@devhelp.test`,
      name,
      emailVerified: opts.emailVerified ?? true,
      ...(opts.role ? { role: opts.role } : {}),
    })
    .returning();
  made.push(u!.id);
  return u!;
}

beforeAll(async () => {
  admin = await user("gate-admin", { role: "admin" });
  unverified = await user("gate-unverified", { emailVerified: false });
  verified = await user("gate-verified");
  member = await user("gate-member");
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `Gateco ${run}`,
      slug,
      kind: "company",
      createdAt: new Date(),
    })
    .returning();
  orgId = org!.id;
  await db
    .insert(schema.companyProfiles)
    .values({ organizationId: orgId, status: "published" });
  await db.insert(schema.members).values({
    organizationId: orgId,
    userId: member.id,
    role: "member",
    createdAt: new Date(),
  });
});

afterAll(async () => {
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, orgId));
  for (const id of made)
    await db.delete(schema.users).where(eq(schema.users.id, id));
});

/** Every procedure that returns something a person contributed. */
const gated = [
  ["reviews", (c: ReturnType<typeof as>) => c.companies.reviews({ slug })],
  [
    "interviews",
    (c: ReturnType<typeof as>) => c.companies.interviews({ slug }),
  ],
  ["salaries", (c: ReturnType<typeof as>) => c.companies.salaries({ slug })],
  ["responses", (c: ReturnType<typeof as>) => c.companies.responses({ slug })],
] as const;

describe("company bank gate", () => {
  for (const [name, call] of gated) {
    it(`refuses ${name} to a signed-out caller`, async () => {
      await expect(call(as(null))).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it(`refuses ${name} to an unverified caller`, async () => {
      await expect(call(as(unverified))).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it(`allows ${name} to an admin`, async () => {
      await expect(call(as(admin))).resolves.toBeDefined();
    });
  }

  it("tells the page why, without telling it anything it gates", async () => {
    expect(await as(null).companies.eligibility({ slug })).toEqual({
      allowed: false,
      reason: "signed_out",
    });
    expect(await as(unverified).companies.eligibility({ slug })).toEqual({
      allowed: false,
      reason: "needs_verification",
    });
  });

  it("keeps a company's own representative out of the gate (D4)", async () => {
    expect(await as(member).companies.eligibility({ slug })).toMatchObject({
      allowed: true,
    });
    await expect(as(member).companies.reviews({ slug })).resolves.toBeDefined();
  });

  it("leaves the facts tier public (D1)", async () => {
    // The wall is about what people wrote, not about what the company is.
    const company = await as(null).companies.bySlug({ slug });
    expect(company.name).toBe(`Gateco ${run}`);
  });

  it("lets a verified reader in while the bank is cold (D2)", async () => {
    const viewer = { id: verified.id, role: null, emailVerified: true };
    // The real threshold: a fresh bank is under it, so verification is enough.
    expect(await checkEligibility(db, viewer, orgId)).toMatchObject({
      allowed: true,
      reason: "bank_cold",
    });
  });

  it("asks a verified non-contributor for one contribution once warm", async () => {
    const viewer = { id: verified.id, role: null, emailVerified: true };
    expect(await checkEligibility(db, viewer, orgId, 0)).toEqual({
      allowed: false,
      reason: "needs_contribution",
    });
  });

  it("counts a pending contribution (D3)", async () => {
    const contributor = await user("gate-contributor");
    await as(contributor).contributions.submitReview({
      slug,
      rating: 4,
      pros: "Something worth saying about this company at some length.",
      cons: "Something else worth saying about this company at length.",
      employmentStatus: "current",
    });
    // Nobody has moderated it, and it already buys access.
    expect(
      await checkEligibility(
        db,
        { id: contributor.id, role: null, emailVerified: true },
        orgId,
        0,
      ),
    ).toEqual({ allowed: true, reason: "contributor" });
  });

  it("does not count a contribution older than a year", async () => {
    const lapsed = await user("gate-lapsed");
    const { id } = await as(lapsed).contributions.submitReview({
      slug,
      rating: 5,
      pros: "A review written a long time ago, at a plausible length for it.",
      cons: "Also written a long time ago, and also long enough to pass.",
      employmentStatus: "former",
    });
    await db
      .update(schema.companyReviews)
      .set({ createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) })
      .where(eq(schema.companyReviews.id, id));
    expect(
      await checkEligibility(
        db,
        { id: lapsed.id, role: null, emailVerified: true },
        orgId,
        0,
      ),
    ).toEqual({ allowed: false, reason: "needs_contribution" });
  });

  it("throws a reason a client can branch on", async () => {
    const e = await as(null)
      .companies.reviews({ slug })
      .catch((err: unknown) => err);
    expect(e).toBeInstanceOf(TRPCError);
    // tRPC wraps a non-Error cause in an Error, so the reason is its message.
    expect((e as TRPCError).cause?.message).toBe("SIGNED_OUT");
  });
});
