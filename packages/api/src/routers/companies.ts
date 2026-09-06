import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  schema,
  sql,
} from "@repo/database";
import { companyProposalSchema } from "@repo/database/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
          if (aliases.length)
            await tx
              .insert(companyAliases)
              .values(
                aliases.map((alias) => ({ organizationId: org.id, alias })),
              )
              .onConflictDoNothing();
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
          reviewCount: companyStats.reviewCount,
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
