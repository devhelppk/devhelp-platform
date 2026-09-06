CREATE TYPE "public"."comment_kind" AS ENUM('question', 'note', 'answer');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'held', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."comment_subject" AS ENUM('lesson', 'course');--> statement-breakpoint
CREATE TYPE "public"."course_review_status" AS ENUM('visible', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."feedback_tag" AS ENUM('unclear', 'too_long', 'outdated', 'error', 'loved_it');--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'comment';--> statement-breakpoint
ALTER TYPE "public"."moderation_subject" ADD VALUE 'course_review';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'comment_reply';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'comment_accepted';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'lesson_question';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'comment_held';--> statement-breakpoint
CREATE TABLE "comment_votes" (
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_votes_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "comment_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid,
	"kind" "comment_kind" NOT NULL,
	"body" text NOT NULL,
	"body_html" text NOT NULL,
	"anchor" text,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"progress_at_review" smallint NOT NULL,
	"completed_at_review" integer DEFAULT 0 NOT NULL,
	"status" "course_review_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_feedback" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"tags" "feedback_tag"[] DEFAULT '{}' NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_feedback_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lesson_watchers" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_watchers_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "unclear_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "open_question_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_feedback" ADD CONSTRAINT "lesson_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_feedback" ADD CONSTRAINT "lesson_feedback_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_feedback" ADD CONSTRAINT "lesson_feedback_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_watchers" ADD CONSTRAINT "lesson_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_watchers" ADD CONSTRAINT "lesson_watchers_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_subject_idx" ON "comments" USING btree ("subject_type","subject_id","status","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_reviews_user_course_uidx" ON "course_reviews" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "course_reviews_course_idx" ON "course_reviews" USING btree ("course_id","status","created_at");--> statement-breakpoint
CREATE INDEX "lesson_feedback_lesson_idx" ON "lesson_feedback" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_watchers_lesson_idx" ON "lesson_watchers" USING btree ("lesson_id");