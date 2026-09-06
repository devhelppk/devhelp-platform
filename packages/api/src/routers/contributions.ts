import { and, desc, eq, schema, sql } from "@repo/database";
import {
  interviewRoundsSchema,
  salarySnapshotSchema,
} from "@repo/database/schema";
import { latestUsdToPkr } from "@repo/database/fx";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  protectedProcedure,
  rateLimit,
  router,
  verifiedProcedure,
} from "../trpc";
import { companyIdBySlug } from "./companies";
import { SALARY_LEVELS } from "../levels";

const { companyReviews, interviewExperiences, organizations, salaryPoints } =
  schema;

type SalarySnapshot = z.infer<typeof salarySnapshotSchema>;

/** 1-5 on a sub-score is optional; the overall rating is not. */
const score = z.number().int().min(1).max(5);

/**
 * The columns an edit may clear. Drizzle drops `undefined` from an update, so
 * an omitted optional field would silently keep its old value; these are turned
 * into explicit nulls instead.
 */
const optionalReviewFields = [
  "learning",
  "management",
  "workLife",
  "compensation",
  "growth",
  "roleId",
  "roleText",
  "tenure",
  "cityId",
  "advice",
  "wouldRecommend",
] as const;

function nulled<T extends Record<string, unknown>>(
  values: T,
  fields: readonly string[],
) {
  const out: Record<string, unknown> = { ...values };
  for (const f of fields) if (out[f] === undefined) out[f] = null;
  return out as T;
}

/**
 * What we can say about a contributor without naming them. An email at the
 * company's own domain marks an employee; a Pakistani education domain marks a
 * student. The address itself is never stored on the contribution.
 */
async function affiliationFor(
  db: typeof import("@repo/database").db,
  userId: string,
  website: string | null,
): Promise<(typeof schema.affiliation.enumValues)[number]> {
  const me = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { email: true },
  });
  const domain = me?.email?.split("@")[1]?.toLowerCase();
  if (!domain) return "unverified";
  if (/\.edu(\.[a-z]{2})?$/.test(domain)) return "student";
  if (website) {
    try {
      const host = new URL(website).hostname
        .toLowerCase()
        .replace(/^www\./, "");
      if (domain === host || domain.endsWith(`.${host}`)) return "employee";
    } catch {
      // A malformed website is a facts problem, not a reason to fail a review.
    }
  }
  return "unverified";
}

/** The company's website, needed to judge an employee address. */
async function companyContext(
  db: typeof import("@repo/database").db,
  slug: string,
) {
  const id = await companyIdBySlug(db, slug);
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
    columns: { name: true, website: true, slug: true },
  });
  return {
    id,
    name: org?.name ?? slug,
    slug: org?.slug ?? slug,
    website: org?.website ?? null,
  };
}

/** Contributions are held until an admin publishes them (S10a). */
export const contributionsRouter = router({
  /** One review per person per company; re-submitting edits the existing one back into the queue. */
  submitReview: verifiedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        rating: score,
        learning: score.optional(),
        management: score.optional(),
        workLife: score.optional(),
        compensation: score.optional(),
        growth: score.optional(),
        roleId: z.uuid().optional(),
        roleText: z.string().trim().max(80).optional(),
        employmentStatus: z.enum(schema.employmentStatus.enumValues),
        tenure: z.enum(schema.tenureBand.enumValues).optional(),
        cityId: z.uuid().optional(),
        pros: z.string().trim().min(20).max(2000),
        cons: z.string().trim().min(20).max(2000),
        advice: z.string().trim().max(2000).optional(),
        wouldRecommend: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // `slug` names the company; everything else is a column.
      const { slug, ...values } = input;
      const company = await companyContext(ctx.db, slug);
      const affiliation = await affiliationFor(
        ctx.db,
        ctx.user.id,
        company.website,
      );
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `company:review:${ctx.user.id}`,
          5,
          24 * 60 * 60,
          "You can write five company reviews a day.",
        );
        const [row] = await tx
          .insert(companyReviews)
          .values({
            organizationId: company.id,
            authorId: ctx.user.id,
            affiliation,
            status: "pending",
            ...values,
          })
          .onConflictDoUpdate({
            target: [companyReviews.organizationId, companyReviews.authorId],
            set: {
              // Optional fields are nulled rather than dropped: Drizzle filters
              // `undefined` out of an update, so without this a reviewer could
              // never delete their advice or go back to "prefer not to say".
              ...nulled(values, optionalReviewFields),
              affiliation,
              // An edit goes back through moderation, but a review a moderator
              // hid or rejected is never republished by rewriting it; only a
              // decision moves it out of those states (same rule as S6).
              status: sql`case when ${companyReviews.status} in ('hidden', 'rejected') then ${companyReviews.status} else 'pending'::contribution_status end`,
              updatedAt: new Date(),
            },
          })
          .returning({ id: companyReviews.id, status: companyReviews.status });
        await queueItem(tx, {
          reopen: row!.status === "pending",
          subjectType: "company_review",
          subjectId: row!.id,
          userId: ctx.user.id,
          company,
          summary: `${input.rating}/5. Pros: ${input.pros}\n\nCons: ${input.cons}`,
          kind: "review",
        });
        return { id: row!.id };
      });
    }),

  /** An interview experience. Several per company are fine; they are different interviews. */
  submitInterview: verifiedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        roleId: z.uuid().optional(),
        roleText: z.string().trim().max(80).optional(),
        level: z.string().trim().max(40).optional(),
        yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        source: z.enum(schema.interviewSource.enumValues),
        rounds: interviewRoundsSchema,
        difficulty: score,
        durationDays: z.number().int().min(0).max(730).optional(),
        outcome: z.enum(schema.interviewOutcome.enumValues),
        questions: z.string().trim().max(4000).optional(),
        advice: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // `slug` names the company; everything else is a column.
      const { slug, ...values } = input;
      const company = await companyContext(ctx.db, slug);
      const affiliation = await affiliationFor(
        ctx.db,
        ctx.user.id,
        company.website,
      );
      const month = new Date(`${input.yearMonth}-01T00:00:00Z`);
      if (month.getTime() > Date.now())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That interview is in the future.",
        });
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `company:interview:${ctx.user.id}`,
          5,
          24 * 60 * 60,
          "You can add five interview experiences a day.",
        );
        const [row] = await tx
          .insert(interviewExperiences)
          .values({
            organizationId: company.id,
            authorId: ctx.user.id,
            affiliation,
            status: "pending",
            ...values,
          })
          .returning({ id: interviewExperiences.id });
        await queueItem(tx, {
          reopen: true,
          subjectType: "interview_experience",
          subjectId: row!.id,
          userId: ctx.user.id,
          company,
          summary: `${input.rounds.length} rounds, difficulty ${input.difficulty}/5, outcome ${input.outcome}.`,
          kind: "interview",
        });
        return { id: row!.id };
      });
    }),

  /**
   * A salary point (F2.6, F2.7, F2.11). Unlike the other contributions this
   * publishes at once and is marked unverified until an admin looks at it
   * (founder decision, S10b): there is no prose to moderate, and the views'
   * `n >= 5` floor means one point on its own is invisible regardless. The
   * queue item is opened all the same, so the admin record is identical.
   */
  submitSalary: verifiedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        roleId: z.uuid(),
        // A grouping key for `salary_stats_detail`, so it is a fixed list:
        // free text made "Senior", "senior", and "Sr" three separate cells,
        // none of which would ever reach five.
        level: z.enum(SALARY_LEVELS).optional(),
        yearsExperience: z.number().int().min(0).max(50).optional(),
        cityId: z.uuid().optional(),
        employmentType: z.enum(schema.employmentType.enumValues),
        /**
         * Whole currency units, as a person would write them. The minimum is 1,
         * not just positive: 0.004 would round to zero minor units, publish,
         * and drag the median down.
         */
        amount: z.number().min(1).max(50_000_000),
        currency: z.enum(schema.salaryCurrency.enumValues),
        period: z.enum(schema.salaryPeriod.enumValues),
        hasBonus: z.boolean().default(false),
        hasEquity: z.boolean().default(false),
        isRemote: z.boolean().default(false),
        year: z.number().int().min(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.year > new Date().getUTCFullYear())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That year has not happened yet.",
        });
      const company = await companyContext(ctx.db, input.slug);
      const [affiliation, fx, role] = await Promise.all([
        affiliationFor(ctx.db, ctx.user.id, company.website),
        input.currency === "USD" ? latestUsdToPkr(ctx.db) : null,
        ctx.db.query.jobRoles.findFirst({
          where: eq(schema.jobRoles.id, input.roleId),
          columns: { name: true },
        }),
      ]);
      if (!role)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown role." });
      const city = input.cityId
        ? await ctx.db.query.cities.findFirst({
            where: eq(schema.cities.id, input.cityId),
            columns: { name: true },
          })
        : null;
      if (input.cityId && !city)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown city." });
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `company:salary:${ctx.user.id}`,
          5,
          24 * 60 * 60,
          "You can add five salary points a day.",
        );
        const [row] = await tx
          .insert(salaryPoints)
          .values({
            organizationId: company.id,
            authorId: ctx.user.id,
            status: "published",
            roleId: input.roleId,
            roleText: role.name,
            level: input.level ?? null,
            yearsExperience: input.yearsExperience ?? null,
            cityId: input.cityId ?? null,
            employmentType: input.employmentType,
            // Minor units, so nothing is stored as a float.
            amountMinor: Math.round(input.amount * 100),
            currency: input.currency,
            period: input.period,
            fxRateToPkr: fx ? fx.rate.toFixed(4) : null,
            hasBonus: input.hasBonus,
            hasEquity: input.hasEquity,
            isRemote: input.isRemote,
            year: input.year,
            affiliation,
          })
          .onConflictDoUpdate({
            target: [salaryPoints.organizationId, salaryPoints.authorId],
            set: {
              roleId: input.roleId,
              roleText: role.name,
              level: input.level ?? null,
              yearsExperience: input.yearsExperience ?? null,
              cityId: input.cityId ?? null,
              employmentType: input.employmentType,
              amountMinor: Math.round(input.amount * 100),
              currency: input.currency,
              period: input.period,
              fxRateToPkr: fx ? fx.rate.toFixed(4) : null,
              hasBonus: input.hasBonus,
              hasEquity: input.hasEquity,
              isRemote: input.isRemote,
              year: input.year,
              affiliation,
              // An edit is unverified again, and a point an admin hid stays
              // hidden: only a decision moves it out of that state.
              verifiedAt: null,
              verifiedBy: null,
              status: sql`case when ${salaryPoints.status} in ('hidden', 'rejected') then ${salaryPoints.status} else 'published'::contribution_status end`,
              updatedAt: new Date(),
            },
          })
          .returning({ id: salaryPoints.id, status: salaryPoints.status });
        const amount = `${input.currency} ${input.amount.toLocaleString("en-GB")} / ${input.period === "yearly" ? "year" : "month"}`;
        await salaryQueueItem(tx, {
          reopen: row!.status === "published",
          subjectId: row!.id,
          userId: ctx.user.id,
          payload: {
            kind: "salary_point" as const,
            data: {
              companySlug: company.slug,
              companyName: company.name,
              role: role.name,
              level: input.level,
              city: city?.name,
              amount,
              year: input.year,
              yearsExperience: input.yearsExperience,
            },
          },
        });
        return { id: row!.id };
      });
    }),

  /** The caller's own contributions and where each stands. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const [reviews, interviews, proposals, salaries] = await Promise.all([
      ctx.db
        .select({
          id: companyReviews.id,
          status: companyReviews.status,
          rating: companyReviews.rating,
          createdAt: companyReviews.createdAt,
          companyName: organizations.name,
          companySlug: organizations.slug,
        })
        .from(companyReviews)
        .innerJoin(
          organizations,
          eq(organizations.id, companyReviews.organizationId),
        )
        .where(eq(companyReviews.authorId, ctx.user.id))
        .orderBy(desc(companyReviews.createdAt)),
      ctx.db
        .select({
          id: interviewExperiences.id,
          status: interviewExperiences.status,
          outcome: interviewExperiences.outcome,
          createdAt: interviewExperiences.createdAt,
          companyName: organizations.name,
          companySlug: organizations.slug,
        })
        .from(interviewExperiences)
        .innerJoin(
          organizations,
          eq(organizations.id, interviewExperiences.organizationId),
        )
        .where(eq(interviewExperiences.authorId, ctx.user.id))
        .orderBy(desc(interviewExperiences.createdAt)),
      ctx.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          status: schema.companyProfiles.status,
          createdAt: schema.companyProfiles.createdAt,
        })
        .from(schema.companyProfiles)
        .innerJoin(
          organizations,
          eq(organizations.id, schema.companyProfiles.organizationId),
        )
        .where(eq(schema.companyProfiles.proposedBy, ctx.user.id))
        .orderBy(desc(schema.companyProfiles.createdAt)),
      ctx.db
        .select({
          id: salaryPoints.id,
          status: salaryPoints.status,
          roleText: salaryPoints.roleText,
          // The one place an amount is read back from a row, and only ever the
          // caller's own: without it a contributor cannot tell whether what
          // they entered was right. The public path stays aggregates-only.
          amountMinor: salaryPoints.amountMinor,
          currency: salaryPoints.currency,
          period: salaryPoints.period,
          verifiedAt: salaryPoints.verifiedAt,
          createdAt: salaryPoints.createdAt,
          companyName: organizations.name,
          companySlug: organizations.slug,
        })
        .from(salaryPoints)
        .innerJoin(
          organizations,
          eq(organizations.id, salaryPoints.organizationId),
        )
        .where(eq(salaryPoints.authorId, ctx.user.id))
        .orderBy(desc(salaryPoints.createdAt)),
    ]);
    return { reviews, interviews, proposals, salaries };
  }),

  /** Whether the caller has already reviewed this company, for the form. */
  myReview: protectedProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const id = await companyIdBySlug(ctx.db, input.slug);
      const review = await ctx.db.query.companyReviews.findFirst({
        where: and(
          eq(companyReviews.organizationId, id),
          eq(companyReviews.authorId, ctx.user.id),
        ),
      });
      return { review: review ?? null };
    }),
});

/** A salary point's queue item. Same audit trail, different payload shape. */
async function salaryQueueItem(
  tx: Tx,
  args: {
    reopen: boolean;
    subjectId: string;
    userId: string;
    payload: { kind: "salary_point"; data: SalarySnapshot };
  },
) {
  const existing = await tx.query.moderationItems.findFirst({
    where: and(
      eq(schema.moderationItems.subjectType, "salary_point"),
      eq(schema.moderationItems.subjectId, args.subjectId),
    ),
    columns: { id: true },
  });
  if (existing && !args.reopen) return;
  if (existing)
    await tx
      .update(schema.moderationItems)
      .set({
        status: "pending",
        payload: args.payload,
        decidedAt: null,
        decidedBy: null,
        reason: null,
        policyClause: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.moderationItems.id, existing.id));
  else
    await tx.insert(schema.moderationItems).values({
      subjectType: "salary_point",
      subjectId: args.subjectId,
      submittedBy: args.userId,
      status: "pending",
      payload: args.payload,
    });
}

type Tx = Parameters<
  Parameters<typeof import("@repo/database").db.transaction>[0]
>[0];

/**
 * Every contribution gets a queue item in the same transaction as the row, with
 * no track: company items are admin-only, and `scope()` already hides
 * track-less items from mentors. Re-submitting reopens the existing item rather
 * than stacking a second one.
 */
async function queueItem(
  tx: Tx,
  args: {
    /** False when the subject stayed hidden or rejected: the decision stands. */
    reopen: boolean;
    subjectType: "company_review" | "interview_experience";
    subjectId: string;
    userId: string;
    company: { name: string; slug: string };
    summary: string;
    kind: "review" | "interview";
  },
) {
  const payload = {
    kind: "company_contribution" as const,
    data: {
      kind: args.kind,
      companySlug: args.company.slug,
      companyName: args.company.name,
      summary: args.summary.slice(0, 4000),
    },
  };
  const existing = await tx.query.moderationItems.findFirst({
    where: and(
      eq(schema.moderationItems.subjectType, args.subjectType),
      eq(schema.moderationItems.subjectId, args.subjectId),
    ),
    columns: { id: true },
  });
  if (existing && !args.reopen) return;
  if (existing)
    await tx
      .update(schema.moderationItems)
      .set({
        status: "pending",
        payload,
        decidedAt: null,
        decidedBy: null,
        reason: null,
        policyClause: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.moderationItems.id, existing.id));
  else
    await tx.insert(schema.moderationItems).values({
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      submittedBy: args.userId,
      status: "pending",
      payload,
    });
}
