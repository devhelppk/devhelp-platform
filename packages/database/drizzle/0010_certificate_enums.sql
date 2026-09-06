ALTER TYPE "public"."moderation_subject" ADD VALUE 'certificate';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'certificate_issued';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'certificate_revoked';