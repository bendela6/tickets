CREATE TYPE "public"."permission_mode" AS ENUM('default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk', 'auto');--> statement-breakpoint
CREATE TYPE "public"."permission_status" AS ENUM('pending', 'allowed', 'denied');--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"provider_key" text NOT NULL,
	"model" text NOT NULL,
	"system_prompt" text,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disallowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"permission_mode" "permission_mode" DEFAULT 'bypassPermissions' NOT NULL,
	"mcp_servers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effort" text,
	"default_workspace_id" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agents_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tool_use_id" text,
	"parent_tool_use_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_messages_session_seq" UNIQUE("session_id","seq")
);
--> statement-breakpoint
CREATE TABLE "ai_permission_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "permission_status" DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"decided_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_default_workspace_id_ai_workspaces_id_fk" FOREIGN KEY ("default_workspace_id") REFERENCES "public"."ai_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_permission_requests" ADD CONSTRAINT "ai_permission_requests_session_id_ai_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."ai_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_permission_requests" ADD CONSTRAINT "ai_permission_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE no action ON UPDATE no action;