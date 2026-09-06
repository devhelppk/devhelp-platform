CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'internship');--> statement-breakpoint
CREATE TYPE "public"."salary_currency" AS ENUM('PKR', 'USD');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('monthly', 'yearly');--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'salary_point';--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"base" "salary_currency" NOT NULL,
	"quote" "salary_currency" NOT NULL,
	"rate" numeric(12, 4) NOT NULL,
	"as_of" date NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_base_quote_as_of_pk" PRIMARY KEY("base","quote","as_of")
);
--> statement-breakpoint
CREATE TABLE "salary_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_id" uuid,
	"status" "contribution_status" DEFAULT 'published' NOT NULL,
	"role_id" uuid,
	"role_text" text,
	"level" text,
	"years_experience" smallint,
	"city_id" uuid,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "salary_currency" NOT NULL,
	"period" "salary_period" DEFAULT 'monthly' NOT NULL,
	"fx_rate_to_pkr" numeric(12, 4),
	"has_bonus" boolean DEFAULT false NOT NULL,
	"has_equity" boolean DEFAULT false NOT NULL,
	"is_remote" boolean DEFAULT false NOT NULL,
	"year" smallint NOT NULL,
	"affiliation" "affiliation" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"monthly_minor" bigint GENERATED ALWAYS AS (case when period = 'yearly' then amount_minor / 12 else amount_minor end) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salary_points" ADD CONSTRAINT "salary_points_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_points" ADD CONSTRAINT "salary_points_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_points" ADD CONSTRAINT "salary_points_role_id_job_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_points" ADD CONSTRAINT "salary_points_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_points" ADD CONSTRAINT "salary_points_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "salary_points_author_uidx" ON "salary_points" USING btree ("organization_id","author_id");--> statement-breakpoint
CREATE INDEX "salary_points_agg_idx" ON "salary_points" USING btree ("organization_id","status","role_id");--> statement-breakpoint
-- Salary aggregates.
--
-- Three things protect a contributor here, and only all three together.
--
-- 1. `having count(*) >= 5`: a cell needs five people before it exists at all.
--
-- 2. Rounding. `percentile_cont` interpolates at index p*(n-1), which at n = 5
--    lands exactly on the 2nd, 3rd and 4th sorted values: the quartiles would
--    otherwise be three of those five people's exact pay, and a colleague who
--    knew two of the five could read a third's salary off the page. Published
--    figures are rounded to a per-currency step, so what is shown is a band
--    rather than anybody's number.
--
-- 3. The middle half is withheld below n = 8. Publishing three order
--    statistics of five people says far more about those five than one does.
--
-- What none of this can do is stop someone who already knows four of five
-- salaries from narrowing the fifth. That is true of every aggregate; the floor
-- and the rounding are what keep it from being exact.
--
-- Percentiles are computed here rather than over fetched rows, so no
-- individual amount is ever sent to the application.
CREATE VIEW "salary_stats" AS
SELECT
  s.organization_id,
  s.role_id,
  s.currency,
  count(*)::int AS n,
  CASE WHEN count(*) >= 8 THEN round(
    percentile_cont(0.25) WITHIN GROUP (ORDER BY s.monthly_minor)
    / (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END)
  ) * (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END) END AS p25,
  round(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY s.monthly_minor)
    / (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END)
  ) * (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END) AS median,
  CASE WHEN count(*) >= 8 THEN round(
    percentile_cont(0.75) WITHIN GROUP (ORDER BY s.monthly_minor)
    / (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END)
  ) * (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END) END AS p75,
  min(s.year)::int AS first_year,
  max(s.year)::int AS last_year
FROM salary_points s
WHERE s.status = 'published'
  -- An internship and a staff job are different questions; mixing three
  -- interns with two engineers publishes the interns' median as the role's pay.
  AND s.employment_type <> 'internship'
  -- Pay from a decade ago is not what a reader is asking about.
  AND s.year >= extract(year from now())::int - 3
GROUP BY s.organization_id, s.role_id, s.currency
HAVING count(*) >= 5;--> statement-breakpoint
CREATE VIEW "salary_stats_detail" AS
SELECT
  s.organization_id,
  s.role_id,
  s.currency,
  s.level,
  s.city_id,
  count(*)::int AS n,
  CASE WHEN count(*) >= 8 THEN round(
    percentile_cont(0.25) WITHIN GROUP (ORDER BY s.monthly_minor)
    / (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END)
  ) * (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END) END AS p25,
  round(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY s.monthly_minor)
    / (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END)
  ) * (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END) AS median,
  CASE WHEN count(*) >= 8 THEN round(
    percentile_cont(0.75) WITHIN GROUP (ORDER BY s.monthly_minor)
    / (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END)
  ) * (CASE s.currency WHEN 'PKR' THEN 500000 ELSE 5000 END) END AS p75,
  min(s.year)::int AS first_year,
  max(s.year)::int AS last_year
FROM salary_points s
WHERE s.status = 'published'
  AND s.employment_type <> 'internship'
  AND s.year >= extract(year from now())::int - 3
GROUP BY s.organization_id, s.role_id, s.currency, s.level, s.city_id
HAVING count(*) >= 5;
