import { and, db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, author: User, reader: User;
let orgId: string, roleId: string;
const slug = `flagco-${run}`;
const made: string[] = [];

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

beforeAll(async () => {
  admin = await user("flag-admin", "admin");
  author = await user("flag-author");
  reader = await user("flag-reader");
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `Flagco ${run}`,
      slug,
      kind: "company",
      createdAt: new Date(),
    })
    .returning();
  orgId = org!.id;
  await db
    .insert(schema.companyProfiles)
    .values({ organizationId: orgId, status: "published" });
  roleId = (await db.query.jobRoles.findFirst())!.id;
});

afterAll(async () => {
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, orgId));
  for (const id of made)
    await db.delete(schema.users).where(eq(schema.users.id, id));
});

/**
 * A published review with an approved item, the state a reader would see. Each
 * call uses a fresh author, because one person gets one review per company.
 */
let reviewSeq = 0;
async function publishedReview() {
  const writer = await user(`flag-writer-${(reviewSeq += 1)}`);
  const { id } = await as(writer).contributions.submitReview({
    slug,
    rating: 4,
    pros: "Something worth saying about this company at length.",
    cons: "Something else worth saying about this company at length.",
    employmentStatus: "current",
  });
  const item = await db.query.moderationItems.findFirst({
    where: and(
      eq(schema.moderationItems.subjectType, "company_review"),
      eq(schema.moderationItems.subjectId, id),
    ),
  });
  await as(admin).moderation.decide({ id: item!.id, action: "approve" });
  return { id, itemId: item!.id };
}

describe("flagging company contributions", () => {
  it("stores the reason the reader chose, then hides on an upheld flag", async () => {
    const { id } = await publishedReview();
    expect((await as(null).companies.reviews({ slug })).items).toHaveLength(1);
    await as(reader).moderation.flag({
      subjectType: "company_review",
      subjectId: id,
      reason: "names_individual",
      details: "It names the reporting manager.",
    });
    const flag = await db.query.contentFlags.findFirst({
      where: and(
        eq(schema.contentFlags.subjectType, "company_review"),
        eq(schema.contentFlags.subjectId, id),
      ),
    });
    // The reason is the one chosen, not a hard-coded default (the S6 bug).
    expect(flag!.reason).toBe("names_individual");
    expect(flag!.details).toContain("reporting manager");
    expect(flag!.status).toBe("open");

    await as(admin).moderation.resolveFlag({ id: flag!.id, outcome: "upheld" });
    const review = await db.query.companyReviews.findFirst({
      where: eq(schema.companyReviews.id, id),
    });
    expect(review!.status).toBe("hidden");
    expect((await as(null).companies.reviews({ slug })).items).toHaveLength(0);
  });

  it("flags an interview experience the same way", async () => {
    const { id } = await as(author).contributions.submitInterview({
      slug,
      yearMonth: "2026-02",
      source: "direct",
      rounds: [
        { type: "technical", description: "One coding round on a call." },
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
    await as(reader).moderation.flag({
      subjectType: "interview_experience",
      subjectId: id,
      reason: "personal_data",
    });
    const flag = await db.query.contentFlags.findFirst({
      where: eq(schema.contentFlags.subjectId, id),
    });
    expect(flag!.reason).toBe("personal_data");
    await as(admin).moderation.resolveFlag({ id: flag!.id, outcome: "upheld" });
    expect((await as(null).companies.interviews({ slug })).items).toHaveLength(
      0,
    );
  });

  it("hides a salary point whose item is still pending", async () => {
    // A salary point is public before review, so "approved" is the wrong test
    // for whether upholding a flag should hide it.
    const contributor = await user("flag-payer");
    const { id } = await as(contributor).contributions.submitSalary({
      slug,
      roleId,
      employmentType: "full_time",
      amount: 400_000,
      currency: "PKR",
      period: "monthly",
      year: 2026,
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "salary_point"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    expect(item!.status).toBe("pending");
    await as(reader).moderation.flag({
      subjectType: "salary_point",
      subjectId: id,
      reason: "unverifiable",
    });
    const flag = await db.query.contentFlags.findFirst({
      where: eq(schema.contentFlags.subjectId, id),
    });
    await as(admin).moderation.resolveFlag({ id: flag!.id, outcome: "upheld" });
    const point = await db.query.salaryPoints.findFirst({
      where: eq(schema.salaryPoints.id, id),
    });
    expect(point!.status).toBe("hidden");
  });

  it("takes one flag per reader per subject", async () => {
    const { id } = await publishedReview();
    const first = await as(reader).moderation.flag({
      subjectType: "company_review",
      subjectId: id,
      reason: "spam",
    });
    expect(first.duplicate).toBe(false);
    // A second flag is reported as a duplicate rather than refused, so a
    // double click does not look like an error to the reader.
    const second = await as(reader).moderation.flag({
      subjectType: "company_review",
      subjectId: id,
      reason: "spam",
    });
    expect(second.duplicate).toBe(true);
    const flags = await db.query.contentFlags.findMany({
      where: and(
        eq(schema.contentFlags.subjectType, "company_review"),
        eq(schema.contentFlags.subjectId, id),
      ),
    });
    expect(flags).toHaveLength(1);
  });
});

describe("reporting salary figures", () => {
  it("names the role and reaches the queue as an admin-only item", async () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const u = await user(`report-${n}`);
      await as(u).contributions.submitSalary({
        slug,
        roleId,
        employmentType: "full_time",
        amount: 150_000 + n * 1000,
        currency: "PKR",
        period: "monthly",
        year: 2026,
      });
    }
    const { id } = await as(reader).companies.reportSalaries({
      slug,
      roleId,
      currency: "PKR",
      details: "Nobody here is paid anything like this.",
    });
    const item = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.id, id),
    });
    expect(item!.subjectType).toBe("salary_report");
    expect(item!.subjectId).toBe(orgId);
    expect(item!.track).toBeNull();
    const payload = item!.payload as {
      kind: string;
      data: { role: string; n: number };
    };
    expect(payload.kind).toBe("salary_report");
    expect(payload.data.n).toBeGreaterThanOrEqual(5);
    expect(payload.data.role).toBeTruthy();
  });

  it("takes a second report on the same company instead of crashing", async () => {
    // `moderation_items` is unique on (subject type, subject id) and the
    // subject is the company, so a naive insert failed for everyone after the
    // first reporter — with a raw Postgres error in the reader's face.
    const second = await user("report-second");
    const again = await as(second).companies.reportSalaries({
      slug,
      roleId,
      currency: "PKR",
      details: "Agreed, this is nothing like what I was paid.",
    });
    expect(again.duplicate).toBe(false);
    const items = await db.query.moderationItems.findMany({
      where: and(
        eq(schema.moderationItems.subjectType, "salary_report"),
        eq(schema.moderationItems.subjectId, orgId),
      ),
    });
    expect(items).toHaveLength(1);
    // Each reporter is a flag on that one task.
    const flags = await db.query.contentFlags.findMany({
      where: and(
        eq(schema.contentFlags.subjectType, "salary_report"),
        eq(schema.contentFlags.subjectId, orgId),
      ),
    });
    expect(flags.length).toBeGreaterThanOrEqual(2);
    // The same person reporting twice is a duplicate, not a second flag.
    const dupe = await as(second).companies.reportSalaries({
      slug,
      roleId,
      currency: "PKR",
    });
    expect(dupe.duplicate).toBe(true);
  });

  it("reopens a decided report when somebody reports again", async () => {
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "salary_report"),
        eq(schema.moderationItems.subjectId, orgId),
      ),
    });
    await as(admin).moderation.decide({
      id: item!.id,
      action: "reject",
      reason: "The figures check out.",
    });
    const third = await user("report-third");
    await as(third).companies.reportSalaries({
      slug,
      roleId,
      currency: "PKR",
      details: "Reporting again after the last one was dismissed.",
    });
    const after = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.id, item!.id),
    });
    expect(after!.status).toBe("pending");
    expect(after!.decidedAt).toBeNull();
  });

  it("does not let one reporter reopen a report an admin closed", async () => {
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "salary_report"),
        eq(schema.moderationItems.subjectId, orgId),
      ),
    });
    await as(admin).moderation.decide({
      id: item!.id,
      action: "reject",
      reason: "Checked; the figures are right.",
    });
    // `reader` already reported this company earlier in the file.
    const again = await as(reader).companies.reportSalaries({
      slug,
      roleId,
      currency: "PKR",
    });
    expect(again.duplicate).toBe(true);
    const after = await db.query.moderationItems.findFirst({
      where: eq(schema.moderationItems.id, item!.id),
    });
    expect(after!.status).toBe("rejected");
  });

  it("refuses a role with no published figures", async () => {
    const other = await db.query.jobRoles.findMany({ limit: 2 });
    await expect(
      as(reader).companies.reportSalaries({
        slug,
        roleId: other[1]!.id,
        currency: "PKR",
      }),
    ).rejects.toThrow(/no published figures/i);
  });
});
