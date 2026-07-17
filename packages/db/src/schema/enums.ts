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

// ── core schema ──────────────────────────────────────────────────────────────

// Where a session's process runs. Only `local` is implemented.
export const runnerKindEnum = coreSchema.enum('runner_kind', ['local', 'container']);

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
