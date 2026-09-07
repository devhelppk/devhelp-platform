import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  numeric,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import type { InterviewRounds } from "./json";

/**
 * Postgres `tsvector`. Drizzle has no built-in for it, and the column is
 * generated and never written from TypeScript, so the driver type is `never`.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

/**
 * The company bank (S10a). A company is an organisation (`kind = "company"`),
 * so an employer and an institution are one kind of row and claiming a profile
 * (S13) is ordinary membership. This table holds what a company page needs
 * beyond the organisation's name, slug, logo, city, and website.
 */
export const companySize = pgEnum("company_size", [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
]);
export const companyStatus = pgEnum("company_status", [
  "pending",
  "published",
  "hidden",
]);
/** Every user contribution moves through the same states. */
export const contributionStatus = pgEnum("contribution_status", [
  "pending",
  "published",
  "hidden",
  "rejected",
]);
export const employmentStatus = pgEnum("employment_status", [
  "current",
  "former",
  "intern",
]);
export const tenureBand = pgEnum("tenure_band", [
  "under_1",
  "1_2",
  "3_5",
  "6_10",
  "over_10",
]);
export const interviewSource = pgEnum("interview_source", [
  "referral",
  "job_board",
  "campus",
  "direct",
  "other",
]);
export const interviewOutcome = pgEnum("interview_outcome", [
  "offer",
  "rejected",
  "withdrew",
  "no_response",
]);
export const salaryCurrency = pgEnum("salary_currency", ["PKR", "USD"]);
export const salaryPeriod = pgEnum("salary_period", ["monthly", "yearly"]);
export const employmentType = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "internship",
]);
/**
 * How much we can say about the contributor without revealing them: an
 * education or company email domain earns a mark, the address is never stored.
 */
export const affiliation = pgEnum("affiliation", [
  "unverified",
  "student",
  "employee",
]);

export const companyProfiles = pgTable(
  "company_profiles",
  {
    organizationId: uuid()
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    description: text(),
    industry: text(),
    size: companySize(),
    cities: text().array().notNull().default([]),
    founded: integer(),
    stack: text().array().notNull().default([]),
    hiresJuniors: boolean(),
    careersUrl: text(),
    linkedin: text(),
    sources: jsonb().$type<string[]>().notNull().default([]),
    status: companyStatus().notNull().default("pending"),
    /** Set when an admin has checked the facts against a source. */
    verifiedAt: timestamp({ withTimezone: true }),
    verifiedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    proposedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    /** Storage key in R2; the organisation's `logo` column holds the URL. */
    logoKey: text(),
    /**
     * A logo fetched from the company's own website when nobody has uploaded
     * one. Cached in R2 rather than hot-linked, so a reader's browser never
     * talks to a third party. `faviconCheckedAt` records the attempt, failure
     * included, so a site without an icon is not re-fetched on every request.
     */
    faviconKey: text(),
    faviconCheckedAt: timestamp({ withTimezone: true }),
    /**
     * Free-text search over the prose only. `cities` and `stack` are left out
     * on purpose: `array_to_string` is stable rather than immutable, so
     * Postgres rejects it in a generated column, and both are filtered with
     * array operators anyway.
     */
    searchVector: tsvector().generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(industry, ''))`,
    ),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("company_profiles_status_idx").on(t.status),
    index("company_profiles_industry_idx").on(t.industry),
    index("company_profiles_search_idx").using("gin", t.searchVector),
  ],
);

/** Other names a company goes by; used for dedupe on proposal and for search. */
export const companyAliases = pgTable(
  "company_aliases",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    alias: text().notNull(),
  },
  (t) => [uniqueIndex("company_aliases_alias_uidx").on(sql`lower(${t.alias})`)],
);

/** Reference data so filters and aggregates group on something stable. */
export const cities = pgTable(
  "cities",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    province: text(),
  },
  (t) => [uniqueIndex("cities_slug_uidx").on(t.slug)],
);
export const jobRoles = pgTable(
  "job_roles",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    family: text(),
  },
  (t) => [uniqueIndex("job_roles_slug_uidx").on(t.slug)],
);

/**
 * A company review. `authorId` exists for the one-per-company rule and for
 * moderation; no public read may select it (see `reviewPublicColumns`), and
 * the month is what the page shows instead of a date.
 */
export const companyReviews = pgTable(
  "company_reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: contributionStatus().notNull().default("pending"),
    rating: smallint().notNull(),
    learning: smallint(),
    management: smallint(),
    workLife: smallint(),
    compensation: smallint(),
    growth: smallint(),
    roleId: uuid().references(() => jobRoles.id, { onDelete: "set null" }),
    roleText: text(),
    employmentStatus: employmentStatus().notNull(),
    tenure: tenureBand(),
    cityId: uuid().references(() => cities.id, { onDelete: "set null" }),
    pros: text().notNull(),
    cons: text().notNull(),
    advice: text(),
    wouldRecommend: boolean(),
    affiliation: affiliation().notNull().default("unverified"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("company_reviews_author_uidx").on(t.organizationId, t.authorId),
    index("company_reviews_public_idx").on(
      t.organizationId,
      t.status,
      t.createdAt,
    ),
  ],
);

export const interviewExperiences = pgTable(
  "interview_experiences",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: contributionStatus().notNull().default("pending"),
    roleId: uuid().references(() => jobRoles.id, { onDelete: "set null" }),
    roleText: text(),
    level: text(),
    /** When it happened, to the month: `YYYY-MM`. */
    yearMonth: text().notNull(),
    source: interviewSource().notNull(),
    rounds: jsonb().$type<InterviewRounds>().notNull(),
    difficulty: smallint().notNull(),
    durationDays: integer(),
    outcome: interviewOutcome().notNull(),
    questions: text(),
    advice: text(),
    affiliation: affiliation().notNull().default("unverified"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interview_experiences_public_idx").on(
      t.organizationId,
      t.status,
      t.createdAt,
    ),
  ],
);

/**
 * What one person was paid (S10b). Unlike a review this publishes immediately
 * and carries an `unverified` mark until an admin looks at it: there is no
 * prose to moderate, and the aggregation floor means a single point is never
 * visible on its own anyway. No procedure selects `amountMinor` from a row;
 * everything public comes from the two views below.
 */
export const salaryPoints = pgTable(
  "salary_points",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: contributionStatus().notNull().default("published"),
    roleId: uuid().references(() => jobRoles.id, { onDelete: "set null" }),
    roleText: text(),
    level: text(),
    yearsExperience: smallint(),
    cityId: uuid().references(() => cities.id, { onDelete: "set null" }),
    employmentType: employmentType().notNull().default("full_time"),
    /** Minor units (paisa, cents) so nothing is stored as a float. */
    amountMinor: bigint({ mode: "number" }).notNull(),
    currency: salaryCurrency().notNull(),
    period: salaryPeriod().notNull().default("monthly"),
    /**
     * The rate in force at submission. Nothing reads it yet: display uses the
     * current rate, because a reader comparing offers wants today's money. It
     * is recorded so that a later "what this was worth at the time" view is
     * possible without having lost the information.
     */
    fxRateToPkr: numeric({ precision: 12, scale: 4 }),
    hasBonus: boolean().notNull().default(false),
    hasEquity: boolean().notNull().default(false),
    isRemote: boolean().notNull().default(false),
    year: smallint().notNull(),
    affiliation: affiliation().notNull().default("unverified"),
    verifiedAt: timestamp({ withTimezone: true }),
    verifiedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    /**
     * A yearly figure as a month, so both periods aggregate together. Plain
     * arithmetic over this row's own columns, so it really is immutable.
     */
    monthlyMinor: bigint({ mode: "number" }).generatedAlwaysAs(
      sql`case when period = 'yearly' then amount_minor / 12 else amount_minor end`,
    ),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("salary_points_author_uidx").on(t.organizationId, t.authorId),
    index("salary_points_agg_idx").on(t.organizationId, t.status, t.roleId),
  ],
);

/**
 * Daily USD to PKR, written by `pnpm fx:refresh` and never fetched on a request
 * path. The primary key is the day, so re-running the script overwrites.
 */
export const fxRates = pgTable(
  "fx_rates",
  {
    base: salaryCurrency().notNull(),
    quote: salaryCurrency().notNull(),
    rate: numeric({ precision: 12, scale: 4 }).notNull(),
    asOf: date().notNull(),
    source: text().notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote, t.asOf] })],
);

/**
 * Salary aggregates per role and per currency, defined in migration 0014.
 *
 * Three rules protect a contributor, and only together: a cell needs five
 * people to exist, published figures are rounded to a per-currency step, and
 * the middle half is withheld below eight. The rounding is not cosmetic —
 * `percentile_cont` lands exactly on raw values at n = 5, so without it the
 * quartiles would be three of those five people's exact pay. See the migration
 * for the full reasoning, including what this cannot protect against.
 */
const salaryStatsColumns = {
  organizationId: uuid().notNull(),
  roleId: uuid(),
  currency: salaryCurrency().notNull(),
  n: integer().notNull(),
  /** Null below n = 8: three order statistics of five people say too much. */
  p25: doublePrecision(),
  median: doublePrecision(),
  p75: doublePrecision(),
  firstYear: integer(),
  lastYear: integer(),
} as const;

export const salaryStats = pgView(
  "salary_stats",
  salaryStatsColumns,
).existing();

/** The same, split by level and city. Same floor, applied per cell. */
export const salaryStatsDetail = pgView("salary_stats_detail", {
  ...salaryStatsColumns,
  level: text(),
  cityId: uuid(),
}).existing();

export const salaryPointsRelations = relations(salaryPoints, ({ one }) => ({
  organization: one(organizations, {
    fields: [salaryPoints.organizationId],
    references: [organizations.id],
  }),
  role: one(jobRoles, {
    fields: [salaryPoints.roleId],
    references: [jobRoles.id],
  }),
  city: one(cities, { fields: [salaryPoints.cityId], references: [cities.id] }),
}));

export const companyProfilesRelations = relations(
  companyProfiles,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [companyProfiles.organizationId],
      references: [organizations.id],
    }),
    aliases: many(companyAliases),
  }),
);
export const companyAliasesRelations = relations(companyAliases, ({ one }) => ({
  organization: one(organizations, {
    fields: [companyAliases.organizationId],
    references: [organizations.id],
  }),
}));
export const companyReviewsRelations = relations(companyReviews, ({ one }) => ({
  organization: one(organizations, {
    fields: [companyReviews.organizationId],
    references: [organizations.id],
  }),
  role: one(jobRoles, {
    fields: [companyReviews.roleId],
    references: [jobRoles.id],
  }),
  city: one(cities, {
    fields: [companyReviews.cityId],
    references: [cities.id],
  }),
}));
export const interviewExperiencesRelations = relations(
  interviewExperiences,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [interviewExperiences.organizationId],
      references: [organizations.id],
    }),
    role: one(jobRoles, {
      fields: [interviewExperiences.roleId],
      references: [jobRoles.id],
    }),
  }),
);

/**
 * Aggregates for a company, defined in migration 0013 and declared here as an
 * existing view so queries are typed. Plain, not materialised: a moderator's
 * decision must move the numbers immediately.
 */
export const companyStats = pgView("company_stats", {
  organizationId: uuid().notNull(),
  reviewCount: integer().notNull(),
  ratingAvg: numeric(),
  learningAvg: numeric(),
  managementAvg: numeric(),
  workLifeAvg: numeric(),
  compensationAvg: numeric(),
  growthAvg: numeric(),
  recommendPct: integer(),
  interviewCount: integer().notNull(),
  difficultyAvg: numeric(),
  lastContributionAt: timestamp({ withTimezone: true }),
}).existing();

/**
 * The month a contribution landed, in Asia/Karachi. Pages show a month rather
 * than a date so a contribution cannot be tied to a person by its timestamp.
 * It is computed here, not stored: `to_char` over a timestamptz is stable, not
 * immutable, so Postgres rejects it as a generated column.
 */
function createdMonthSql(column: AnyPgColumn) {
  return sql<string>`to_char(${column} AT TIME ZONE 'Asia/Karachi', 'YYYY-MM')`;
}

/** Public column sets: anonymity is the shape of the query, not a habit. */
export const reviewPublicColumns = {
  id: companyReviews.id,
  rating: companyReviews.rating,
  learning: companyReviews.learning,
  management: companyReviews.management,
  workLife: companyReviews.workLife,
  compensation: companyReviews.compensation,
  growth: companyReviews.growth,
  roleText: companyReviews.roleText,
  employmentStatus: companyReviews.employmentStatus,
  tenure: companyReviews.tenure,
  pros: companyReviews.pros,
  cons: companyReviews.cons,
  advice: companyReviews.advice,
  wouldRecommend: companyReviews.wouldRecommend,
  affiliation: companyReviews.affiliation,
  createdMonth: createdMonthSql(companyReviews.createdAt),
} as const;

export const interviewPublicColumns = {
  id: interviewExperiences.id,
  roleText: interviewExperiences.roleText,
  level: interviewExperiences.level,
  yearMonth: interviewExperiences.yearMonth,
  source: interviewExperiences.source,
  rounds: interviewExperiences.rounds,
  difficulty: interviewExperiences.difficulty,
  durationDays: interviewExperiences.durationDays,
  outcome: interviewExperiences.outcome,
  questions: interviewExperiences.questions,
  advice: interviewExperiences.advice,
  affiliation: interviewExperiences.affiliation,
  createdMonth: createdMonthSql(interviewExperiences.createdAt),
} as const;
