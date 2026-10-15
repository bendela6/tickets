-- TK-84.1: what each agent working on the plans last said it is doing, one row
-- per agent, written over by its next word and gone a week after its last.
-- `item` is the item as the agent named it: a tickets item's key, or a plans
-- id that no item has yet, kept unlinked.
CREATE TABLE "core"."agent_reports" (
	"name" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"state" text NOT NULL,
	"item" text,
	"text" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"since" timestamp with time zone NOT NULL,
	CONSTRAINT "agent_reports_role" CHECK (role IN ('planner', 'builder', 'worker')),
	CONSTRAINT "agent_reports_state" CHECK (state IN ('listening', 'working', 'done', 'failed', 'abandoned', 'stopped')),
	CONSTRAINT "agent_reports_text" CHECK (char_length(text) <= 300)
);
