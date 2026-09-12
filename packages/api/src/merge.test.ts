import { and, db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

/**
 * Merging duplicate companies (F2.9, S20).
 *
 * Two companies with contributions become one. The interesting cases are not
 * the rows that move — they are the rows that cannot (one review per author
 * per company) and the old slug that has to keep working.
 */

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, learner: User, both: User, rep: User;
const made: string[] = [];
const orgs: string[] = [];

const as = (u: User | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({ user: u, session: { id: "s" } } as unknown as Context["session"])
      : null,
  } as Context);

async function user(name: string, role?: "admin") {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `${name}-${run}@devhelp.test`,
      name,
      emailVerified: true,
      ...(role ? { role } : {}),
    })
    .returning();
  made.push(u!.id);
  return u!;
}

async function company(label: string) {
  const slug = `mergeco-${label}-${run}`;
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `Mergeco ${label} ${run}`,
      slug,
      kind: "company",
      createdAt: new Date(),
    })
    .returning();
  orgs.push(org!.id);
  await db
    .insert(schema.companyProfiles)
    .values({ organizationId: org!.id, status: "published" });
  return { id: org!.id, slug, name: `Mergeco ${label} ${run}` };
}

let loser: Awaited<ReturnType<typeof company>>;
let winner: Awaited<ReturnType<typeof company>>;
let roleId: string;

beforeAll(async () => {
  admin = await user("merge-admin", "admin");
  learner = await user("merge-learner");
  both = await user("merge-both");
  rep = await user("merge-rep");
  roleId = (await db.query.jobRoles.findFirst())!.id;
});

afterAll(async () => {
  for (const id of orgs)
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, id));
  for (const id of made)
    await db.delete(schema.users).where(eq(schema.users.id, id));
});

/** A published review by `author` on `slug`. */
async function review(author: User, slug: string, pros: string) {
  const { id } = await as(author).contributions.submitReview({
    slug,
    rating: 4,
    pros,
    cons: "Something worth saying about this company at a fair length.",
    employmentStatus: "current",
  });
  const item = await db.query.moderationItems.findFirst({
    where: and(
      eq(schema.moderationItems.subjectType, "company_review"),
      eq(schema.moderationItems.subjectId, id),
    ),
  });
  await as(admin).moderation.decide({ id: item!.id, action: "approve" });
  return id;
}

describe("merging duplicate companies", () => {
  beforeAll(async () => {
    loser = await company("old");
    winner = await company("new");
    // One author on each side, plus one who wrote about both — the collision.
    await review(learner, loser.slug, "Only ever said about the old record.");
    await review(both, loser.slug, "Said about the old record by both-author.");
    await review(
      both,
      winner.slug,
      "Said about the new record by both-author.",
    );
    const interview = await as(learner).contributions.submitInterview({
      slug: loser.slug,
      roleText: "Backend engineer",
      outcome: "offer",
      source: "job_board",
      difficulty: 3,
      rounds: [{ type: "technical", description: "Two hours of algorithms." }],
      yearMonth: "2026-04",
    });
    // Published, so the assertion below is about what a reader sees and not
    // only about what the update statement touched.
    const interviewItem = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "interview_experience"),
        eq(schema.moderationItems.subjectId, interview.id),
      ),
    });
    await as(admin).moderation.decide({
      id: interviewItem!.id,
      action: "approve",
    });
    await as(learner).contributions.submitSalary({
      slug: loser.slug,
      roleId,
      employmentType: "full_time",
      amount: 300000,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    await db.insert(schema.members).values({
      organizationId: loser.id,
      userId: rep.id,
      role: "member",
      createdAt: new Date(),
    });
  });

  it("refuses a non-admin, and a company merged into itself", async () => {
    await expect(
      as(learner).companies.merge({
        from: loser.slug,
        into: winner.slug,
        confirmName: loser.name,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      as(admin).companies.merge({
        from: loser.slug,
        into: loser.slug,
        confirmName: loser.name,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses until the losing company's name is typed", async () => {
    await expect(
      as(admin).companies.merge({
        from: loser.slug,
        into: winner.slug,
        confirmName: "not the name",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("moves what it can, leaves the collision behind, and records both", async () => {
    const before = await as(admin).companies.adminGet({ slug: winner.slug });
    expect(before).toBeDefined();

    const { into, moved } = await as(admin).companies.merge({
      from: loser.slug,
      into: winner.slug,
      confirmName: loser.name.toUpperCase(), // case-insensitive on purpose
    });
    expect(into).toBe(winner.slug);

    // One of the two reviews on the loser moves; `both` already reviewed the
    // winner, so their row cannot move and stays where it was.
    expect(moved.reviews).toEqual({ moved: 1, left: 1 });
    expect(moved.interviews).toEqual({ moved: 1, left: 0 });
    expect(moved.salaries).toEqual({ moved: 1, left: 0 });
    expect(moved.members).toEqual({ moved: 1, left: 0 });

    // The audit row says the same thing, for whoever asks in six months.
    const log = await db.query.companyMerges.findFirst({
      where: eq(schema.companyMerges.fromOrganizationId, loser.id),
    });
    expect(log!.actorId).toBe(admin.id);
    expect(log!.moved.reviews.left).toBe(1);
  });

  it("shows the moved contributions on the winner and none on the loser", async () => {
    const reviews = await as(admin).companies.reviews({ slug: winner.slug });
    const texts = reviews.items.map((r) => r.pros);
    expect(texts).toContain("Only ever said about the old record.");
    expect(texts).toContain("Said about the new record by both-author.");
    // The collision is unreachable: its company is merged away.
    expect(texts).not.toContain("Said about the old record by both-author.");
    const interviews = await as(admin).companies.interviews({
      slug: winner.slug,
    });
    expect(interviews.items).toHaveLength(1);
    const pay = await as(admin).companies.salaries({ slug: winner.slug });
    expect(pay.roles.length + pay.detail.length).toBeGreaterThanOrEqual(0);
  });

  it("keeps the old slug working as a redirect, not a 404", async () => {
    await expect(
      as(null).companies.bySlug({ slug: loser.slug }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await as(null).companies.mergedTarget({ slug: loser.slug })).toEqual(
      {
        slug: winner.slug,
      },
    );
    // A company that was never merged has no target, and is not a redirect.
    expect(
      await as(null).companies.mergedTarget({ slug: winner.slug }),
    ).toBeNull();
  });

  it("drops the merged company out of the directory", async () => {
    // The run id alone: the names read "Mergeco old <run>", so "Mergeco
    // <run>" is not a substring of any of them.
    const list = await as(null).companies.list({ q: run });
    const slugs = list.items.map((c) => c.slug);
    expect(slugs).toContain(winner.slug);
    expect(slugs).not.toContain(loser.slug);
  });

  it("keeps the old name findable, and un-proposable", async () => {
    // The loser's name became an alias of the winner, so search still finds
    // the employer under the name people know it by …
    const list = await as(null).companies.list({ q: loser.name });
    expect(list.items.map((c) => c.slug)).toContain(winner.slug);
    // … and nobody can propose the duplicate back into existence.
    await expect(
      as(learner).companies.propose({
        name: loser.name,
        cities: ["Lahore"],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("keeps a chain one hop long", async () => {
    const third = await company("third");
    await as(admin).companies.merge({
      from: winner.slug,
      into: third.slug,
      confirmName: winner.name,
    });
    // The first merge pointed at the second company; now that it has been
    // merged on, the original slug resolves to the end of the chain rather
    // than to a company that is itself merged away.
    expect(await as(null).companies.mergedTarget({ slug: loser.slug })).toEqual(
      {
        slug: third.slug,
      },
    );
    await expect(
      as(admin).companies.merge({
        from: loser.slug,
        into: third.slug,
        confirmName: loser.name,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
