import { pgEnum } from 'drizzle-orm/pg-core';

export const userKindEnum = pgEnum('user_kind', ['human', 'agent']);

// The only hardcoded workflow semantic in the system: code must know what counts
// as done/active for tiles, progress rollups, and filter buckets.
export const statusKindEnum = pgEnum('status_kind', [
  //
  'todo',
  'active',
  'blocked',
  'done',
  'dropped',
]);

export const fieldTypeEnum = pgEnum('field_type', [
  //
  'text',
  'number',
  'date',
  'boolean',
  'json',
  'select',
  'multi_select',
  'status',
]);

// ── AI sessions ──────────────────────────────────────────────────────────────

// A session is one of two kinds; only `agent` is provider-adapted.
export const sessionKindEnum = pgEnum('session_kind', ['terminal', 'agent']);

// The lifecycle a running session moves through. `awaiting_input` (blocked on a
// permission decision) is the only state that demands a human — E3.
export const sessionStatusEnum = pgEnum('session_status', [
  //
  'starting',
  'running',
  'idle',
  'awaiting_input',
  'interrupted',
  'exited',
  'failed',
]);

// Where a session's process runs. E1 implements `local` only.
export const runnerKindEnum = pgEnum('runner_kind', ['local', 'container']);

// How a persona decides whether a tool call needs a human — mirrors the Claude
// Agent SDK's PermissionMode. E2 ships agents in `bypassPermissions` (autonomy
// now); the approval flow that uses `default` is E3.
export const permissionModeEnum = pgEnum('permission_mode', [
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
export const permissionStatusEnum = pgEnum('permission_status', [
  //
  'pending',
  'allowed',
  'denied',
]);
