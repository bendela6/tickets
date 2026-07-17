CREATE SCHEMA "agent";
--> statement-breakpoint
CREATE TYPE "agent"."session_status" AS ENUM('starting', 'running', 'idle', 'awaiting_input', 'interrupted', 'exited', 'failed');--> statement-breakpoint
CREATE TYPE "agent"."permission_mode" AS ENUM('default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk');--> statement-breakpoint
CREATE TYPE "agent"."permission_status" AS ENUM('pending', 'allowed', 'denied');--> statement-breakpoint
CREATE TABLE "agent"."agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"provider_key" text NOT NULL,
	"model" text NOT NULL,
	"system_prompt" text,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disallowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permission_mode" "agent"."permission_mode" DEFAULT 'bypassPermissions' NOT NULL,
	"mcp_servers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effort" text,
	"default_workdir_id" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_agents_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "agent"."messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tool_use_id" text,
	"parent_tool_use_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_messages_session_seq" UNIQUE("session_id","seq")
);
--> statement-breakpoint
CREATE TABLE "agent"."permission_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "agent"."permission_status" DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"decided_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent"."sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"workdir_id" integer NOT NULL,
	"agent_id" integer,
	"item_id" integer,
	"parent_session_id" integer,
	"status" "agent"."session_status" DEFAULT 'starting' NOT NULL,
	"provider_session_id" text,
	"cwd" text,
	"worktree_path" text,
	"cost_usd" numeric(10, 4),
	"started_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent"."agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."agents" ADD CONSTRAINT "agents_default_workdir_id_workdirs_id_fk" FOREIGN KEY ("default_workdir_id") REFERENCES "core"."workdirs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "agent"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."permission_requests" ADD CONSTRAINT "permission_requests_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "agent"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."permission_requests" ADD CONSTRAINT "permission_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."sessions" ADD CONSTRAINT "sessions_workdir_id_workdirs_id_fk" FOREIGN KEY ("workdir_id") REFERENCES "core"."workdirs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."sessions" ADD CONSTRAINT "sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "agent"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."sessions" ADD CONSTRAINT "sessions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."sessions" ADD CONSTRAINT "sessions_parent_session_id_sessions_id_fk" FOREIGN KEY ("parent_session_id") REFERENCES "agent"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent"."sessions" ADD CONSTRAINT "sessions_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_sessions_status_created" ON "agent"."sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "agent_sessions_parent" ON "agent"."sessions" USING btree ("parent_session_id");