ALTER TABLE "exercise_submissions" ALTER COLUMN "runner" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DEFAULT 'browser'::text;--> statement-breakpoint
-- The in-house JS/TS runner was named after Sandpack, which it replaced in S4.
UPDATE "exercise_submissions" SET "runner" = 'browser' WHERE "runner" = 'sandpack';--> statement-breakpoint
UPDATE "exercises" SET "runner" = 'browser' WHERE "runner" = 'sandpack';--> statement-breakpoint
DROP TYPE "public"."exercise_runner";--> statement-breakpoint
CREATE TYPE "public"."exercise_runner" AS ENUM('browser');--> statement-breakpoint
ALTER TABLE "exercise_submissions" ALTER COLUMN "runner" SET DATA TYPE "public"."exercise_runner" USING "runner"::"public"."exercise_runner";--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DEFAULT 'browser'::"public"."exercise_runner";--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DATA TYPE "public"."exercise_runner" USING "runner"::"public"."exercise_runner";