-- Terminals, AI agents and workdirs left tickets (2026-10-11); their code is
-- at git tag ai-terminals-signals-last (2e95028).
DROP TABLE "agent"."agents" CASCADE;--> statement-breakpoint
DROP TABLE "agent"."messages" CASCADE;--> statement-breakpoint
DROP TABLE "agent"."permission_requests" CASCADE;--> statement-breakpoint
DROP TABLE "agent"."sessions" CASCADE;--> statement-breakpoint
DROP TABLE "terminal"."output" CASCADE;--> statement-breakpoint
DROP TABLE "terminal"."sessions" CASCADE;--> statement-breakpoint
DROP TABLE "core"."workdirs" CASCADE;--> statement-breakpoint
DROP TYPE "agent"."session_status";--> statement-breakpoint
DROP TYPE "agent"."permission_mode";--> statement-breakpoint
DROP TYPE "agent"."permission_status";--> statement-breakpoint
DROP TYPE "core"."runner_kind";--> statement-breakpoint
DROP TYPE "terminal"."session_status";--> statement-breakpoint
DROP SCHEMA "agent";
--> statement-breakpoint
DROP SCHEMA "terminal";
