DROP INDEX "moderation_items_queue_idx";--> statement-breakpoint
DROP INDEX "notifications_user_idx";--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "moderation_items_queue_idx" ON "moderation_items" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");