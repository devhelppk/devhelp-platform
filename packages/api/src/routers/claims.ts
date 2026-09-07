import { and, asc, desc, eq, schema, sql } from "@repo/database";
import { claimEvidenceSchema } from "@repo/database/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { renderMarkdown } from "../markdown";
import {
  protectedProcedure,
  rateLimit,
  router,
  verifiedProcedure,
} from "../trpc";
import { companyIdBySlug } from "./companies";

const { companyClaims, companyResponses, members, organizations, users } =
  schema;

/**
 * Claiming a company, and answering what is said about it (S13).
 *
 * S10a decided a company is a Better Auth organisation, which is what makes
 * this small: approving a claim adds a row to `members`, and from then on
 * membership is the only thing anything else has to ask about.
 */

/** The domain of an email address, lowercased. */
function domainOf(email: string) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/** The registrable host of a website, without `www.`. */
function hostOf(website: string | null) {
  if (!website) return null;
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * What we can say about whether this person works there. Deliberately not a
 * verdict: a company with no website on file, or a claimant on a free mail
 * provider, is not refused — an admin sees the evidence and decides.
 */
export function claimEvidence(email: string, website: string | null) {
  const emailDomain = domainOf(email);
  const companyDomain = hostOf(website);
  const matched =
    !!companyDomain &&
    !!emailDomain &&
    (emailDomain === companyDomain ||
      emailDomain.endsWith(`.${companyDomain}`));
  return claimEvidenceSchema.parse({ emailDomain, companyDomain, matched });
}

/** Is this person a member of that organisation? */
export async function isMember(
  db: typeof import("@repo/database").db,
  organizationId: string,
  userId: string,
) {
  const row = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.userId, userId),
    ),
    columns: { id: true },
  });
  return !!row;
}

export const claimsRouter = router({
  /** Ask to represent a company. The evidence is computed, not claimed. */
  request: verifiedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        message: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      const [company, me] = await Promise.all([
        ctx.db.query.organizations.findFirst({
          where: eq(organizations.id, org),
          columns: { name: true, slug: true, website: true },
        }),
        ctx.db.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
          columns: { email: true, name: true },
        }),
      ]);
      if (await isMember(ctx.db, org, ctx.user.id))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You already represent this company.",
        });
      const evidence = claimEvidence(me!.email, company?.website ?? null);
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `claim:${ctx.user.id}`,
          5,
          24 * 60 * 60,
          "You have sent several claims today. Try again tomorrow.",
        );
        const [claim] = await tx
          .insert(companyClaims)
          .values({
            organizationId: org,
            userId: ctx.user.id,
            evidence,
            message: input.message ?? null,
          })
          .onConflictDoUpdate({
            target: [companyClaims.organizationId, companyClaims.userId],
            // A rejected claim can be made again — circumstances change, and
            // the alternative is a person locked out by one admin decision.
            set: {
              status: "pending",
              evidence,
              message: input.message ?? null,
              decidedAt: null,
              decidedBy: null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: companyClaims.id, status: companyClaims.status });
        await tx
          .insert(schema.moderationItems)
          .values({
            subjectType: "company_claim",
            subjectId: claim!.id,
            submittedBy: ctx.user.id,
            status: "pending",
            payload: {
              kind: "company_claim",
              data: {
                companySlug: company?.slug ?? input.slug,
                companyName: company?.name ?? input.slug,
                claimantName: me?.name ?? "Someone",
                evidence,
                message: input.message,
              },
            },
          })
          .onConflictDoUpdate({
            target: [
              schema.moderationItems.subjectType,
              schema.moderationItems.subjectId,
            ],
            set: {
              status: "pending",
              // Fresh evidence and message: re-requesting usually means
              // something changed, and a previous rejection reason must not
              // hang off an item that is pending again.
              payload: {
                kind: "company_claim",
                data: {
                  companySlug: company?.slug ?? input.slug,
                  companyName: company?.name ?? input.slug,
                  claimantName: me?.name ?? "Someone",
                  evidence,
                  message: input.message,
                },
              },
              reason: null,
              policyClause: null,
              decidedAt: null,
              decidedBy: null,
              updatedAt: new Date(),
            },
          });
        return { id: claim!.id, matched: evidence.matched };
      });
    }),

  /** The caller's claims, and the companies they already represent. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const [claims, memberships] = await Promise.all([
      ctx.db
        .select({
          id: companyClaims.id,
          status: companyClaims.status,
          createdAt: companyClaims.createdAt,
          companyName: organizations.name,
          companySlug: organizations.slug,
        })
        .from(companyClaims)
        .innerJoin(
          organizations,
          eq(organizations.id, companyClaims.organizationId),
        )
        .where(eq(companyClaims.userId, ctx.user.id))
        .orderBy(desc(companyClaims.createdAt)),
      ctx.db
        .select({
          organizationId: members.organizationId,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(members)
        .innerJoin(organizations, eq(organizations.id, members.organizationId))
        .where(
          and(
            eq(members.userId, ctx.user.id),
            eq(organizations.kind, "company"),
          ),
        )
        .orderBy(asc(organizations.name)),
    ]);
    return { claims, memberships };
  }),

  /** What a representative sees: everything written about them, and their replies. */
  inbox: protectedProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      if (!(await isMember(ctx.db, org, ctx.user.id)))
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only people who represent this company can see this.",
        });
      const [reviews, interviews, responses] = await Promise.all([
        ctx.db
          .select(schema.reviewPublicColumns)
          .from(schema.companyReviews)
          .where(
            and(
              eq(schema.companyReviews.organizationId, org),
              eq(schema.companyReviews.status, "published"),
            ),
          )
          .orderBy(desc(schema.companyReviews.createdAt)),
        ctx.db
          .select(schema.interviewPublicColumns)
          .from(schema.interviewExperiences)
          .where(
            and(
              eq(schema.interviewExperiences.organizationId, org),
              eq(schema.interviewExperiences.status, "published"),
            ),
          )
          .orderBy(desc(schema.interviewExperiences.createdAt)),
        ctx.db
          .select({
            id: companyResponses.id,
            subjectType: companyResponses.subjectType,
            subjectId: companyResponses.subjectId,
            body: companyResponses.body,
            // Both: the rendered form is what a reader sees, the source is
            // what the author edits.
            bodyHtml: companyResponses.bodyHtml,
            status: companyResponses.status,
            updatedAt: companyResponses.updatedAt,
          })
          .from(companyResponses)
          .where(eq(companyResponses.organizationId, org)),
      ]);
      return { reviews, interviews, responses };
    }),

  /**
   * Answer one review or interview. A right of reply, queued like every other
   * contribution (founder decision, S13): it is prose about a named person's
   * experience, written by the party with the most reason to push back.
   */
  respond: verifiedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        subjectType: z.enum(["company_review", "interview_experience"]),
        subjectId: z.uuid(),
        body: z.string().trim().min(20).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      if (!(await isMember(ctx.db, org, ctx.user.id)))
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only people who represent this company can reply.",
        });
      // The post must exist, be published, and belong to this company —
      // otherwise a member could answer another company's reviews.
      const table =
        input.subjectType === "company_review"
          ? schema.companyReviews
          : schema.interviewExperiences;
      const [post] = await ctx.db
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            eq(table.id, input.subjectId),
            eq(table.organizationId, org),
            eq(table.status, "published"),
          ),
        )
        .limit(1);
      if (!post)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "There is nothing published to reply to.",
        });
      const company = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, org),
        columns: { name: true, slug: true },
      });
      const bodyHtml = renderMarkdown(input.body);
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `response:${ctx.user.id}`,
          20,
          24 * 60 * 60,
          "You have replied a lot today. Try again tomorrow.",
        );
        const [row] = await tx
          .insert(companyResponses)
          .values({
            organizationId: org,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            authorId: ctx.user.id,
            body: input.body,
            bodyHtml,
            status: "pending",
          })
          .onConflictDoUpdate({
            target: [companyResponses.subjectType, companyResponses.subjectId],
            set: {
              // A reply an admin hid or rejected is frozen: not only its
              // status but its text. Rewriting the body while the status
              // stayed `hidden` left never-reviewed words on the row, which a
              // later `unhide` would publish.
              body: sql`case when ${companyResponses.status} in ('hidden', 'rejected') then ${companyResponses.body} else ${input.body} end`,
              bodyHtml: sql`case when ${companyResponses.status} in ('hidden', 'rejected') then ${companyResponses.bodyHtml} else ${bodyHtml} end`,
              authorId: sql`case when ${companyResponses.status} in ('hidden', 'rejected') then ${companyResponses.authorId} else ${ctx.user.id}::uuid end`,
              status: sql`case when ${companyResponses.status} in ('hidden', 'rejected') then ${companyResponses.status} else 'pending'::contribution_status end`,
              updatedAt: new Date(),
            },
          })
          .returning({
            id: companyResponses.id,
            status: companyResponses.status,
          });
        if (row!.status === "pending")
          await tx
            .insert(schema.moderationItems)
            .values({
              subjectType: "company_response",
              subjectId: row!.id,
              submittedBy: ctx.user.id,
              status: "pending",
              payload: {
                kind: "company_response",
                data: {
                  companySlug: company?.slug ?? input.slug,
                  companyName: company?.name ?? input.slug,
                  respondingTo: input.subjectType,
                  body: input.body,
                },
              },
            })
            .onConflictDoUpdate({
              target: [
                schema.moderationItems.subjectType,
                schema.moderationItems.subjectId,
              ],
              set: {
                status: "pending",
                // The payload is what a moderator reads. Without refreshing it
                // an edit shows them the old, harmless text while the row
                // already holds the new — and approving publishes the new.
                payload: {
                  kind: "company_response",
                  data: {
                    companySlug: company?.slug ?? input.slug,
                    companyName: company?.name ?? input.slug,
                    respondingTo: input.subjectType,
                    body: input.body,
                  },
                },
                reason: null,
                policyClause: null,
                decidedAt: null,
                decidedBy: null,
                updatedAt: new Date(),
              },
            });
        return { id: row!.id };
      });
    }),
});
