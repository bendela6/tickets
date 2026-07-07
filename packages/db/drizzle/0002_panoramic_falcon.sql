ALTER TABLE "fields" ADD COLUMN "scheme_id" integer;--> statement-breakpoint
ALTER TABLE "link_types" ADD COLUMN "scheme_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "scheme_id" integer;--> statement-breakpoint
ALTER TABLE "statuses" ADD COLUMN "ticket_type_id" integer;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN "scheme_id" integer;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_types" ADD CONSTRAINT "link_types_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;