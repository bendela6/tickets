CREATE SCHEMA "agent";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "terminal";
--> statement-breakpoint
CREATE TYPE "agent"."session_status" AS ENUM('starting', 'running', 'idle', 'awaiting_input', 'interrupted', 'exited', 'failed');--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json');--> statement-breakpoint
CREATE TYPE "agent"."permission_mode" AS ENUM('default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk');--> statement-breakpoint
CREATE TYPE "agent"."permission_status" AS ENUM('pending', 'allowed', 'denied');--> statement-breakpoint
CREATE TYPE "core"."runner_kind" AS ENUM('local', 'container');--> statement-breakpoint
CREATE TYPE "public"."status_kind" AS ENUM('todo', 'active', 'blocked', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "terminal"."session_status" AS ENUM('starting', 'live', 'disconnected', 'exited', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_kind" AS ENUM('human', 'agent');--> statement-breakpoint
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
CREATE TABLE "commands" (
	"id" uuid PRIMARY KEY NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" integer NOT NULL,
	"actor_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_unique" UNIQUE("comment_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"parent_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_id" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"command_id" uuid NOT NULL,
	"correlation_id" uuid NOT NULL,
	"caused_by" bigint,
	"depth" integer DEFAULT 0 NOT NULL,
	"project_id" integer,
	CONSTRAINT "events_stream_seq" UNIQUE("aggregate_type","aggregate_id","seq"),
	CONSTRAINT "events_item_project" CHECK (aggregate_type <> 'item' OR project_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" "field_type" NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"option_set_id" integer,
	"archived_at" timestamp with time zone,
	CONSTRAINT "fields_scheme_key" UNIQUE("scheme_id","key"),
	CONSTRAINT "fields_option_set_required" CHECK (type <> 'option' OR option_set_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "item_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"event_id" bigint NOT NULL,
	"project_id" integer NOT NULL,
	"kind" text NOT NULL,
	"actor_id" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"summary" jsonb NOT NULL,
	CONSTRAINT "item_activity_event" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "item_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_type_id" integer NOT NULL,
	"source_item_id" integer NOT NULL,
	"target_item_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_links_unique" UNIQUE("link_type_id","source_item_id","target_item_id"),
	CONSTRAINT "item_links_no_self" CHECK (source_item_id <> target_item_id)
);
--> statement-breakpoint
CREATE TABLE "item_type_child_types" (
	"parent_type_id" integer NOT NULL,
	"child_type_id" integer NOT NULL,
	CONSTRAINT "item_type_child_types_parent_type_id_child_type_id_pk" PRIMARY KEY("parent_type_id","child_type_id")
);
--> statement-breakpoint
CREATE TABLE "item_type_fields" (
	"item_type_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"position" integer NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"config_override" jsonb,
	CONSTRAINT "item_type_fields_item_type_id_field_id_pk" PRIMARY KEY("item_type_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "item_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "item_types_scheme_key" UNIQUE("scheme_id","key")
);
--> statement-breakpoint
CREATE TABLE "item_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value_text" text,
	"value_number" numeric,
	"value_date" timestamp with time zone,
	"value_bool" boolean,
	"value_json" jsonb,
	"option_id" integer,
	"value_user_id" integer,
	CONSTRAINT "iv_one_value" CHECK (num_nonnulls(value_text, value_number, value_date, value_bool, value_json, option_id, value_user_id) = 1)
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"parent_id" integer,
	"number" integer NOT NULL,
	"created_by" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_project_number" UNIQUE("project_id","number")
);
--> statement-breakpoint
CREATE TABLE "link_type_target_types" (
	"link_type_id" integer NOT NULL,
	"target_type_id" integer NOT NULL,
	CONSTRAINT "link_type_target_types_link_type_id_target_type_id_pk" PRIMARY KEY("link_type_id","target_type_id")
);
--> statement-breakpoint
CREATE TABLE "link_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"inverse_label" text NOT NULL,
	"directional" boolean NOT NULL,
	"position" integer NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "link_types_type_key" UNIQUE("item_type_id","key")
);
--> statement-breakpoint
CREATE TABLE "option_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_id" integer NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "option_sets_scheme_key" UNIQUE("scheme_id","key")
);
--> statement-breakpoint
CREATE TABLE "option_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"from_option_id" integer,
	"to_option_id" integer NOT NULL,
	"item_type_id" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "option_transitions_edge" UNIQUE NULLS NOT DISTINCT("field_id","from_option_id","to_option_id","item_type_id")
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" serial PRIMARY KEY NOT NULL,
	"option_set_id" integer NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "status_kind",
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "options_set_value" UNIQUE("option_set_id","value")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"event_id" bigint PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"picked_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"item_prefix" text NOT NULL,
	"scheme_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "schemes_key_unique" UNIQUE("key")
);
--> statement-breakpoint
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
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"kind" "user_kind" NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "users_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."workdirs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"runner" "core"."runner_kind" DEFAULT 'local' NOT NULL,
	"container_name" text,
	"git_remote" text,
	"default_branch" text,
	"config" jsonb,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "commands" ADD CONSTRAINT "commands_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_caused_by_events_id_fk" FOREIGN KEY ("caused_by") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_option_set_id_option_sets_id_fk" FOREIGN KEY ("option_set_id") REFERENCES "public"."option_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_activity" ADD CONSTRAINT "item_activity_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_activity" ADD CONSTRAINT "item_activity_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_activity" ADD CONSTRAINT "item_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_link_type_id_link_types_id_fk" FOREIGN KEY ("link_type_id") REFERENCES "public"."link_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_source_item_id_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_links" ADD CONSTRAINT "item_links_target_item_id_items_id_fk" FOREIGN KEY ("target_item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_type_child_types" ADD CONSTRAINT "item_type_child_types_parent_type_id_item_types_id_fk" FOREIGN KEY ("parent_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_type_child_types" ADD CONSTRAINT "item_type_child_types_child_type_id_item_types_id_fk" FOREIGN KEY ("child_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_type_fields" ADD CONSTRAINT "item_type_fields_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_type_fields" ADD CONSTRAINT "item_type_fields_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_types" ADD CONSTRAINT "item_types_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_values" ADD CONSTRAINT "item_values_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_values" ADD CONSTRAINT "item_values_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_values" ADD CONSTRAINT "item_values_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_values" ADD CONSTRAINT "item_values_value_user_id_users_id_fk" FOREIGN KEY ("value_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_type_id_item_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_parent_id_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_type_target_types" ADD CONSTRAINT "link_type_target_types_link_type_id_link_types_id_fk" FOREIGN KEY ("link_type_id") REFERENCES "public"."link_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_type_target_types" ADD CONSTRAINT "link_type_target_types_target_type_id_item_types_id_fk" FOREIGN KEY ("target_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_types" ADD CONSTRAINT "link_types_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_sets" ADD CONSTRAINT "option_sets_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_transitions" ADD CONSTRAINT "option_transitions_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_transitions" ADD CONSTRAINT "option_transitions_from_option_id_options_id_fk" FOREIGN KEY ("from_option_id") REFERENCES "public"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_transitions" ADD CONSTRAINT "option_transitions_to_option_id_options_id_fk" FOREIGN KEY ("to_option_id") REFERENCES "public"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_transitions" ADD CONSTRAINT "option_transitions_item_type_id_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_option_set_id_option_sets_id_fk" FOREIGN KEY ("option_set_id") REFERENCES "public"."option_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_scheme_id_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal"."output" ADD CONSTRAINT "output_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "terminal"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal"."sessions" ADD CONSTRAINT "sessions_workdir_id_workdirs_id_fk" FOREIGN KEY ("workdir_id") REFERENCES "core"."workdirs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal"."sessions" ADD CONSTRAINT "sessions_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."workdirs" ADD CONSTRAINT "workdirs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_sessions_status_created" ON "agent"."sessions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "agent_sessions_parent" ON "agent"."sessions" USING btree ("parent_session_id");--> statement-breakpoint
CREATE INDEX "comments_item" ON "comments" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "events_correlation" ON "events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "events_command" ON "events" USING btree ("aggregate_type","aggregate_id","command_id");--> statement-breakpoint
CREATE INDEX "events_caused_by" ON "events" USING btree ("caused_by");--> statement-breakpoint
CREATE INDEX "events_project_at" ON "events" USING btree ("project_id","at");--> statement-breakpoint
CREATE INDEX "events_stream_at" ON "events" USING btree ("aggregate_type","aggregate_id","at");--> statement-breakpoint
CREATE INDEX "item_activity_item_at" ON "item_activity" USING btree ("item_id","at");--> statement-breakpoint
CREATE INDEX "item_activity_correlation" ON "item_activity" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "item_links_source" ON "item_links" USING btree ("source_item_id");--> statement-breakpoint
CREATE INDEX "item_links_target" ON "item_links" USING btree ("target_item_id");--> statement-breakpoint
CREATE INDEX "itf_type_position" ON "item_type_fields" USING btree ("item_type_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "iv_scalar" ON "item_values" USING btree ("item_id","field_id") WHERE option_id IS NULL AND value_user_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "iv_option" ON "item_values" USING btree ("item_id","field_id","option_id") WHERE option_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "iv_user" ON "item_values" USING btree ("item_id","field_id","value_user_id") WHERE value_user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "iv_item" ON "item_values" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "iv_field_text" ON "item_values" USING btree ("field_id","value_text");--> statement-breakpoint
CREATE INDEX "iv_field_number" ON "item_values" USING btree ("field_id","value_number");--> statement-breakpoint
CREATE INDEX "iv_field_date" ON "item_values" USING btree ("field_id","value_date");--> statement-breakpoint
CREATE INDEX "iv_field_option" ON "item_values" USING btree ("field_id","option_id");--> statement-breakpoint
CREATE INDEX "iv_field_user" ON "item_values" USING btree ("field_id","value_user_id");--> statement-breakpoint
CREATE INDEX "items_project_type" ON "items" USING btree ("project_id","type_id");--> statement-breakpoint
CREATE INDEX "items_parent" ON "items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "outbox_pending" ON "outbox" USING btree ("event_id") WHERE done_at IS NULL;--> statement-breakpoint
CREATE INDEX "terminal_sessions_status_created" ON "terminal"."sessions" USING btree ("status","created_at");