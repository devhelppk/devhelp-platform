CREATE TABLE "exercise_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"files" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"passed" boolean NOT NULL,
	"runner" "exercise_runner" NOT NULL,
	"exercise_version" integer NOT NULL,
	"duration_ms" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"score" smallint NOT NULL,
	"passed" boolean NOT NULL,
	"quiz_version" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_submissions_user_exercise_attempt_uidx" ON "exercise_submissions" USING btree ("user_id","exercise_id","attempt");--> statement-breakpoint
CREATE INDEX "exercise_submissions_user_lesson_idx" ON "exercise_submissions" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_user_quiz_attempt_uidx" ON "quiz_attempts" USING btree ("user_id","quiz_id","attempt");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_lesson_idx" ON "quiz_attempts" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_course_idx" ON "quiz_attempts" USING btree ("user_id","course_id");