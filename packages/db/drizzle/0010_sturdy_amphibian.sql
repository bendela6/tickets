ALTER TYPE "public"."session_status" ADD VALUE 'live' BEFORE 'running';--> statement-breakpoint
ALTER TYPE "public"."session_status" ADD VALUE 'disconnected' BEFORE 'exited';--> statement-breakpoint
ALTER TABLE "ai_sessions" ADD COLUMN "archived_at" timestamp with time zone;