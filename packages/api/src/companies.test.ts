import { and, db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, mentor: User, learner: User, other: User, unverified: User;
let orgId: string;
const slug = `acme-${run}`;

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
  extra: Partial<typeof schema.users.$inferInsert> = {},
) {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${name}-${run}@devhelp.test`,
      name,
      emailVerified: true,
      ...extra,
    })
    .returning();
  return u!;
}

beforeAll(async () => {
  admin = await user("companies-admin", { role: "admin" });
  mentor = await user("companies-mentor", { role: "mentor" });
  learner = await user("companies-learner");
  other = await user("companies-other");
  unverified = await user("companies-unverified", { emailVerified: false });
  await db
    .insert(schema.mentorTracks)
    .values({ userId: mentor.id, track: "career" })
    .onConflictDoNothing();
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `Acme ${run}`,
      slug,
      kind: "company",
      city: "Lahore",
      website: "https://acme.test",
      createdAt: new Date(),
    })
    .returning();
  orgId = org!.id;
  await db.insert(schema.companyProfiles).values({
    organizationId: orgId,
    description: "A company that exists only in this test.",
    industry: "Testing",
    cities: ["Lahore"],
    stack: ["TypeScript"],
    status: "published",
  });
});

afterAll(async () => {
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, orgId));
  for (const u of [admin, mentor, learner, other, unverified])
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
});

describe("company directory", () => {
  it("lists and finds a published company, and hides a pending one", async () => {
    const [pending] = await db
      .insert(schema.organizations)
      .values({
        name: `Hidden ${run}`,
        slug: `hidden-${run}`,
        kind: "company",
        createdAt: new Date(),
      })
      .returning();
    await db
      .insert(schema.companyProfiles)
      .values({ organizationId: pending!.id, status: "pending" });
    const list = await as(null).companies.list({ q: `Acme ${run}` });
    expect(list.items.map((c) => c.slug)).toEqual([slug]);
    const all = await as(null).companies.list({ limit: 50 });
    expect(all.items.some((c) => c.slug === `hidden-${run}`)).toBe(false);
    await expect(
      as(null).companies.bySlug({ slug: `hidden-${run}` }),
    ).rejects.toThrow(/No such company/);
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, pending!.id));
  });

  it("finds a company by an alias", async () => {
    await db
      .insert(schema.companyAliases)
      .values({ organizationId: orgId, alias: `Acme Systems ${run}` });
    const list = await as(null).companies.list({ q: `Acme Systems ${run}` });
    expect(list.items.map((c) => c.slug)).toContain(slug);
  });
});

describe("contributions", () => {
  it("holds a review until an admin publishes it, then counts it", async () => {
    const { id } = await as(learner).contributions.submitReview({
      slug,
      rating: 4,
      learning: 5,
      pros: "Good mentorship and a patient team around you.",
      cons: "The deployment process is slower than it should be.",
      employmentStatus: "current",
      wouldRecommend: true,
    });
    // Pending: invisible, and not in the aggregates.
    expect((await as(null).companies.reviews({ slug })).items).toHaveLength(0);
    expect((await as(null).companies.bySlug({ slug })).reviewCount).toBe(0);

    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_review"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    expect(item?.status).toBe("pending");
    expect(item?.track).toBeNull();

    await as(admin).moderation.decide({ id: item!.id, action: "approve" });
    const published = await as(null).companies.reviews({ slug });
    expect(published.items).toHaveLength(1);
    const company = await as(null).companies.bySlug({ slug });
    expect(company.reviewCount).toBe(1);
    expect(company.ratingAvg).toBe(4);
    expect(company.recommendPct).toBe(100);
  });

  it("never exposes who wrote a review", async () => {
    const [review] = await as(null)
      .companies.reviews({ slug })
      .then((r) => r.items);
    expect(review).toBeDefined();
    expect(Object.keys(review!)).not.toContain("authorId");
    expect(JSON.stringify(review)).not.toContain(learner.id);
    expect(review!.createdMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("keeps one review per person per company, and re-queues an edit", async () => {
    const { id } = await as(learner).contributions.submitReview({
      slug,
      rating: 2,
      pros: "Still a friendly team once you know people.",
      cons: "The pace of change wore me down in the end.",
      employmentStatus: "former",
    });
    const rows = await db.query.companyReviews.findMany({
      where: and(
        eq(schema.companyReviews.organizationId, orgId),
        eq(schema.companyReviews.authorId, learner.id),
      ),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("pending");
    // The edit leaves the public page, because it is pending again.
    expect((await as(null).companies.reviews({ slug })).items).toHaveLength(0);
    const items = await db.query.moderationItems.findMany({
      where: and(
        eq(schema.moderationItems.subjectType, "company_review"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe("pending");
    await as(admin).moderation.decide({ id: items[0]!.id, action: "approve" });
  });

  it("never lets an author republish a review a moderator hid", async () => {
    const author = await user("companies-persistent");
    const { id } = await as(author).contributions.submitReview({
      slug,
      rating: 1,
      pros: "There is nothing good to say about this place at all.",
      cons: "This review will be hidden by a moderator in a moment.",
      employmentStatus: "former",
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_review"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    await as(admin).moderation.decide({
      id: item!.id,
      action: "reject",
      reason: "Names a colleague.",
      policyClause: "c1",
    });
    // Rewriting it must not put it back in front of a moderator.
    await as(author).contributions.submitReview({
      slug,
      rating: 1,
      pros: "There is nothing good to say about this place at all.",
      cons: "Trying again with the same words to get it published.",
      employmentStatus: "former",
    });
    const row = await db.query.companyReviews.findFirst({
      where: eq(schema.companyReviews.id, id),
    });
    expect(row!.status).toBe("rejected");
    const after = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.id, item!.id),
    });
    expect(after!.status).toBe("rejected");
    expect(
      (await as(null).companies.reviews({ slug })).items,
    ).not.toContainEqual(expect.objectContaining({ id }));
    await db.delete(schema.users).where(eq(schema.users.id, author.id));
  });

  it("lets an edit clear an optional field", async () => {
    const author = await user("companies-clearer");
    const { id } = await as(author).contributions.submitReview({
      slug,
      rating: 4,
      learning: 5,
      tenure: "1_2",
      advice: "This advice should disappear when the review is edited.",
      pros: "The first version of this review says a lot of things.",
      cons: "The first version of this review also says a few others.",
      employmentStatus: "current",
    });
    await as(author).contributions.submitReview({
      slug,
      rating: 4,
      pros: "The second version of this review is shorter on purpose.",
      cons: "The second version of this review drops the extra fields.",
      employmentStatus: "current",
    });
    const row = await db.query.companyReviews.findFirst({
      where: eq(schema.companyReviews.id, id),
    });
    expect(row!.advice).toBeNull();
    expect(row!.learning).toBeNull();
    expect(row!.tenure).toBeNull();
    await db.delete(schema.users).where(eq(schema.users.id, author.id));
  });

  it("keeps an unanswered recommendation out of the percentage", async () => {
    const author = await user("companies-silent");
    await as(author).contributions.submitReview({
      slug,
      rating: 5,
      pros: "This reviewer never answered the recommendation question.",
      cons: "That must not be counted as a no against the company.",
      employmentStatus: "current",
    });
    const row = await db.query.companyReviews.findFirst({
      where: eq(schema.companyReviews.authorId, author.id),
    });
    expect(row!.wouldRecommend).toBeNull();
    await db.delete(schema.users).where(eq(schema.users.id, author.id));
  });

  it("marks an employee by their email domain and never stores the address", async () => {
    const employee = await user("companies-employee", {
      email: `staff-${run}@acme.test`,
    });
    const { id } = await as(employee).contributions.submitReview({
      slug,
      rating: 5,
      pros: "I work here and the engineering culture is genuinely good.",
      cons: "We could write more tests than we currently do.",
      employmentStatus: "current",
    });
    const row = await db.query.companyReviews.findFirst({
      where: eq(schema.companyReviews.id, id),
    });
    expect(row!.affiliation).toBe("employee");
    expect(JSON.stringify(row)).not.toContain("acme.test");
    await db.delete(schema.users).where(eq(schema.users.id, employee.id));
  });

  it("records an interview experience and publishes it on approval", async () => {
    const { id } = await as(other).contributions.submitInterview({
      slug,
      yearMonth: "2026-03",
      source: "referral",
      rounds: [
        { type: "phone_screen", description: "Half an hour with a recruiter." },
        { type: "technical", description: "Two array questions on a call." },
      ],
      difficulty: 3,
      outcome: "offer",
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "interview_experience"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    await as(admin).moderation.decide({ id: item!.id, action: "approve" });
    const list = await as(null).companies.interviews({ slug });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]!.rounds).toHaveLength(2);
    expect(JSON.stringify(list.items[0])).not.toContain(other.id);
    expect((await as(null).companies.bySlug({ slug })).interviewCount).toBe(1);
  });

  it("rejects an interview dated in the future", async () => {
    await expect(
      as(other).contributions.submitInterview({
        slug,
        yearMonth: "2099-01",
        source: "direct",
        rounds: [{ type: "technical", description: "Has not happened yet." }],
        difficulty: 3,
        outcome: "offer",
      }),
    ).rejects.toThrow(/future/);
  });

  it("requires a verified email", async () => {
    await expect(
      as(unverified).contributions.submitReview({
        slug,
        rating: 5,
        pros: "I have not verified my email address at all.",
        cons: "I have not verified my email address at all.",
        employmentStatus: "current",
      }),
    ).rejects.toThrow(/Verify your email/);
  });
});

describe("moderation of company items", () => {
  it("hides a published review again and drops it from the aggregates", async () => {
    const review = await db.query.companyReviews.findFirst({
      where: and(
        eq(schema.companyReviews.organizationId, orgId),
        eq(schema.companyReviews.authorId, learner.id),
      ),
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_review"),
        eq(schema.moderationItems.subjectId, review!.id),
      ),
    });
    const before = (await as(null).companies.bySlug({ slug })).reviewCount;
    await as(admin).moderation.decide({
      id: item!.id,
      action: "hide",
      reason: "Names a colleague.",
      policyClause: "c3",
    });
    const after = await as(null).companies.bySlug({ slug });
    expect(after.reviewCount).toBe(before - 1);
    const row = await db.query.companyReviews.findFirst({
      where: eq(schema.companyReviews.id, review!.id),
    });
    expect(row!.status).toBe("hidden");
  });

  it("keeps company items out of a mentor's hands", async () => {
    const { id } = await as(other).contributions.submitInterview({
      slug,
      yearMonth: "2026-01",
      source: "campus",
      rounds: [
        { type: "hr", description: "A short chat about notice periods." },
      ],
      difficulty: 2,
      outcome: "rejected",
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "interview_experience"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    // Track-less items are already invisible to a mentor's queue.
    const queue = await as(mentor).moderation.queue({});
    expect(queue.items.some((i) => i.id === item!.id)).toBe(false);
    await expect(
      as(mentor).moderation.decide({ id: item!.id, action: "approve" }),
    ).rejects.toThrow(/not found|Only admins/i);
  });
});

describe("proposals", () => {
  it("creates a hidden company and publishes it when an admin approves", async () => {
    const name = `Proposed ${run}`;
    const { slug: newSlug } = await as(learner).companies.propose({
      name,
      website: "https://proposed.test",
      cities: ["Karachi"],
      why: "They hire a lot of junior engineers every year.",
    });
    await expect(as(null).companies.bySlug({ slug: newSlug })).rejects.toThrow(
      /No such company/,
    );
    const org = await db.query.organizations.findFirst({
      where: eq(schema.organizations.slug, newSlug),
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_proposal"),
        eq(schema.moderationItems.subjectId, org!.id),
      ),
    });
    expect(item?.status).toBe("pending");
    await as(admin).moderation.decide({ id: item!.id, action: "approve" });
    const published = await as(null).companies.bySlug({ slug: newSlug });
    expect(published.name).toBe(name);
    const mine = await as(learner).contributions.mine();
    expect(mine.proposals.some((p) => p.slug === newSlug)).toBe(true);
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, org!.id));
  });

  it("refuses a duplicate, by name or by alias, whatever the case", async () => {
    await expect(
      as(other).companies.propose({ name: `Acme ${run}`, cities: [] }),
    ).rejects.toThrow(/already in the bank/);
    await expect(
      as(other).companies.propose({ name: `ACME ${run}`, cities: [] }),
    ).rejects.toThrow(/already in the bank/);
    await expect(
      as(other).companies.propose({ name: `Acme Systems ${run}`, cities: [] }),
    ).rejects.toThrow(/already in the bank/);
  });

  it("treats LIKE metacharacters as text, not wildcards", async () => {
    // `%` matched every company while the check used `ilike`.
    const { slug: pctSlug } = await as(other).companies.propose({
      name: `% ${run}`,
      cities: [],
    });
    expect(pctSlug).toBeTruthy();
    const org = await db.query.organizations.findFirst({
      where: eq(schema.organizations.slug, pctSlug),
    });
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, org!.id));
  });
});

describe("admin facts", () => {
  it("edits facts, records the check, and never touches contributions", async () => {
    await as(admin).companies.adminUpdate({
      slug,
      industry: "Software consultancy",
      stack: ["TypeScript", "Go"],
      hiresJuniors: true,
      sources: ["https://acme.test/about"],
      aliases: [`Acme Systems ${run}`, `Acme Co ${run}`],
    });
    const company = await as(null).companies.bySlug({ slug });
    expect(company.industry).toBe("Software consultancy");
    expect(company.stack).toEqual(["TypeScript", "Go"]);
    expect(company.verifiedAt).toBeInstanceOf(Date);
    const aliases = await db.query.companyAliases.findMany({
      where: eq(schema.companyAliases.organizationId, orgId),
    });
    expect(aliases).toHaveLength(2);
    // The interview approved earlier is untouched by a facts edit.
    expect((await as(null).companies.interviews({ slug })).items).toHaveLength(
      1,
    );
  });

  it("keeps the verification record when a company is hidden", async () => {
    const profile = await db.query.companyProfiles.findFirst({
      where: eq(schema.companyProfiles.organizationId, orgId),
    });
    expect(profile!.verifiedAt).toBeInstanceOf(Date);
    const [item] = await db
      .insert(schema.moderationItems)
      .values({
        subjectType: "company_proposal",
        subjectId: orgId,
        status: "approved",
        payload: {
          kind: "company_proposal",
          data: { name: "Acme", cities: [] },
        },
      })
      .returning();
    await as(admin).moderation.decide({
      id: item!.id,
      action: "hide",
      reason: "Checking that hiding does not erase the check.",
    });
    const after = await db.query.companyProfiles.findFirst({
      where: eq(schema.companyProfiles.organizationId, orgId),
    });
    expect(after!.status).toBe("hidden");
    expect(after!.verifiedAt).toEqual(profile!.verifiedAt);
    // Put it back so the rest of the suite still has a published company.
    await as(admin).moderation.decide({ id: item!.id, action: "unhide" });
    const restored = await db.query.companyProfiles.findFirst({
      where: eq(schema.companyProfiles.organizationId, orgId),
    });
    expect(restored!.status).toBe("published");
    expect(restored!.verifiedBy).toBe(admin.id);
  });

  it("is closed to everyone but admins", async () => {
    await expect(
      as(mentor).companies.adminUpdate({ slug, industry: "Nope" }),
    ).rejects.toThrow(/Admins only/);
    await expect(as(learner).companies.adminList({})).rejects.toThrow(
      /Admins only/,
    );
  });
});
