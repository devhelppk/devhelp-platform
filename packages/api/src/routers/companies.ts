import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  schema,
  sql,
} from "@repo/database";
import { companyProposalSchema } from "@repo/database/schema";
import { latestUsdToPkr } from "@repo/database/fx";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { checkEligibility, requireBankAccess } from "../gate";
import {
  adminProcedure,
  publicProcedure,
  rateLimit,
  router,
  verifiedProcedure,
} from "../trpc";

const {
  companyAliases,
  companyProfiles,
  companyReviews,
  companyStats,
  interviewExperiences,
  organizations,
  salaryStats,
  salaryStatsDetail,
} = schema;

/** A URL-safe slug from a company name; collisions get a numeric suffix. */
function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Numbers arrive from Postgres `numeric` as strings; the client wants numbers. */
function num(v: string | number | null | undefined) {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const statsColumns = {
  reviewCount: companyStats.reviewCount,
  ratingAvg: companyStats.ratingAvg,
  learningAvg: companyStats.learningAvg,
  managementAvg: companyStats.managementAvg,
  workLifeAvg: companyStats.workLifeAvg,
  compensationAvg: companyStats.compensationAvg,
  growthAvg: companyStats.growthAvg,
  recommendPct: companyStats.recommendPct,
  interviewCount: companyStats.interviewCount,
  difficultyAvg: companyStats.difficultyAvg,
} as const;

type RawStats = { [K in keyof typeof statsColumns]: unknown };
function stats(r: RawStats) {
  return {
    reviewCount: Number(r.reviewCount ?? 0),
    interviewCount: Number(r.interviewCount ?? 0),
    ratingAvg: num(r.ratingAvg as string | null),
    learningAvg: num(r.learningAvg as string | null),
    managementAvg: num(r.managementAvg as string | null),
    workLifeAvg: num(r.workLifeAvg as string | null),
    compensationAvg: num(r.compensationAvg as string | null),
    growthAvg: num(r.growthAvg as string | null),
    recommendPct: num(r.recommendPct as number | null),
    difficultyAvg: num(r.difficultyAvg as string | null),
  };
}

/** Only published companies are public; a pending proposal is visible to nobody but the queue. */
const published = and(
  eq(organizations.kind, "company"),
  eq(companyProfiles.status, "published"),
);

export const companiesRouter = router({
  /** The directory (F10.1). Search is prose-only full text plus a name match; cities and stack are array filters. */
  list: publicProcedure
    .input(
      z.object({
        q: z.string().trim().max(100).optional(),
        city: z.string().trim().max(60).optional(),
        industry: z.string().trim().max(80).optional(),
        stack: z.string().trim().max(40).optional(),
        size: z.enum(schema.companySize.enumValues).optional(),
        hiresJuniors: z.boolean().optional(),
        sort: z.enum(["name", "rating", "reviews"]).default("name"),
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(24),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.q;
      const rows = await ctx.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logo: organizations.logo,
          markVersion: companyProfiles.updatedAt,
          city: organizations.city,
          industry: companyProfiles.industry,
          size: companyProfiles.size,
          cities: companyProfiles.cities,
          stack: companyProfiles.stack,
          hiresJuniors: companyProfiles.hiresJuniors,
          description: companyProfiles.description,
          ...statsColumns,
        })
        .from(organizations)
        .innerJoin(
          companyProfiles,
          eq(companyProfiles.organizationId, organizations.id),
        )
        .leftJoin(
          companyStats,
          eq(companyStats.organizationId, organizations.id),
        )
        .where(
          and(
            published,
            input.city
              ? arrayContains(companyProfiles.cities, [input.city])
              : undefined,
            input.stack
              ? arrayContains(companyProfiles.stack, [input.stack])
              : undefined,
            input.industry
              ? eq(companyProfiles.industry, input.industry)
              : undefined,
            input.size ? eq(companyProfiles.size, input.size) : undefined,
            input.hiresJuniors
              ? eq(companyProfiles.hiresJuniors, true)
              : undefined,
            q
              ? or(
                  ilike(organizations.name, `%${q}%`),
                  sql`${companyProfiles.searchVector} @@ plainto_tsquery('simple', ${q})`,
                  sql`exists (select 1 from ${companyAliases} a where a.organization_id = ${organizations.id} and a.alias ilike ${`%${q}%`})`,
                )
              : undefined,
          ),
        )
        .orderBy(
          input.sort === "rating"
            ? sql`${companyStats.ratingAvg} desc nulls last`
            : input.sort === "reviews"
              ? sql`${companyStats.reviewCount} desc nulls last`
              : asc(organizations.name),
          asc(organizations.name),
        )
        .limit(input.limit + 1)
        .offset(input.cursor);
      const page = rows.slice(0, input.limit);
      return {
        items: page.map(({ ...r }) => ({ ...r, ...stats(r) })),
        nextCursor:
          rows.length > input.limit ? input.cursor + input.limit : undefined,
      };
    }),

  /** Values the directory filters offer, taken from what is actually published. */
  filters: publicProcedure.query(async ({ ctx }) => {
    const [cityRows, industryRows, roleRows] = await Promise.all([
      ctx.db
        .select({ city: sql<string>`unnest(${companyProfiles.cities})` })
        .from(companyProfiles)
        .innerJoin(
          organizations,
          eq(companyProfiles.organizationId, organizations.id),
        )
        .where(published)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      ctx.db
        .selectDistinct({ industry: companyProfiles.industry })
        .from(companyProfiles)
        .innerJoin(
          organizations,
          eq(companyProfiles.organizationId, organizations.id),
        )
        .where(and(published, isNotNull(companyProfiles.industry)))
        .orderBy(asc(companyProfiles.industry)),
      ctx.db.query.jobRoles.findMany({
        orderBy: [asc(schema.jobRoles.name)],
        columns: { id: true, slug: true, name: true },
      }),
    ]);
    const cities = await ctx.db.query.cities.findMany({
      orderBy: [asc(schema.cities.name)],
      columns: { id: true, slug: true, name: true },
    });
    return {
      cities,
      cityNames: cityRows.map((r) => r.city).filter(Boolean),
      industries: industryRows.map((r) => r.industry!).filter(Boolean),
      roles: roleRows,
      sizes: schema.companySize.enumValues,
    };
  }),

  /** One company page (F10.2). Facts, aggregates, and nothing that identifies a contributor. */
  bySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          logo: organizations.logo,
          markVersion: companyProfiles.updatedAt,
          website: organizations.website,
          city: organizations.city,
          description: companyProfiles.description,
          industry: companyProfiles.industry,
          size: companyProfiles.size,
          cities: companyProfiles.cities,
          founded: companyProfiles.founded,
          stack: companyProfiles.stack,
          hiresJuniors: companyProfiles.hiresJuniors,
          careersUrl: companyProfiles.careersUrl,
          linkedin: companyProfiles.linkedin,
          sources: companyProfiles.sources,
          verifiedAt: companyProfiles.verifiedAt,
          ...statsColumns,
        })
        .from(organizations)
        .innerJoin(
          companyProfiles,
          eq(companyProfiles.organizationId, organizations.id),
        )
        .leftJoin(
          companyStats,
          eq(companyStats.organizationId, organizations.id),
        )
        .where(and(published, eq(organizations.slug, input.slug)))
        .limit(1);
      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "No such company." });
      return { ...row, ...stats(row) };
    }),

  /**
   * May this viewer read contributed content about this company (S15 part B)?
   *
   * The page asks this *before* it fetches anything gated, because a page that
   * fetched the rows and then rendered a wall would still ship every review in
   * its RSC payload. Returning only a verdict leaks nothing: the reasons are
   * facts about the viewer, which the viewer already knows.
   */
  eligibility: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    // Written out structurally rather than as `Promise<Eligibility>`: the app's
    // `useTRPC` infers the whole router, and a named type from a module the app
    // cannot import by path is TS2883 ("cannot be named without a reference").
    .query(
      async ({
        ctx,
        input,
      }): Promise<
        | {
            allowed: true;
            reason: "role" | "member" | "contributor" | "bank_cold";
          }
        | {
            allowed: false;
            reason: "signed_out" | "needs_verification" | "needs_contribution";
          }
      > => {
        const org = await companyIdBySlug(ctx.db, input.slug);
        const viewer = ctx.session
          ? ((await ctx.db.query.users.findFirst({
              where: eq(schema.users.id, ctx.session.user.id),
              columns: { id: true, role: true, emailVerified: true },
            })) ?? null)
          : null;
        return checkEligibility(ctx.db, viewer, org);
      },
    ),

  /** Published reviews for a company. The author column is never selected. */
  reviews: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      await requireBankAccess(ctx.db, ctx.session, org);
      const rows = await ctx.db
        .select(schema.reviewPublicColumns)
        .from(companyReviews)
        .where(
          and(
            eq(companyReviews.organizationId, org),
            eq(companyReviews.status, "published"),
          ),
        )
        .orderBy(desc(companyReviews.createdAt))
        .limit(input.limit + 1)
        .offset(input.cursor);
      const page = rows.slice(0, input.limit);
      return {
        items: page,
        nextCursor:
          rows.length > input.limit ? input.cursor + input.limit : undefined,
      };
    }),

  /**
   * A company's published replies, keyed by the post they answer, so the page
   * can render each under its review or interview in one round trip.
   */
  responses: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      await requireBankAccess(ctx.db, ctx.session, org);
      return ctx.db
        .select(schema.responsePublicColumns)
        .from(schema.companyResponses)
        .where(
          and(
            eq(schema.companyResponses.organizationId, org),
            eq(schema.companyResponses.status, "published"),
          ),
        );
    }),

  /** Published interview experiences for a company. */
  interviews: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      await requireBankAccess(ctx.db, ctx.session, org);
      const rows = await ctx.db
        .select(schema.interviewPublicColumns)
        .from(interviewExperiences)
        .where(
          and(
            eq(interviewExperiences.organizationId, org),
            eq(interviewExperiences.status, "published"),
          ),
        )
        .orderBy(desc(interviewExperiences.createdAt))
        .limit(input.limit + 1)
        .offset(input.cursor);
      const page = rows.slice(0, input.limit);
      return {
        items: page,
        nextCursor:
          rows.length > input.limit ? input.cursor + input.limit : undefined,
      };
    }),

  /**
   * Pay for one company (F2.6, F2.7). Everything comes from the two views,
   * which apply the floor, the rounding, and the n >= 8 rule for the middle
   * half; this procedure cannot reach a salary row even by mistake. The page
   * gets the role rows, the finer cells that cleared the floor, and the latest
   * rate, so it can render the whole fallback hierarchy in one round trip.
   */
  salaries: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      await requireBankAccess(ctx.db, ctx.session, org);
      const [roles, detail, fx] = await Promise.all([
        ctx.db
          .select({
            roleId: salaryStats.roleId,
            roleName: schema.jobRoles.name,
            currency: salaryStats.currency,
            n: salaryStats.n,
            p25: salaryStats.p25,
            median: salaryStats.median,
            p75: salaryStats.p75,
            firstYear: salaryStats.firstYear,
            lastYear: salaryStats.lastYear,
          })
          .from(salaryStats)
          .leftJoin(schema.jobRoles, eq(schema.jobRoles.id, salaryStats.roleId))
          .where(eq(salaryStats.organizationId, org))
          .orderBy(asc(schema.jobRoles.name), asc(salaryStats.currency)),
        ctx.db
          .select({
            roleId: salaryStatsDetail.roleId,
            currency: salaryStatsDetail.currency,
            level: salaryStatsDetail.level,
            cityId: salaryStatsDetail.cityId,
            cityName: schema.cities.name,
            n: salaryStatsDetail.n,
            p25: salaryStatsDetail.p25,
            median: salaryStatsDetail.median,
            p75: salaryStatsDetail.p75,
            firstYear: salaryStatsDetail.firstYear,
            lastYear: salaryStatsDetail.lastYear,
          })
          .from(salaryStatsDetail)
          .leftJoin(
            schema.cities,
            eq(schema.cities.id, salaryStatsDetail.cityId),
          )
          .where(eq(salaryStatsDetail.organizationId, org))
          .orderBy(asc(salaryStatsDetail.level), asc(schema.cities.name)),
        latestUsdToPkr(ctx.db),
      ]);
      return { roles, detail, fx };
    }),

  /**
   * Report that a role's published salary figures look wrong (S10c). The
   * subject is the company, not a salary point: an individual figure is never
   * shown, so a reader cannot point at one. The payload names the role, and an
   * admin — who can see every point — decides which ones to act on. Upholding
   * this hides nothing by itself; there is no single row it refers to.
   */
  reportSalaries: verifiedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        roleId: z.uuid().nullable(),
        currency: z.enum(schema.salaryCurrency.enumValues),
        details: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await companyIdBySlug(ctx.db, input.slug);
      const [company, role, row] = await Promise.all([
        ctx.db.query.organizations.findFirst({
          where: eq(organizations.id, org),
          columns: { name: true, slug: true },
        }),
        input.roleId
          ? ctx.db.query.jobRoles.findFirst({
              where: eq(schema.jobRoles.id, input.roleId),
              columns: { name: true },
            })
          : null,
        ctx.db
          .select({ n: salaryStats.n, median: salaryStats.median })
          .from(salaryStats)
          .where(
            and(
              eq(salaryStats.organizationId, org),
              eq(salaryStats.currency, input.currency),
              input.roleId
                ? eq(salaryStats.roleId, input.roleId)
                : isNull(salaryStats.roleId),
            ),
          )
          .limit(1),
      ]);
      const stats = row[0];
      if (!stats)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "There are no published figures for that role.",
        });
      return ctx.db.transaction(async (tx) => {
        await rateLimit(
          tx,
          `company:salary-report:${ctx.user.id}`,
          10,
          24 * 60 * 60,
          "You have reported a lot of figures today. Try again tomorrow.",
        );
        const payload = {
          kind: "salary_report" as const,
          data: {
            companySlug: company?.slug ?? input.slug,
            companyName: company?.name ?? input.slug,
            role: role?.name ?? "Other",
            currency: input.currency,
            median: stats.median ?? undefined,
            n: stats.n,
          },
        };
        // Whether this reporter has already spoken decides everything below:
        // a repeat must not reopen a report an admin has closed, or one person
        // could bounce it back into the queue as often as the rate limit lets
        // them while being told it was a duplicate.
        const already = await tx.query.contentFlags.findFirst({
          where: and(
            eq(schema.contentFlags.subjectType, "salary_report"),
            eq(schema.contentFlags.subjectId, org),
            eq(schema.contentFlags.reporterId, ctx.user.id),
          ),
          columns: { id: true },
        });
        if (already) {
          const open = await tx.query.moderationItems.findFirst({
            where: and(
              eq(schema.moderationItems.subjectType, "salary_report"),
              eq(schema.moderationItems.subjectId, org),
            ),
            columns: { id: true },
          });
          return { id: open!.id, duplicate: true };
        }
        // `moderation_items` is unique on (subject type, subject id), and the
        // subject here is the company, so there is one standing task per
        // company rather than one per report. A new reporter reopens it; the
        // reporters themselves are the `content_flags` rows below.
        const [item] = await tx
          .insert(schema.moderationItems)
          .values({
            subjectType: "salary_report",
            subjectId: org,
            submittedBy: ctx.user.id,
            status: "pending",
            reason: input.details ?? null,
            payload,
          })
          .onConflictDoUpdate({
            target: [
              schema.moderationItems.subjectType,
              schema.moderationItems.subjectId,
            ],
            set: {
              status: "pending",
              payload,
              reason: input.details ?? null,
              decidedAt: null,
              decidedBy: null,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.moderationItems.id });
        const [flag] = await tx
          .insert(schema.contentFlags)
          .values({
            subjectType: "salary_report",
            subjectId: org,
            reporterId: ctx.user.id,
            reason: "unverifiable",
            details: input.details ?? null,
            itemId: item!.id,
          })
          .onConflictDoNothing()
          .returning({ id: schema.contentFlags.id });
        return { id: item!.id, duplicate: !flag };
      });
    }),

  /**
   * Propose a company that is not in the bank yet (F10.4). It is created
   * pending and invisible, with a moderation item admins decide. Rows are
   * written directly rather than through the organisation plugin's endpoint,
   * so `allowUserToCreateOrganization` stays restricted to mentors and admins.
   */
  propose: verifiedProcedure
    .input(companyProposalSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        // Inside the transaction, and compared with `lower(...) = ...` rather
        // than `ilike`: a name containing `%` or `_` would otherwise match
        // half the bank, and a check outside the transaction lets two
        // simultaneous proposals for one employer both through. The partial
        // unique index on `lower(name)` (migration 0013) is the real guard.
        const lower = input.name.toLowerCase();
        const existing = await tx
          .select({ slug: organizations.slug })
          .from(organizations)
          .leftJoin(
            companyAliases,
            eq(companyAliases.organizationId, organizations.id),
          )
          .where(
            and(
              eq(organizations.kind, "company"),
              or(
                sql`lower(${organizations.name}) = ${lower}`,
                sql`lower(${companyAliases.alias}) = ${lower}`,
              ),
            ),
          )
          .limit(1);
        if (existing[0])
          throw new TRPCError({
            code: "CONFLICT",
            message: `That company is already in the bank: /companies/${existing[0].slug}`,
          });
        await rateLimit(
          tx,
          `company:propose:${ctx.user.id}`,
          3,
          24 * 60 * 60,
          "You can propose three companies a day.",
        );
        const now = new Date();
        const slug = await freeSlug(tx, slugify(input.name));
        const [org] = await tx
          .insert(organizations)
          .values({
            name: input.name,
            slug,
            kind: "company",
            city: input.cities[0] ?? null,
            website: input.website ?? null,
            createdAt: now,
          })
          .returning({ id: organizations.id })
          .catch((e: unknown) => {
            // Drizzle wraps the driver error, so the SQLSTATE is on the cause.
            const code = (e as { cause?: { code?: string } })?.cause?.code;
            if (code === "23505")
              throw new TRPCError({
                code: "CONFLICT",
                message: "That company is already in the bank.",
              });
            throw e;
          });
        await tx.insert(companyProfiles).values({
          organizationId: org!.id,
          description: input.description ?? null,
          industry: input.industry ?? null,
          cities: input.cities,
          proposedBy: ctx.user.id,
          status: "pending",
        });
        await tx.insert(schema.moderationItems).values({
          subjectType: "company_proposal",
          subjectId: org!.id,
          submittedBy: ctx.user.id,
          status: "pending",
          payload: { kind: "company_proposal", data: input },
        });
        return { slug };
      });
    }),

  /** Admin fact editing (F10.3). Contributions are never touched here. */
  adminUpdate: adminProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        name: z.string().trim().min(2).max(100).optional(),
        website: z.url({ protocol: /^https?$/ }).nullish(),
        description: z.string().trim().max(500).nullish(),
        industry: z.string().trim().max(80).nullish(),
        size: z.enum(schema.companySize.enumValues).nullish(),
        cities: z.array(z.string().trim().min(2)).max(10).optional(),
        founded: z.number().int().min(1900).max(2100).nullish(),
        stack: z.array(z.string().trim().min(1)).max(30).optional(),
        hiresJuniors: z.boolean().nullish(),
        careersUrl: z.url({ protocol: /^https?$/ }).nullish(),
        linkedin: z.url({ protocol: /^https?$/ }).nullish(),
        sources: z
          .array(z.url({ protocol: /^https?$/ }))
          .max(10)
          .optional(),
        status: z.enum(schema.companyStatus.enumValues).optional(),
        aliases: z.array(z.string().trim().min(2).max(100)).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { slug, name, website, aliases, ...facts } = input;
      return ctx.db.transaction(async (tx) => {
        const org = await tx.query.organizations.findFirst({
          where: and(
            eq(organizations.slug, slug),
            eq(organizations.kind, "company"),
          ),
          columns: { id: true },
        });
        if (!org)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No such company.",
          });
        if (name !== undefined || website !== undefined)
          await tx
            .update(organizations)
            .set({
              ...(name !== undefined ? { name } : {}),
              ...(website !== undefined ? { website: website ?? null } : {}),
            })
            .where(eq(organizations.id, org.id));
        const now = new Date();
        await tx
          .update(companyProfiles)
          .set({
            ...facts,
            updatedAt: now,
            // Editing the facts is the verification: record who and when.
            verifiedAt: now,
            verifiedBy: ctx.user.id,
          })
          .where(eq(companyProfiles.organizationId, org.id));
        if (aliases) {
          await tx
            .delete(companyAliases)
            .where(eq(companyAliases.organizationId, org.id));
          if (aliases.length) {
            const inserted = await tx
              .insert(companyAliases)
              .values(
                aliases.map((alias) => ({ organizationId: org.id, alias })),
              )
              .onConflictDoNothing()
              .returning({ alias: companyAliases.alias });
            // Aliases are unique across the bank. Silently dropping one an
            // admin typed leaves them staring at a saved form missing a value.
            if (inserted.length !== aliases.length) {
              const kept = new Set(inserted.map((a) => a.alias.toLowerCase()));
              const taken = aliases.filter((a) => !kept.has(a.toLowerCase()));
              throw new TRPCError({
                code: "CONFLICT",
                message: `Another company already goes by ${taken.join(", ")}.`,
              });
            }
          }
        }
        return { ok: true };
      });
    }),

  /** Every company, whatever its status, for the admin list. */
  adminList: adminProcedure
    .input(
      z.object({
        q: z.string().trim().max(100).optional(),
        status: z.enum(schema.companyStatus.enumValues).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) =>
      ctx.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          status: companyProfiles.status,
          industry: companyProfiles.industry,
          verifiedAt: companyProfiles.verifiedAt,
          createdAt: companyProfiles.createdAt,
          // Enough to act on without opening the row (S18): how much is
          // written about this company, and where it went if it was merged.
          reviewCount: companyStats.reviewCount,
          interviewCount: companyStats.interviewCount,
          mergedIntoId: companyProfiles.mergedIntoId,
        })
        .from(organizations)
        .innerJoin(
          companyProfiles,
          eq(companyProfiles.organizationId, organizations.id),
        )
        .leftJoin(
          companyStats,
          eq(companyStats.organizationId, organizations.id),
        )
        .where(
          and(
            eq(organizations.kind, "company"),
            input.status ? eq(companyProfiles.status, input.status) : undefined,
            input.q ? ilike(organizations.name, `%${input.q}%`) : undefined,
          ),
        )
        .orderBy(asc(companyProfiles.status), asc(organizations.name))
        .limit(input.limit),
    ),

  /** Everything an admin needs to edit, published or not. */
  adminGet: adminProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          website: organizations.website,
          profile: companyProfiles,
        })
        .from(organizations)
        .innerJoin(
          companyProfiles,
          eq(companyProfiles.organizationId, organizations.id),
        )
        .where(
          and(
            eq(organizations.slug, input.slug),
            eq(organizations.kind, "company"),
          ),
        )
        .limit(1);
      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "No such company." });
      const aliases = await ctx.db.query.companyAliases.findMany({
        where: eq(companyAliases.organizationId, row.id),
        columns: { alias: true },
      });
      return { ...row, aliases: aliases.map((a) => a.alias) };
    }),

  /**
   * Where a merged company went, for the page's redirect (F2.9).
   *
   * Public, and it says nothing a merged company's own slug did not already
   * say: this employer is now filed under that name.
   */
  mergedTarget: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }): Promise<{ slug: string } | null> => {
      const [row] = await ctx.db
        .select({ slug: sql<string>`winner.slug` })
        .from(organizations)
        .innerJoin(
          companyProfiles,
          eq(companyProfiles.organizationId, organizations.id),
        )
        .innerJoin(
          sql`${organizations} as winner`,
          sql`winner.id = ${companyProfiles.mergedIntoId}`,
        )
        .where(
          and(
            eq(organizations.slug, input.slug),
            eq(organizations.kind, "company"),
            eq(companyProfiles.status, "merged"),
          ),
        )
        .limit(1);
      return row ? { slug: row.slug } : null;
    }),

  /**
   * Merge a duplicate company into another (F2.9).
   *
   * Duplicates exist because `propose` dedupes on an exact name or alias, so
   * "X Systems Ltd" and "X Systems Limited" are two companies until a person
   * notices. By then both may carry reviews, interviews and pay.
   *
   * The losing company is **not deleted**. Deleting an organisation cascades
   * away every review, interview and salary point about it (the same reason
   * S13 refuses to grant `owner` on a claim), and a merge is a filing decision,
   * not a reason to destroy what people wrote. It becomes `status = 'merged'`
   * with a pointer to the winner, which keeps its slug resolving as a redirect
   * and holds anything that could not move.
   *
   * What cannot move: one person gets one review per company, and one salary
   * point, and one membership. If the same author wrote about both companies,
   * moving the row would violate that unique index. Founder decision: those
   * rows stay on the merged company, unreachable, rather than being deleted or
   * having a moderation status applied to them by a decision no moderator made.
   * `company_merges.moved` records how many stayed, per table.
   */
  merge: adminProcedure
    .input(
      z.object({
        from: z.string().min(1),
        into: z.string().min(1),
        /** Typed by the admin to confirm; checked against the real name. */
        confirmName: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.from === input.into)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A company cannot be merged into itself.",
        });
      return ctx.db.transaction(async (tx) => {
        const ends = await tx
          .select({
            id: organizations.id,
            slug: organizations.slug,
            name: organizations.name,
            status: companyProfiles.status,
          })
          .from(organizations)
          .innerJoin(
            companyProfiles,
            eq(companyProfiles.organizationId, organizations.id),
          )
          .where(
            and(
              eq(organizations.kind, "company"),
              inArray(organizations.slug, [input.from, input.into]),
            ),
          );
        const loser = ends.find((e) => e.slug === input.from);
        const winner = ends.find((e) => e.slug === input.into);
        if (!loser || !winner)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One of those companies does not exist.",
          });
        if (loser.status === "merged" || winner.status === "merged")
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "One of those companies has already been merged away.",
          });
        // The typed name is the guard against merging the wrong way round,
        // which is not undoable through this API.
        if (input.confirmName.trim().toLowerCase() !== loser.name.toLowerCase())
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Type "${loser.name}" to confirm the merge.`,
          });

        /**
         * Each table moves the same way: re-point every row that will not
         * collide, then count what is left behind. The `not exists` restates
         * the unique index on purpose — Postgres would raise 23505 for those
         * rows, and a raised 23505 aborts the whole transaction, leaving
         * nothing to report to the admin who asked for the merge.
         *
         * Written out per table rather than through one generic helper: the
         * three tables have different row types, and a helper wide enough to
         * take all of them is wide enough to take the wrong column with it.
         */
        const movedReviews = await tx
          .update(companyReviews)
          .set({ organizationId: winner.id })
          .where(
            and(
              eq(companyReviews.organizationId, loser.id),
              sql`not exists (select 1 from ${companyReviews} other where other.organization_id = ${winner.id} and other.author_id = ${companyReviews.authorId})`,
            ),
          )
          .returning({ id: companyReviews.id });
        const [leftReviews] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(companyReviews)
          .where(eq(companyReviews.organizationId, loser.id));

        const movedInterviews = await tx
          .update(interviewExperiences)
          .set({ organizationId: winner.id })
          .where(
            and(
              eq(interviewExperiences.organizationId, loser.id),
              sql`not exists (select 1 from ${interviewExperiences} other where other.organization_id = ${winner.id} and other.author_id = ${interviewExperiences.authorId})`,
            ),
          )
          .returning({ id: interviewExperiences.id });
        const [leftInterviews] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(interviewExperiences)
          .where(eq(interviewExperiences.organizationId, loser.id));

        const movedSalaries = await tx
          .update(schema.salaryPoints)
          .set({ organizationId: winner.id })
          .where(
            and(
              eq(schema.salaryPoints.organizationId, loser.id),
              sql`not exists (select 1 from ${schema.salaryPoints} other where other.organization_id = ${winner.id} and other.author_id = ${schema.salaryPoints.authorId})`,
            ),
          )
          .returning({ id: schema.salaryPoints.id });
        const [leftSalaries] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.salaryPoints)
          .where(eq(schema.salaryPoints.organizationId, loser.id));

        // Responses and claims carry no one-per-author rule, so everything
        // moves: a reply belongs to the post it answers, and the posts moved.
        const movedResponses = await tx
          .update(schema.companyResponses)
          .set({ organizationId: winner.id })
          .where(eq(schema.companyResponses.organizationId, loser.id))
          .returning({ id: schema.companyResponses.id });
        const movedClaims = await tx
          .update(schema.companyClaims)
          .set({ organizationId: winner.id })
          .where(eq(schema.companyClaims.organizationId, loser.id))
          .returning({ id: schema.companyClaims.id });

        // Membership is what representation means (S13), so it moves — unless
        // the person already represents the winner.
        const movedMembers = await tx
          .update(schema.members)
          .set({ organizationId: winner.id })
          .where(
            and(
              eq(schema.members.organizationId, loser.id),
              sql`not exists (select 1 from ${schema.members} other where other.organization_id = ${winner.id} and other.user_id = ${schema.members.userId})`,
            ),
          )
          .returning({ id: schema.members.id });
        const [leftMembers] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.members)
          .where(eq(schema.members.organizationId, loser.id));

        // Aliases are unique on `lower(alias)` alone, so re-pointing them can
        // never collide; and the loser's own name becomes an alias of the
        // winner, so the name people know still finds the company in search
        // and still trips `propose`'s dedupe.
        const movedAliases = await tx
          .update(companyAliases)
          .set({ organizationId: winner.id })
          .where(eq(companyAliases.organizationId, loser.id))
          .returning({ id: companyAliases.id });
        await tx
          .insert(companyAliases)
          .values({ organizationId: winner.id, alias: loser.name })
          .onConflictDoNothing();

        await tx
          .update(companyProfiles)
          .set({
            status: "merged",
            mergedIntoId: winner.id,
            updatedAt: new Date(),
          })
          .where(eq(companyProfiles.organizationId, loser.id));
        // A chain stays one hop: anything that pointed at the loser now points
        // at the winner, so the page never follows a pointer twice.
        await tx
          .update(companyProfiles)
          .set({ mergedIntoId: winner.id })
          .where(eq(companyProfiles.mergedIntoId, loser.id));

        const moved = {
          reviews: { moved: movedReviews.length, left: leftReviews?.n ?? 0 },
          interviews: {
            moved: movedInterviews.length,
            left: leftInterviews?.n ?? 0,
          },
          salaries: { moved: movedSalaries.length, left: leftSalaries?.n ?? 0 },
          responses: { moved: movedResponses.length, left: 0 },
          claims: { moved: movedClaims.length, left: 0 },
          members: { moved: movedMembers.length, left: leftMembers?.n ?? 0 },
          aliases: { moved: movedAliases.length, left: 0 },
        };
        schema.mergeCountsSchema.parse(moved);
        await tx.insert(schema.companyMerges).values({
          fromOrganizationId: loser.id,
          intoOrganizationId: winner.id,
          actorId: ctx.user.id,
          moved,
        });
        return { into: winner.slug, moved };
      });
    }),
});

type Db = typeof import("@repo/database").db;
type AnyDb = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Resolve a published company slug to its organisation id. */
export async function companyIdBySlug(db: AnyDb, slug: string) {
  const [row] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .innerJoin(
      companyProfiles,
      eq(companyProfiles.organizationId, organizations.id),
    )
    .where(and(published, eq(organizations.slug, slug)))
    .limit(1);
  if (!row)
    throw new TRPCError({ code: "NOT_FOUND", message: "No such company." });
  return row.id;
}

/** A slug nobody is using yet. Organisation slugs are global, not company-only. */
async function freeSlug(db: AnyDb, base: string) {
  const candidate = base || "company";
  const taken = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(
      or(
        eq(organizations.slug, candidate),
        ilike(organizations.slug, `${candidate}-%`),
      ),
    );
  if (!taken.some((t) => t.slug === candidate)) return candidate;
  for (let i = 2; i < 200; i++)
    if (!taken.some((t) => t.slug === `${candidate}-${i}`))
      return `${candidate}-${i}`;
  throw new TRPCError({
    code: "CONFLICT",
    message: "Could not allocate a slug for that name.",
  });
}
