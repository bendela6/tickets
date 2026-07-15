CREATE TYPE "public"."runner_kind" AS ENUM('local', 'container');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('terminal', 'agent');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('starting', 'running', 'idle', 'awaiting_input', 'interrupted', 'exited', 'failed');--> statement-breakpoint
CREATE TABLE "ai_session_output" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_session_output_session_seq" UNIQUE("session_id","seq")
);
--> statement-breakpoint
CREATE TABLE "ai_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "session_kind" NOT NULL,
	"title" text NOT NULL,
	"workspace_id" integer NOT NULL,
	"agent_id" integer,
	"ticket_id" integer,
	"parent_session_id" integer,
	"status" "session_status" DEFAULT 'starting' NOT NULL,
	"provider_session_id" text,
	"cwd" text,
	"worktree_path" text,
	"exit_code" integer,
	"cost_usd" numeric(10, 4),
	"started_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"runner" "runner_kind" DEFAULT 'local' NOT NULL,
	"container_name" text,
	"git_remote" text,
	"default_branch" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_workspaces_name" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "ai_session_output" ADD CONSTRAINT "ai_session_output_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_workspace_id_ai_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."ai_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_parent_session_id_ai_sessions_id_fk" FOREIGN KEY ("parent_session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_sessions_status_created" ON "ai_sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ai_sessions_parent" ON "ai_sessions" USING btree ("parent_session_id");