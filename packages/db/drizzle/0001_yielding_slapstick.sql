ALTER TABLE "outbox" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_item_project" CHECK (aggregate_type <> 'item' OR project_id IS NOT NULL);