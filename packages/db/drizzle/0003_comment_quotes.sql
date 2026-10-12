ALTER TABLE "records"."comments" ADD COLUMN "quote" text;--> statement-breakpoint
ALTER TABLE "records"."comments" ADD COLUMN "nth" integer;--> statement-breakpoint
ALTER TABLE "records"."comments" ADD CONSTRAINT "comments_quote_nth" CHECK ((quote IS NULL AND nth IS NULL) OR (quote IS NOT NULL AND nth >= 0));