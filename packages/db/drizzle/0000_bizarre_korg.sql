CREATE TYPE "public"."field_type" AS ENUM('text', 'number', 'date', 'boolean', 'json', 'select', 'multi_select', 'status');--> statement-breakpoint
CREATE TYPE "public"."status_kind" AS ENUM('todo', 'active', 'blocked', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."user_kind" AS ENUM('human', 'agent');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "field_options_field_value" UNIQUE("field_id","value")
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "field_type" NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fields_project_key" UNIQUE("project_id","key")
);
--> statement-breakpoint
CREATE TABLE "link_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"inverse_label" text NOT NULL,
	"directional" boolean NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "link_types_project_key" UNIQUE("project_id","key")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"ticket_prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "status_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_status_id" integer,
	"to_status_id" integer NOT NULL,
	"ticket_type_id" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "status_transitions_edge" UNIQUE NULLS NOT DISTINCT("from_status_id","to_status_id","ticket_type_id")
);
--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"kind" "status_kind" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statuses_project_key" UNIQUE("project_id","key")
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"actor_id" integer NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_type_id" integer NOT NULL,
	"source_ticket_id" integer NOT NULL,
	"target_ticket_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_links_edge" UNIQUE("link_type_id","source_ticket_id","target_ticket_id"),
	CONSTRAINT "ticket_links_no_self" CHECK (source_ticket_id <> target_ticket_id)
);
--> statement-breakpoint
CREATE TABLE "ticket_type_fields" (
	"ticket_type_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"position" integer NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ticket_type_fields_ticket_type_id_field_id_pk" PRIMARY KEY("ticket_type_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_types_project_key" UNIQUE("project_id","key")
);
--> statement-breakpoint
CREATE TABLE "ticket_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value_text" text,
	"value_number" numeric,
	"value_date" timestamp with time zone,
	"value_bool" boolean,
	"value_json" jsonb,
	"option_id" integer,
	"status_id" integer,
	CONSTRAINT "ticket_values_ticket_field_option" UNIQUE("ticket_id","field_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"parent_id" integer,
	"number" integer NOT NULL,
	"created_by" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_project_number" UNIQUE("project_id","number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"kind" "user_kind" NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_types" ADD CONSTRAINT "link_types_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_from_status_id_statuses_id_fk" FOREIGN KEY ("from_status_id") REFERENCES "public"."statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_to_status_id_statuses_id_fk" FOREIGN KEY ("to_status_id") REFERENCES "public"."statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_link_type_id_link_types_id_fk" FOREIGN KEY ("link_type_id") REFERENCES "public"."link_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_source_ticket_id_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_target_ticket_id_tickets_id_fk" FOREIGN KEY ("target_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_fields" ADD CONSTRAINT "ticket_type_fields_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_fields" ADD CONSTRAINT "ticket_type_fields_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_values" ADD CONSTRAINT "ticket_values_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_values" ADD CONSTRAINT "ticket_values_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_values" ADD CONSTRAINT "ticket_values_option_id_field_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."field_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_values" ADD CONSTRAINT "ticket_values_status_id_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_type_id_ticket_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_parent_id_tickets_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_ticket" ON "comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_created" ON "ticket_events" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "ticket_links_source" ON "ticket_links" USING btree ("source_ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_links_target" ON "ticket_links" USING btree ("target_ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_values_single" ON "ticket_values" USING btree ("ticket_id","field_id") WHERE option_id IS NULL;--> statement-breakpoint
CREATE INDEX "ticket_values_ticket" ON "ticket_values" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_values_field_option" ON "ticket_values" USING btree ("field_id","option_id");--> statement-breakpoint
CREATE INDEX "ticket_values_status" ON "ticket_values" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "ticket_values_field_text" ON "ticket_values" USING btree ("field_id","value_text");--> statement-breakpoint
CREATE INDEX "tickets_project_type" ON "tickets" USING btree ("project_id","type_id");--> statement-breakpoint
CREATE INDEX "tickets_parent" ON "tickets" USING btree ("parent_id");