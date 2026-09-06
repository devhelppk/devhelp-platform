CREATE TYPE "public"."completion_rule" AS ENUM('view', 'quiz_pass', 'exercise_pass', 'submit');--> statement-breakpoint
CREATE TYPE "public"."lesson_mode" AS ENUM('foundation', 'industry');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('youtube');--> statement-breakpoint
CREATE TYPE "public"."exercise_runner" AS ENUM('sandpack', 'pyodide');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('single', 'multi', 'short');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."progress_event_kind" AS ENUM('course_enrolled', 'course_completed', 'course_dropped', 'lesson_started', 'lesson_progressed', 'lesson_completed', 'quiz_attempted', 'exercise_submitted', 'project_submitted');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
ALTER TYPE "public"."lesson_type" ADD VALUE 'project';--> statement-breakpoint
ALTER TYPE "public"."lesson_type" ADD VALUE 'link';--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo" text NOT NULL,
	"commit_sha" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text,
	"item_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_prerequisites" (
	"course_id" uuid NOT NULL,
	"prerequisite_id" uuid NOT NULL,
	CONSTRAINT "course_prerequisites_course_id_prerequisite_id_pk" PRIMARY KEY("course_id","prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "path_courses" (
	"path_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "path_courses_path_id_course_id_pk" PRIMARY KEY("path_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paths_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"runner" "exercise_runner" DEFAULT 'sandpack' NOT NULL,
	"language" text DEFAULT 'typescript' NOT NULL,
	"starter_files" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"test_files" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"instructions" text,
	"version" integer DEFAULT 1 NOT NULL,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_lessonId_unique" UNIQUE("lesson_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" "question_type" DEFAULT 'single' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" jsonb,
	"explanation" text,
	"points" smallint DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"pass_score" smallint DEFAULT 70 NOT NULL,
	"max_attempts" smallint,
	"shuffle" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quizzes_lessonId_unique" UNIQUE("lesson_id")
);
--> statement-breakpoint
CREATE TABLE "progress_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "progress_events_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"kind" "progress_event_kind" NOT NULL,
	"course_id" uuid,
	"lesson_id" uuid,
	"payload" jsonb,
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_progress" ALTER COLUMN "completed_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "lesson_progress" ALTER COLUMN "completed_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "estimated_hours" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "content_path" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "content_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "completion_criteria" jsonb DEFAULT '{"requireAllRequiredLessons":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "rating_avg" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "enrollment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "course_id" uuid;--> statement-breakpoint
UPDATE "lessons" l SET "course_id" = m."course_id" FROM "modules" m WHERE l."module_id" = m."id";--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "course_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "completion_rule" "completion_rule" DEFAULT 'view' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "mode" "lesson_mode" DEFAULT 'foundation' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "is_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_provider" "video_provider";--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "video_id" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "content_path" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "content_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "rating_avg" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "modules" SET "slug" = trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'));--> statement-breakpoint
ALTER TABLE "modules" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "status" "enrollment_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "progress_percent" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "last_lesson_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "dropped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "course_id" uuid;--> statement-breakpoint
UPDATE "lesson_progress" lp SET "course_id" = l."course_id" FROM "lessons" l WHERE lp."lesson_id" = l."id";--> statement-breakpoint
ALTER TABLE "lesson_progress" ALTER COLUMN "course_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "status" "progress_status" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "progress_percent" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "last_position_seconds" integer;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_id_courses_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_path_id_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_courses" ADD CONSTRAINT "path_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_events" ADD CONSTRAINT "progress_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_repo_sha_uidx" ON "content_revisions" USING btree ("repo","commit_sha");--> statement-breakpoint
CREATE INDEX "course_prerequisites_prerequisite_id_idx" ON "course_prerequisites" USING btree ("prerequisite_id");--> statement-breakpoint
CREATE INDEX "path_courses_course_id_idx" ON "path_courses" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "questions_quiz_id_idx" ON "questions" USING btree ("quiz_id");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_events_idempotency_key_uidx" ON "progress_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_events_seq_uidx" ON "progress_events" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "progress_events_user_seq_idx" ON "progress_events" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "progress_events_user_occurred_idx" ON "progress_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "progress_events_course_id_idx" ON "progress_events" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "progress_events_lesson_id_idx" ON "progress_events" USING btree ("lesson_id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_content_revision_id_content_revisions_id_fk" FOREIGN KEY ("content_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_revision_id_content_revisions_id_fk" FOREIGN KEY ("content_revision_id") REFERENCES "public"."content_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "modules_id_course_id_uidx" ON "modules" USING btree ("id","course_id");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_course_fk" FOREIGN KEY ("module_id","course_id") REFERENCES "public"."modules"("id","course_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_last_lesson_id_lessons_id_fk" FOREIGN KEY ("last_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_is_published_idx" ON "courses" USING btree ("is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_course_slug_uidx" ON "lessons" USING btree ("course_id","slug");--> statement-breakpoint
CREATE INDEX "lessons_module_id_idx" ON "lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "lessons_course_id_idx" ON "lessons" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "modules_course_slug_uidx" ON "modules" USING btree ("course_id","slug");--> statement-breakpoint
CREATE INDEX "modules_course_id_idx" ON "modules" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "enrollments_team_id_idx" ON "enrollments" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "enrollments_last_lesson_id_idx" ON "enrollments" USING btree ("last_lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_user_course_idx" ON "lesson_progress" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_lesson_id_idx" ON "lesson_progress" USING btree ("lesson_id");--> statement-breakpoint
ALTER TABLE "lessons" DROP COLUMN "content";--> statement-breakpoint
-- Backfill rows created under the placeholder schema (dev only; no production data predates this).
UPDATE "lesson_progress" SET "status" = 'completed', "progress_percent" = 100 WHERE "completed_at" IS NOT NULL;--> statement-breakpoint
UPDATE "enrollments" SET "status" = 'completed', "progress_percent" = 100 WHERE "completed_at" IS NOT NULL;
