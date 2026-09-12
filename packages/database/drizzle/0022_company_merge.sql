ALTER TYPE "public"."company_status" ADD VALUE 'merged';--> statement-breakpoint
CREATE TABLE "company_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_organization_id" uuid NOT NULL,
	"into_organization_id" uuid NOT NULL,
	"actor_id" uuid,
	"moved" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "company_merges" ADD CONSTRAINT "company_merges_from_organization_id_organizations_id_fk" FOREIGN KEY ("from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_merges" ADD CONSTRAINT "company_merges_into_organization_id_organizations_id_fk" FOREIGN KEY ("into_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_merges" ADD CONSTRAINT "company_merges_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_merges_into_idx" ON "company_merges" USING btree ("into_organization_id","created_at");--> statement-breakpoint
CREATE INDEX "company_merges_from_idx" ON "company_merges" USING btree ("from_organization_id");--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_merged_into_id_organizations_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;