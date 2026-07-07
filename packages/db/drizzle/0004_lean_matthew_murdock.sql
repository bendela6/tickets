ALTER TABLE "fields" DROP CONSTRAINT "fields_project_key";--> statement-breakpoint
ALTER TABLE "link_types" DROP CONSTRAINT "link_types_project_key";--> statement-breakpoint
ALTER TABLE "statuses" DROP CONSTRAINT "statuses_project_key";--> statement-breakpoint
ALTER TABLE "ticket_types" DROP CONSTRAINT "ticket_types_project_key";--> statement-breakpoint
ALTER TABLE "fields" DROP CONSTRAINT "fields_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "link_types" DROP CONSTRAINT "link_types_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "statuses" DROP CONSTRAINT "statuses_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "ticket_types" DROP CONSTRAINT "ticket_types_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "fields" ALTER COLUMN "scheme_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "link_types" ALTER COLUMN "scheme_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "scheme_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "statuses" ALTER COLUMN "ticket_type_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_types" ALTER COLUMN "scheme_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fields" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "link_types" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "statuses" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "ticket_types" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_scheme_key" UNIQUE("scheme_id","key");--> statement-breakpoint
ALTER TABLE "link_types" ADD CONSTRAINT "link_types_scheme_key" UNIQUE("scheme_id","key");--> statement-breakpoint
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_ticket_type_key" UNIQUE("ticket_type_id","key");--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_scheme_key" UNIQUE("scheme_id","key");