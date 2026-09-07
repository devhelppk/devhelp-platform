CREATE TYPE "public"."content_subject" AS ENUM('course', 'module', 'lesson');--> statement-breakpoint
CREATE TYPE "public"."credit_role" AS ENUM('author', 'reviewer');--> statement-breakpoint
CREATE TABLE "content_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "content_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "credit_role" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "content_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"actor_id" uuid,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "needs_metadata" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "needs_metadata" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content_credits" ADD CONSTRAINT "content_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_edits" ADD CONSTRAINT "content_edits_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_credits_uidx" ON "content_credits" USING btree ("subject_type","subject_id","user_id","role");--> statement-breakpoint
CREATE INDEX "content_credits_subject_idx" ON "content_credits" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "content_credits_user_idx" ON "content_credits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_edits_subject_idx" ON "content_edits" USING btree ("subject_type","subject_id","created_at");