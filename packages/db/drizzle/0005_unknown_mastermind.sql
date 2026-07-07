CREATE TABLE "link_type_target_types" (
	"link_type_id" integer NOT NULL,
	"target_type_id" integer NOT NULL,
	CONSTRAINT "link_type_target_types_link_type_id_target_type_id_pk" PRIMARY KEY("link_type_id","target_type_id")
);
--> statement-breakpoint
ALTER TABLE "fields" ALTER COLUMN "scheme_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "link_types" ALTER COLUMN "scheme_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fields" ADD COLUMN "ticket_type_id" integer;--> statement-breakpoint
ALTER TABLE "fields" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "fields" ADD COLUMN "required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "link_types" ADD COLUMN "ticket_type_id" integer;--> statement-breakpoint
ALTER TABLE "link_type_target_types" ADD CONSTRAINT "link_type_target_types_link_type_id_link_types_id_fk" FOREIGN KEY ("link_type_id") REFERENCES "public"."link_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_type_target_types" ADD CONSTRAINT "link_type_target_types_target_type_id_ticket_types_id_fk" FOREIGN KEY ("target_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_types" ADD CONSTRAINT "link_types_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;