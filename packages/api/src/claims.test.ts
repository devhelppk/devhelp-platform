import { and, db, eq, schema } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Context } from "./context";
import { claimEvidence } from "./routers/claims";
import { createCaller } from "./root";

const run = crypto.randomUUID().slice(0, 8);
type User = typeof schema.users.$inferSelect;
let admin: User, insider: User, outsider: User, author: User;
let orgId: string, reviewId: string;
const slug = `claimco-${run}`;
const domain = `claimco-${run}.test`;
const made: string[] = [];

const as = (u: User | null) =>
  createCaller({
    db,
    headers: new Headers(),
    session: u
      ? ({ user: u, session: { id: "s" } } as unknown as Context["session"])
      : null,
  } as Context);

async function user(name: string, email?: string, role?: "admin") {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: email ?? `${name}-${run}@devhelp.test`,
      name,
      emailVerified: true,
      ...(role ? { role } : {}),
    })
    .returning();
  made.push(u!.id);
  return u!;
}

beforeAll(async () => {
  admin = await user("claim-admin", undefined, "admin");
  insider = await user("claim-insider", `rep-${run}@${domain}`);
  outsider = await user("claim-outsider");
  author = await user("claim-author");
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: `Claimco ${run}`,
      slug,
      kind: "company",
      website: `https://${domain}`,
      createdAt: new Date(),
    })
    .returning();
  orgId = org!.id;
  await db
    .insert(schema.companyProfiles)
    .values({ organizationId: orgId, status: "published" });
  // A published review to reply to.
  const { id } = await as(author).contributions.submitReview({
    slug,
    rating: 2,
    pros: "The people were kind and the onboarding was thorough enough.",
    cons: "Deadlines were set by someone who never wrote any of the code.",
    employmentStatus: "former",
  });
  reviewId = id;
  const item = await db.query.moderationItems.findFirst({
    where: and(
      eq(schema.moderationItems.subjectType, "company_review"),
      eq(schema.moderationItems.subjectId, id),
    ),
  });
  await as(admin).moderation.decide({ id: item!.id, action: "approve" });
  // A published interview too, as a second thing to reply to.
  const interview = await as(author).contributions.submitInterview({
    slug,
    yearMonth: "2026-05",
    source: "direct",
    rounds: [{ type: "technical", description: "One round on a shared call." }],
    difficulty: 3,
    outcome: "offer",
  });
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
});

afterAll(async () => {
  await db
    .delete(schema.organizations)
    .where(eq(schema.organizations.id, orgId));
  for (const id of made)
    await db.delete(schema.users).where(eq(schema.users.id, id));
});

describe("claim evidence", () => {
  it("matches a work email against the company's own domain", () => {
    expect(claimEvidence("a@acme.com", "https://acme.com").matched).toBe(true);
    expect(claimEvidence("a@acme.com", "https://www.acme.com").matched).toBe(
      true,
    );
    expect(claimEvidence("a@eng.acme.com", "https://acme.com").matched).toBe(
      true,
    );
  });

  it("does not match a free mail provider or a different company", () => {
    expect(claimEvidence("a@gmail.com", "https://acme.com").matched).toBe(
      false,
    );
    expect(claimEvidence("a@notacme.com", "https://acme.com").matched).toBe(
      false,
    );
    // A lookalike suffix must not pass: "evilacme.com" ends with "acme.com".
    expect(claimEvidence("a@evilacme.com", "https://acme.com").matched).toBe(
      false,
    );
  });

  it("records the evidence rather than refusing when there is no website", () => {
    const e = claimEvidence("a@acme.com", null);
    expect(e.matched).toBe(false);
    expect(e.companyDomain).toBeNull();
    expect(e.emailDomain).toBe("acme.com");
  });
});

describe("claiming a company", () => {
  it("records what was checked and reaches the queue", async () => {
    const { matched } = await as(insider).claims.request({
      slug,
      message: "I run engineering here.",
    });
    expect(matched).toBe(true);
    const claim = await db.query.companyClaims.findFirst({
      where: and(
        eq(schema.companyClaims.organizationId, orgId),
        eq(schema.companyClaims.userId, insider.id),
      ),
    });
    expect(claim!.status).toBe("pending");
    expect(claim!.evidence.matched).toBe(true);
    expect(claim!.evidence.companyDomain).toBe(domain);
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_claim"),
        eq(schema.moderationItems.subjectId, claim!.id),
      ),
    });
    expect(item?.status).toBe("pending");
    expect(item?.track).toBeNull();
  });

  it("takes a claim from somebody with no matching email, marked as such", async () => {
    const { matched } = await as(outsider).claims.request({ slug });
    expect(matched).toBe(false);
    const claim = await db.query.companyClaims.findFirst({
      where: and(
        eq(schema.companyClaims.organizationId, orgId),
        eq(schema.companyClaims.userId, outsider.id),
      ),
    });
    expect(claim!.evidence.matched).toBe(false);
  });

  it("makes the claimant a member when an admin approves", async () => {
    const claim = await db.query.companyClaims.findFirst({
      where: and(
        eq(schema.companyClaims.organizationId, orgId),
        eq(schema.companyClaims.userId, insider.id),
      ),
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_claim"),
        eq(schema.moderationItems.subjectId, claim!.id),
      ),
    });
    await as(admin).moderation.decide({ id: item!.id, action: "approve" });
    const member = await db.query.members.findFirst({
      where: and(
        eq(schema.members.organizationId, orgId),
        eq(schema.members.userId, insider.id),
      ),
    });
    expect(member).toBeDefined();
    // `member`, not `owner`: Better Auth's owner role could rename or delete
    // the organisation, which would cascade away every review about it.
    expect(member!.role).toBe("member");
    const after = await db.query.companyClaims.findFirst({
      where: eq(schema.companyClaims.id, claim!.id),
    });
    expect(after!.status).toBe("approved");
    expect(after!.decidedBy).toBe(admin.id);
  });

  it("leaves membership alone when a claim is rejected, and lets them try again", async () => {
    const claim = await db.query.companyClaims.findFirst({
      where: and(
        eq(schema.companyClaims.organizationId, orgId),
        eq(schema.companyClaims.userId, outsider.id),
      ),
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_claim"),
        eq(schema.moderationItems.subjectId, claim!.id),
      ),
    });
    await as(admin).moderation.decide({
      id: item!.id,
      action: "reject",
      reason: "No evidence you work there.",
    });
    expect(
      await db.query.members.findFirst({
        where: and(
          eq(schema.members.organizationId, orgId),
          eq(schema.members.userId, outsider.id),
        ),
      }),
    ).toBeUndefined();
    // Circumstances change; one rejection must not lock somebody out for ever.
    await as(outsider).claims.request({
      slug,
      message: "I have a work email now.",
    });
    const again = await db.query.companyClaims.findFirst({
      where: eq(schema.companyClaims.id, claim!.id),
    });
    expect(again!.status).toBe("pending");
    expect(again!.decidedAt).toBeNull();
  });

  it("takes representation back when an approved claim is hidden", async () => {
    // Without this there is no way to undo a wrong approval, and somebody who
    // has left the company keeps replying on its behalf for ever.
    const leaver = await user("claim-leaver", `leaver-${run}@${domain}`);
    await as(leaver).claims.request({ slug });
    const claim = await db.query.companyClaims.findFirst({
      where: and(
        eq(schema.companyClaims.organizationId, orgId),
        eq(schema.companyClaims.userId, leaver.id),
      ),
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_claim"),
        eq(schema.moderationItems.subjectId, claim!.id),
      ),
    });
    await as(admin).moderation.decide({ id: item!.id, action: "approve" });
    expect(
      await db.query.members.findFirst({
        where: and(
          eq(schema.members.organizationId, orgId),
          eq(schema.members.userId, leaver.id),
        ),
      }),
    ).toBeDefined();

    await as(admin).moderation.decide({
      id: item!.id,
      action: "hide",
      reason: "They have left the company.",
    });
    expect(
      await db.query.members.findFirst({
        where: and(
          eq(schema.members.organizationId, orgId),
          eq(schema.members.userId, leaver.id),
        ),
      }),
    ).toBeUndefined();
    await expect(as(leaver).claims.inbox({ slug })).rejects.toThrow(
      /represent this company/,
    );
  });

  it("refuses somebody who already represents the company", async () => {
    await expect(as(insider).claims.request({ slug })).rejects.toThrow(
      /already represent/,
    );
  });
});

/** The published interview experience, for a second reply target. */
async function interviewFor() {
  const row = await db.query.interviewExperiences.findFirst({
    where: and(
      eq(schema.interviewExperiences.organizationId, orgId),
      eq(schema.interviewExperiences.status, "published"),
    ),
  });
  return row!.id;
}

describe("public responses", () => {
  it("refuses anyone who does not represent the company", async () => {
    await expect(
      as(outsider).claims.respond({
        slug,
        subjectType: "company_review",
        subjectId: reviewId,
        body: "We disagree with this review and would like to say so here.",
      }),
    ).rejects.toThrow(/represent this company/);
    await expect(
      as(null).claims.respond({
        slug,
        subjectType: "company_review",
        subjectId: reviewId,
        body: "We disagree with this review and would like to say so here.",
      }),
    ).rejects.toThrow(/Sign in/);
  });

  it("holds a reply until an admin approves it, then shows it", async () => {
    const { id } = await as(insider).claims.respond({
      slug,
      subjectType: "company_review",
      subjectId: reviewId,
      body: "Thank you for this. **Deadlines** now come from the team that writes the code.",
    });
    expect(await as(null).companies.responses({ slug })).toHaveLength(0);
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_response"),
        eq(schema.moderationItems.subjectId, id),
      ),
    });
    await as(admin).moderation.decide({ id: item!.id, action: "approve" });
    const published = await as(null).companies.responses({ slug });
    expect(published).toHaveLength(1);
    expect(published[0]!.subjectId).toBe(reviewId);
    // Markdown is rendered on the server, as it is everywhere else.
    expect(published[0]!.bodyHtml).toContain("<strong>Deadlines</strong>");
    // Nothing identifies the person who wrote it.
    expect(JSON.stringify(published[0])).not.toContain(insider.id);
  });

  it("never republishes a reply an admin hid", async () => {
    const response = await db.query.companyResponses.findFirst({
      where: eq(schema.companyResponses.organizationId, orgId),
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_response"),
        eq(schema.moderationItems.subjectId, response!.id),
      ),
    });
    await as(admin).moderation.decide({
      id: item!.id,
      action: "hide",
      reason: "Names the reviewer.",
    });
    await as(insider).claims.respond({
      slug,
      subjectType: "company_review",
      subjectId: reviewId,
      body: "Trying again with the same words to get this back on the page.",
    });
    const row = await db.query.companyResponses.findFirst({
      where: eq(schema.companyResponses.id, response!.id),
    });
    expect(row!.status).toBe("hidden");
    expect(await as(null).companies.responses({ slug })).toHaveLength(0);
  });

  it("shows a moderator the text that will actually be published", async () => {
    // The bypass this closes: send something harmless, edit it to something
    // else before an admin looks, and approval publishes the edit while the
    // queue still showed the original.
    const target = interviewFor();
    await as(insider).claims.respond({
      slug,
      subjectType: "interview_experience",
      subjectId: await target,
      body: "A first, entirely harmless reply that an admin might well approve.",
    });
    await as(insider).claims.respond({
      slug,
      subjectType: "interview_experience",
      subjectId: await target,
      body: "A second, quite different reply written after the first was sent.",
    });
    const row = await db.query.companyResponses.findFirst({
      where: eq(schema.companyResponses.subjectId, await target),
    });
    const item = await db.query.moderationItems.findFirst({
      where: and(
        eq(schema.moderationItems.subjectType, "company_response"),
        eq(schema.moderationItems.subjectId, row!.id),
      ),
    });
    const payload = item!.payload as { data: { body: string } };
    expect(payload.data.body).toBe(row!.body);
    expect(payload.data.body).toContain("second");
  });

  it("freezes the text of a reply an admin hid, not only its status", async () => {
    const response = await db.query.companyResponses.findFirst({
      where: and(
        eq(schema.companyResponses.organizationId, orgId),
        eq(schema.companyResponses.status, "hidden"),
      ),
    });
    const before = response!.body;
    await as(insider).claims.respond({
      slug,
      subjectType: "company_review",
      subjectId: reviewId,
      body: "Words nobody has ever reviewed, slipped in behind a hidden status.",
    });
    const after = await db.query.companyResponses.findFirst({
      where: eq(schema.companyResponses.id, response!.id),
    });
    // Status *and* text stand: otherwise a later unhide publishes this.
    expect(after!.status).toBe("hidden");
    expect(after!.body).toBe(before);
  });

  it("refuses a reply to a post belonging to another company", async () => {
    const [other] = await db
      .insert(schema.organizations)
      .values({
        name: `Elsewhere ${run}`,
        slug: `elsewhere-${run}`,
        kind: "company",
        createdAt: new Date(),
      })
      .returning();
    await db
      .insert(schema.companyProfiles)
      .values({ organizationId: other!.id, status: "published" });
    await expect(
      as(insider).claims.respond({
        slug: `elsewhere-${run}`,
        subjectType: "company_review",
        subjectId: reviewId,
        body: "This review is about a different company entirely, so no.",
      }),
    ).rejects.toThrow(/represent this company/);
    await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, other!.id));
  });

  it("shows a representative their inbox and refuses everyone else", async () => {
    const inbox = await as(insider).claims.inbox({ slug });
    expect(inbox.reviews).toHaveLength(1);
    expect(inbox.interviews).toHaveLength(1);
    // A reply for each, keyed to the post it answers.
    expect(
      inbox.responses.some(
        (r) => r.subjectType === "company_review" && r.subjectId === reviewId,
      ),
    ).toBe(true);
    // The rendered form is there for display, the source for editing.
    expect(inbox.responses[0]!.bodyHtml).toContain("<p>");
    await expect(as(outsider).claims.inbox({ slug })).rejects.toThrow(
      /represent this company/,
    );
  });
});
