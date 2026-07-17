CREATE SCHEMA "terminal";
--> statement-breakpoint
CREATE TYPE "terminal"."session_status" AS ENUM('starting', 'live', 'disconnected', 'exited', 'failed');--> statement-breakpoint
CREATE TABLE "terminal"."output" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal"."sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"workdir_id" integer NOT NULL,
	"cwd" text,
	"status" "terminal"."session_status" DEFAULT 'starting' NOT NULL,
	"exit_code" integer,
	"started_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "terminal"."output" ADD CONSTRAINT "output_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "terminal"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal"."sessions" ADD CONSTRAINT "sessions_workdir_id_workdirs_id_fk" FOREIGN KEY ("workdir_id") REFERENCES "core"."workdirs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal"."sessions" ADD CONSTRAINT "sessions_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "terminal_sessions_status_created" ON "terminal"."sessions" USING btree ("status","created_at");