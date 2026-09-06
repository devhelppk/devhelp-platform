ALTER TABLE "exercise_submissions" ALTER COLUMN "runner" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DEFAULT 'sandpack'::text;--> statement-breakpoint
-- Exercises are JavaScript/TypeScript only (founder decision, end of S4). Python
-- exercises are archived by the content sync; their submissions have no runner
-- left to replay them and are removed. Their exercise_submitted events stay in
-- the progress stream as history.
DELETE FROM "exercise_submissions" WHERE "runner" = 'pyodide';--> statement-breakpoint
UPDATE "exercises" SET "runner" = 'sandpack' WHERE "runner" = 'pyodide';--> statement-breakpoint
DROP TYPE "public"."exercise_runner";--> statement-breakpoint
CREATE TYPE "public"."exercise_runner" AS ENUM('sandpack');--> statement-breakpoint
ALTER TABLE "exercise_submissions" ALTER COLUMN "runner" SET DATA TYPE "public"."exercise_runner" USING "runner"::"public"."exercise_runner";--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DEFAULT 'sandpack'::"public"."exercise_runner";--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "runner" SET DATA TYPE "public"."exercise_runner" USING "runner"::"public"."exercise_runner";