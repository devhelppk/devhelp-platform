CREATE TYPE "public"."affiliation" AS ENUM('unverified', 'student', 'employee');--> statement-breakpoint
CREATE TYPE "public"."company_size" AS ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+');--> statement-breakpoint
CREATE TYPE "public"."company_status" AS ENUM('pending', 'published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('pending', 'published', 'hidden', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('current', 'former', 'intern');--> statement-breakpoint
CREATE TYPE "public"."interview_outcome" AS ENUM('offer', 'rejected', 'withdrew', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."interview_source" AS ENUM('referral', 'job_board', 'campus', 'direct', 'other');--> statement-breakpoint
CREATE TYPE "public"."tenure_band" AS ENUM('under_1', '1_2', '3_5', '6_10', 'over_10');--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'company_proposal';--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'company_review';--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'interview_experience';--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"province" text
);
--> statement-breakpoint
CREATE TABLE "company_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"description" text,
	"industry" text,
	"size" "company_size",
	"cities" text[] DEFAULT '{}' NOT NULL,
	"founded" integer,
	"stack" text[] DEFAULT '{}' NOT NULL,
	"hires_juniors" boolean,
	"careers_url" text,
	"linkedin" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "company_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"proposed_by" uuid,
	"logo_key" text,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(industry, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_id" uuid,
	"status" "contribution_status" DEFAULT 'pending' NOT NULL,
	"rating" smallint NOT NULL,
	"learning" smallint,
	"management" smallint,
	"work_life" smallint,
	"compensation" smallint,
	"growth" smallint,
	"role_id" uuid,
	"role_text" text,
	"employment_status" "employment_status" NOT NULL,
	"tenure" "tenure_band",
	"city_id" uuid,
	"pros" text NOT NULL,
	"cons" text NOT NULL,
	"advice" text,
	"would_recommend" boolean,
	"affiliation" "affiliation" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_id" uuid,
	"status" "contribution_status" DEFAULT 'pending' NOT NULL,
	"role_id" uuid,
	"role_text" text,
	"level" text,
	"year_month" text NOT NULL,
	"source" "interview_source" NOT NULL,
	"rounds" jsonb NOT NULL,
	"difficulty" smallint NOT NULL,
	"duration_days" integer,
	"outcome" "interview_outcome" NOT NULL,
	"questions" text,
	"advice" text,
	"affiliation" "affiliation" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"family" text
);
--> statement-breakpoint
ALTER TABLE "company_aliases" ADD CONSTRAINT "company_aliases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_role_id_job_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_reviews" ADD CONSTRAINT "company_reviews_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_role_id_job_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."job_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_uidx" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "company_aliases_alias_uidx" ON "company_aliases" USING btree (lower("alias"));--> statement-breakpoint
CREATE INDEX "company_profiles_status_idx" ON "company_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "company_profiles_industry_idx" ON "company_profiles" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "company_profiles_search_idx" ON "company_profiles" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "company_reviews_author_uidx" ON "company_reviews" USING btree ("organization_id","author_id");--> statement-breakpoint
CREATE INDEX "company_reviews_public_idx" ON "company_reviews" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "interview_experiences_public_idx" ON "interview_experiences" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_roles_slug_uidx" ON "job_roles" USING btree ("slug");--> statement-breakpoint
-- Company aggregates. A plain view, not a materialised one: the numbers must be
-- right the moment a moderator publishes or hides a contribution, and the row
-- counts here are small. Only published rows count, so hiding a review stops it
-- affecting the average at once.
CREATE VIEW "company_stats" AS
SELECT
  o.id AS organization_id,
  count(r.id)::int AS review_count,
  round(avg(r.rating), 2) AS rating_avg,
  round(avg(r.learning), 2) AS learning_avg,
  round(avg(r.management), 2) AS management_avg,
  round(avg(r.work_life), 2) AS work_life_avg,
  round(avg(r.compensation), 2) AS compensation_avg,
  round(avg(r.growth), 2) AS growth_avg,
  round(
    100.0 * count(*) FILTER (WHERE r.would_recommend) /
    nullif(count(*) FILTER (WHERE r.would_recommend IS NOT NULL), 0)
  )::int AS recommend_pct,
  (
    SELECT count(*)::int FROM interview_experiences i
    WHERE i.organization_id = o.id AND i.status = 'published'
  ) AS interview_count,
  (
    SELECT round(avg(i.difficulty), 2) FROM interview_experiences i
    WHERE i.organization_id = o.id AND i.status = 'published'
  ) AS difficulty_avg,
  greatest(max(r.created_at), (
    SELECT max(i.created_at) FROM interview_experiences i
    WHERE i.organization_id = o.id AND i.status = 'published'
  )) AS last_contribution_at
FROM organizations o
LEFT JOIN company_reviews r
  ON r.organization_id = o.id AND r.status = 'published'
WHERE o.kind = 'company'
GROUP BY o.id;
--> statement-breakpoint
-- One organisation per company name. A dedupe check in the proposal router can
-- always be raced; this is what makes two simultaneous proposals for the same
-- employer impossible. Partial, so other organisation kinds are unaffected.
CREATE UNIQUE INDEX "organizations_company_name_uidx"
  ON "organizations" (lower("name")) WHERE "kind" = 'company';
