ALTER TABLE "ticket_type_fields" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ticket_type_fields" CASCADE;--> statement-breakpoint
ALTER TABLE "fields" DROP CONSTRAINT "fields_scheme_key";--> statement-breakpoint
ALTER TABLE "link_types" DROP CONSTRAINT "link_types_scheme_key";--> statement-breakpoint
ALTER TABLE "fields" DROP CONSTRAINT "fields_scheme_id_schemes_id_fk";
--> statement-breakpoint
ALTER TABLE "link_types" DROP CONSTRAINT "link_types_scheme_id_schemes_id_fk";
--> statement-breakpoint
ALTER TABLE "fields" ALTER COLUMN "ticket_type_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fields" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "link_types" ALTER COLUMN "ticket_type_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fields" DROP COLUMN "scheme_id";--> statement-breakpoint
ALTER TABLE "link_types" DROP COLUMN "scheme_id";--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_ticket_type_key" UNIQUE("ticket_type_id","key");--> statement-breakpoint
ALTER TABLE "link_types" ADD CONSTRAINT "link_types_ticket_type_key" UNIQUE("ticket_type_id","key");