CREATE TYPE "public"."flag_reason" AS ENUM('names_individual', 'unverifiable', 'personal_data', 'spam', 'off_topic', 'other');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'upheld', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('submit', 'approve', 'reject', 'edit', 'merge', 'hide', 'unhide', 'flag', 'dismiss_flag', 'request_review');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected', 'hidden', 'merged');--> statement-breakpoint
CREATE TYPE "public"."moderation_subject" AS ENUM('mentor_application', 'company_review_request');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('mentor_application_decided', 'moderation_decided', 'org_invitation', 'role_changed');--> statement-breakpoint
CREATE TABLE "content_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "moderation_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"reporter_id" uuid,
	"reason" "flag_reason" NOT NULL,
	"details" text,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mentor_tracks" (
	"user_id" uuid NOT NULL,
	"track" "course_track" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentor_tracks_user_id_track_pk" PRIMARY KEY("user_id","track")
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" "moderation_action" NOT NULL,
	"reason" text,
	"policy_clause" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "moderation_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"track" "course_track",
	"submitted_by" uuid,
	"assigned_to" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"reason" text,
	"policy_clause" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_item_id_moderation_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."moderation_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_tracks" ADD CONSTRAINT "mentor_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_tracks" ADD CONSTRAINT "mentor_tracks_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_item_id_moderation_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."moderation_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_items" ADD CONSTRAINT "moderation_items_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_items" ADD CONSTRAINT "moderation_items_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_items" ADD CONSTRAINT "moderation_items_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_flags_subject_idx" ON "content_flags" USING btree ("subject_type","subject_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_flags_reporter_uidx" ON "content_flags" USING btree ("subject_type","subject_id","reporter_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_item_idx" ON "moderation_actions" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_items_subject_uidx" ON "moderation_items" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "moderation_items_queue_idx" ON "moderation_items" USING btree ("status","track","created_at");--> statement-breakpoint
CREATE INDEX "moderation_items_submitted_by_idx" ON "moderation_items" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_uidx" ON "notifications" USING btree ("user_id","dedupe_key");