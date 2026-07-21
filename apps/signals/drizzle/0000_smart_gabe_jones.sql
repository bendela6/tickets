CREATE TABLE "apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"ingest_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_slug_unique" UNIQUE("slug"),
	CONSTRAINT "apps_ingest_key_unique" UNIQUE("ingest_key")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"culprit" text,
	"status" text DEFAULT 'open' NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"event_count" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"kind" text NOT NULL,
	"session_id" text NOT NULL,
	"name" text NOT NULL,
	"message" text,
	"mechanism" text NOT NULL,
	"level" text NOT NULL,
	"client_timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"release" text,
	"environment" text,
	"issue_id" bigint,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sourcemap_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"release" text NOT NULL,
	"filename" text NOT NULL,
	"content" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sourcemap_artifacts" ADD CONSTRAINT "sourcemap_artifacts_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issues_app_fingerprint" ON "issues" USING btree ("app_id","fingerprint");--> statement-breakpoint
CREATE INDEX "signals_session" ON "signals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "signals_issue" ON "signals" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "signals_app_received" ON "signals" USING btree ("app_id","received_at");--> statement-breakpoint
CREATE INDEX "sourcemaps_app_release" ON "sourcemap_artifacts" USING btree ("app_id","release");