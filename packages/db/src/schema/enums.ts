import { pgEnum } from 'drizzle-orm/pg-core';
import { agentSchema, coreSchema, terminalSchema } from './schemas';

export const userKindEnum = pgEnum('user_kind', ['human', 'agent']);

// The one workflow semantic code knows: what counts as done/active for tiles,
// progress rollups and filter buckets. Lives on options.kind (nullable — only
// workflow options carry it).
export const statusKindEnum = pgEnum('status_kind', [
  'todo',
  'active',
  'blocked',
  'done',
  'dropped',
]);

// Format (url/email/markdown) and cardinality (multiple) ride in fields.config,
// not in the type. There is no 'status' type — a workflow status is an option
// field whose option set carries kinds and whose graph is option_transitions.
export const fieldTypeEnum = pgEnum('field_type', [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'option',
  'user',
  'json',
]);

// ── AI sessions (legacy, public schema) ─────────────────────────────────────
// These back the old ai_* tables (ai-sessions.ts, ai-agents.ts,
// ai-permission-requests.ts), which stay live until Tasks 6-9 port their
// drivers off. terminal/agent split (Task 4/5) supersedes them with
// terminal.session_status and agent.{session_status,permission_mode,
// permission_status} below — same bare enum names, different schema, so the
// TS identifiers here are prefixed `legacy*` to avoid colliding with the new
// exports of the same conceptual enum.

// A session is one of two kinds; only `agent` is provider-adapted.
export const sessionKindEnum = pgEnum('session_kind', ['terminal', 'agent']);

// The lifecycle a running session moves through. `awaiting_input` (blocked on a
// permission decision) is the only state that demands a human — E3.
export const sessionStatusEnum = pgEnum('session_status', [
  //
  'starting',
  'live',
  'running',
  'idle',
  'awaiting_input',
  'interrupted',
  'disconnected',
  'exited',
  'failed',
]);

// Where a session's process runs. E1 implements `local` only.
export const runnerKindEnum = coreSchema.enum('runner_kind', ['local', 'container']);

// How a persona decides whether a tool call needs a human — mirrors the Claude
// Agent SDK's PermissionMode. E2 ships agents in `bypassPermissions` (autonomy
// now); the approval flow that uses `default` is E3. `auto` is a 6th value
// apps/api's valibot schema still accepts for the legacy driver — the new
// agent.permission_mode below drops it per the terminal/agent split brief.
export const legacyPermissionModeEnum = pgEnum('permission_mode', [
  //
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
  'dontAsk',
  'auto',
]);

// A pending permission request is a `canUseTool` promise in the supervisor
// waiting on a human; the terminal transitions are the human's decision (E3).
export const legacyPermissionStatusEnum = pgEnum('permission_status', [
  //
  'pending',
  'allowed',
  'denied',
]);

// ── terminal schema ──────────────────────────────────────────────────────────

// A PTY's lifecycle. `live` = attached and running; `disconnected` = the API
// restarted and the process died with it. No turn states — those are agent facts.
export const terminalStatusEnum = terminalSchema.enum('session_status', [
  'starting', 'live', 'disconnected', 'exited', 'failed',
]);

// ── agent schema ─────────────────────────────────────────────────────────────

// An agent turn's lifecycle. No live/disconnected — those are PTY facts.
export const agentStatusEnum = agentSchema.enum('session_status', [
  'starting', 'running', 'idle', 'awaiting_input', 'interrupted', 'exited', 'failed',
]);

// How a persona decides whether a tool call needs a human — mirrors the Claude
// Agent SDK's PermissionMode. Exactly the 5 SDK values; no legacy `auto`.
export const permissionModeEnum = agentSchema.enum('permission_mode', [
  'default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk',
]);

// A pending permission request is a `canUseTool` promise in the supervisor
// waiting on a human; the terminal transitions are the human's decision.
export const permissionStatusEnum = agentSchema.enum('permission_status', [
  'pending', 'allowed', 'denied',
]);
