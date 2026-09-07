CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'company_claim';--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'company_response';--> statement-breakpoint
CREATE TABLE "company_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"evidence" jsonb NOT NULL,
	"message" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"body_html" text NOT NULL,
	"status" "contribution_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_claims" ADD CONSTRAINT "company_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_claims" ADD CONSTRAINT "company_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_claims" ADD CONSTRAINT "company_claims_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_responses" ADD CONSTRAINT "company_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_responses" ADD CONSTRAINT "company_responses_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_claims_uidx" ON "company_claims" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "company_claims_status_idx" ON "company_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "company_responses_subject_uidx" ON "company_responses" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "company_responses_org_idx" ON "company_responses" USING btree ("organization_id","status");