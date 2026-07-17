CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TYPE "core"."runner_kind" AS ENUM('local', 'container');--> statement-breakpoint
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
-- ai_agents_default_workspace_id_ai_workspaces_id_fk and
-- ai_sessions_workspace_id_ai_workspaces_id_fk are dropped implicitly by the
-- CASCADE below (drizzle-kit is not schema-move aware and generated redundant
-- explicit DROP CONSTRAINT statements for both — hand-removed, they fail with
-- "constraint ... does not exist" if run after the CASCADE has already taken
-- them out).
ALTER TABLE "ai_workspaces" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ai_workspaces" CASCADE;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD COLUMN "workdir_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."workdirs" ADD CONSTRAINT "workdirs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_default_workspace_id_workdirs_id_fk" FOREIGN KEY ("default_workspace_id") REFERENCES "core"."workdirs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_workdir_id_workdirs_id_fk" FOREIGN KEY ("workdir_id") REFERENCES "core"."workdirs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sessions" DROP COLUMN "workspace_id";--> statement-breakpoint
DROP TYPE "public"."runner_kind";