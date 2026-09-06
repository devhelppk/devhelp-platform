ALTER TYPE "public"."notification_kind" ADD VALUE 'badge_awarded';--> statement-breakpoint
CREATE TABLE "badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"rule" jsonb NOT NULL,
	"content_path" text,
	"content_hash" text,
	"content_revision_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"events" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_activity_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"awarded_by" uuid,
	"award_reason" text,
	"trigger_event_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"revoked_by" uuid,
	CONSTRAINT "user_badges_user_id_badge_id_pk" PRIMARY KEY("user_id","badge_id")
);
--> statement-breakpoint
ALTER TABLE "badges" ADD CONSTRAINT "badges_content_revision_id_content_revisions_id_fk" FOREIGN KEY ("content_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity" ADD CONSTRAINT "user_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_awarded_by_users_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_trigger_event_id_progress_events_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."progress_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badges_slug_uidx" ON "badges" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "user_activity_user_day_idx" ON "user_activity" USING btree ("user_id","day" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_badges_user_idx" ON "user_badges" USING btree ("user_id","awarded_at");