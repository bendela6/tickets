# Automation: event bus + no-code rules — design

Status: approved for planning (brainstormed 2026-07-07)

This is **Spec 1** of a larger automation & integration platform. It covers the
foundation and the first user-visible feature. Later layers get their own specs.

## The larger picture (roadmap)

The user asked for three things — hooks, event listeners, and integrations
(Jira/Linear/Notion). These are one system in four layers, built bottom-up:

1. **Event bus / outbox** — reliable after-commit dispatch of domain events.
2. **Automation rules engine (internal actions)** — user-configured "when X → do
   Y" rules stored as data, run against events, performing internal actions.
3. **Integration framework + outbound connectors** — a connector interface,
   connection/credential storage, id/field mapping, and a "push to \<connector\>"
   action type. Ships with one real connector.
4. **Inbound + bidirectional sync** — inbound webhooks, `connector.parse()`,
   echo/loop suppression, conflict resolution.

Build order is strictly 1 → 2 → 3 → 4. **This spec is layers 1 + 2**, chosen
because the outbox alone is not observable — pairing it with internal automations
yields a shippable, testable feature (no-code automations) end-to-end.

### Locked decisions (from brainstorming)

- **Automations are data, connectors are code.** Non-developers author rules in
  the web UI; the rules are rows in the DB. (Connectors, arriving in layer 3, are
  code a developer writes once.)
- **Full bidirectional sync is the eventual target** (layer 4) — so the
  foundation must be reliable. Hence a durable outbox, not best-effort in-memory.
- **Delivery is at-least-once via a transactional outbox**, polled by an
  in-process dispatcher in `apps/api`. No external broker; no new service.
- First spec draws its line at **layers 1 + 2**.

## Goal

Let a user open **Settings → Automations**, create a rule such as *"when a Bug in
TIX moves to Done, add a comment and POST a webhook,"* and have it run reliably
whenever that event occurs — surviving process crashes, retrying on failure, and
never firing twice for a single (event, rule) pair. No external integrations in
this spec.

## What exists today

- `ticket_events` is an append-only trail written **inside the same transaction**
  as every mutation (`writeEvent`, `apps/api/src/events/write-event.ts`). Kinds:
  `created`, `status-changed`, `value-changed`, `parent-changed`, `commented`,
  `archived`, `unarchived`. Payloads already carry `from`/`to`/`fieldKey`/etc.
- Nothing consumes those events — there is no dispatcher, no subscriber.
- The API is a single Fastify process (`apps/api`), routes registered in
  `app.ts`, validated with valibot.
- Comments are inserted + event-written together in `comments.routes.ts`.
- Status changes are gated by `checkTransition` (`apps/api/src/tickets/`).
- `users` has a `kind` enum (`human` | `agent`); the automation actor reuses
  `agent` with the name `Automation`.
- **Test style is pure-function unit tests, no DB harness.** `apps/api` and
  `packages/db` already run vitest (`check-parent.test.ts`,
  `check-transition` logic, `build-value-rows`, etc.) — the pattern is to
  extract the decision logic as a pure function and unit-test it; nothing hits
  Postgres in a test. This spec follows that pattern (see Testing).

## Architecture

```
mutation txn ─┬─ write ticket rows
              └─ write ticket_events row (same txn, already happens)
                       │ commit
                       ▼
        ┌──────────────────────────────────────────┐
        │  dispatcher (setInterval ~1s, in apps/api)│
        │                                           │
        │  fan-out pass:                            │
        │    events where dispatched_at is null     │
        │      → match enabled rules (project+kind) │
        │      → insert rule_execution per match    │
        │      → set dispatched_at                   │
        │                                           │
        │  execute pass:                            │
        │    rule_executions pending/failed & due   │
        │      → run actions in a txn               │
        │      → done | retry(backoff) | failed     │
        └──────────────────────────────────────────┘
```

New code lives in `apps/api/src/automation/`, new tables in `packages/db`, and a
Settings page in `apps/web`. No broker, no worker app.

### Why (event × rule) is the retry unit

One event can match several rules. If it matches rules A and B and B's action
fails, retrying must not re-run A's action (e.g. a duplicate comment). So the
durable unit of work — and of retry — is one `rule_execution` row per (event,
rule) pair, not the event. `rule_executions` therefore doubles as the **execution
log**.

## Data model

Three schema changes in `packages/db/src/schema/`.

### 1. Extend `ticket_events` (stays append-only in content)

Add three columns; the semantic columns (`kind`, `payload`, …) never change.

- `dispatched_at timestamptz null` — fan-out marker. Partial index
  `where dispatched_at is null` keeps the poll cheap.
- `depth int not null default 0` — chain depth. Human/agent action = 0; an event
  emitted by an action carries `parent.depth + 1`.
- `caused_by_execution_id int null` — the `rule_executions.id` whose action
  emitted this event (loop tracing; null for human/agent actions).

`writeEvent` gains optional `depth` and `causedByExecutionId` params, defaulting
to `0`/`null` so existing callers are unaffected.

### 2. New `automation_rules`

- `id serial pk`
- `projectId int` → projects
- `name text`
- `enabled boolean not null default true`
- `trigger text` — an event kind (see `EventKind`)
- `conditions jsonb` — `RuleCondition[]`, ANDed
- `actions jsonb` — `RuleAction[]`, run in order
- `createdBy int` → users
- `createdAt`, `updatedAt timestamptz`

### 3. New `rule_executions` (retry unit + execution log)

- `id serial pk`
- `ruleId int` → automation_rules
- `eventId int` → ticket_events
- `ticketId int` → tickets
- `status text` — `ExecutionStatus`
- `attempts int not null default 0`
- `lastError text null`
- `nextAttemptAt timestamptz null` — when the execute pass may next pick it up
- `startedAt`, `finishedAt timestamptz null`
- `result jsonb null` — `ExecutionResult` (per-action outcomes)
- unique `(ruleId, eventId)` — makes fan-out idempotent under at-least-once

### Seeded "Automation" system user

A single global user (e.g. `name = "Automation"`, an appropriate `kind`) seeded
via the existing seed path. All action-generated writes use its id as `actorId`,
so automated changes are attributable and visually distinguishable, and the
depth/causation guards can reason about them.

## Rule model

A rule = **trigger** + **conditions** (all must match) + **actions** (in order).

### Trigger

Exactly one `EventKind`: `created` · `status-changed` · `value-changed` ·
`parent-changed` · `commented` · `archived` · `unarchived`.

### Conditions (v1: AND-only)

`RuleCondition = { field, op, value }`.

- `field` — a ticket field key (`priority`, `assignee`, …) or a special token:
  `type`, `status.to`, `status.from`.
- `op` — `eq` · `neq` · `in` · `changed` · `changed_to` · `changed_from`.
- The evaluator reads `from`/`to`/`fieldKey` from the event payload and the
  ticket's current field values as needed.

Example: trigger `status-changed`, conditions `[type eq bug, status.to eq done]`.

OR / grouped conditions are **out of scope** (later spec).

### Actions (v1)

`RuleAction = { type, params }`, run sequentially, each performed **as the
Automation user**. Any events they emit carry `depth+1` and
`caused_by_execution_id`.

- `add_comment` — `{ body }`. Minimal templating: `{{ticket.key}}`,
  `{{event.to}}`, `{{event.from}}`. Reuses the comment-insert + `writeEvent` path.
- `set_field` — `{ fieldKey, value }`. Covers assignee, priority, custom fields.
- `change_status` — `{ statusKey }`. Goes through `checkTransition`; an illegal
  transition **fails the execution** (logged), it does not crash the dispatcher.
- `send_webhook` — `{ url, template }`. A plain `POST` via `fetch`. Internal
  (needs none of the layer-3 connector framework) but delivers real outbound
  value now. Distinct from real Jira/Linear/Notion connectors (layer 3).

Deferred to later specs: archive/unarchive, link/unlink, dedicated assign action.

## Dispatcher & reliability

`apps/api/src/automation/dispatcher.ts`, started from `server.ts` as a
single-flight `setInterval` (~1s; a run never overlaps the previous one).

**Fan-out pass.** Select all `ticket_events where dispatched_at is null`
(`FOR UPDATE SKIP LOCKED` for future multi-instance safety). For each event, find
enabled rules whose `projectId` and `trigger` match and whose conditions
evaluate true. If the event's `depth > cap`, insert a `skipped` execution per
matching rule (reason: depth cap) instead of running — see loop prevention. Else
insert a `rule_execution` (status `pending`) per matching rule. Either way, set
the event's `dispatched_at` so it is never rescanned. The unique
`(ruleId, eventId)` constraint makes a re-run of this pass a no-op.

**Execute pass.** Select `rule_executions where status in (pending, failed) and
(nextAttemptAt is null or nextAttemptAt <= now())`. For each: mark `running`, run
its rule's actions inside a transaction, record per-action outcomes in `result`,
mark `done`. On error: increment `attempts`, set `lastError`, set an exponential
`nextAttemptAt`; after `maxAttempts` (default 5) mark `failed` (dead-letter,
visible in the log).

**Loop prevention** (actions emit events that can re-trigger rules):

1. Action-emitted events get `depth = parent + 1` and `caused_by_execution_id`.
2. Fan-out **skips events past the depth cap** (default 5) — recorded as a
   `skipped` execution with a reason, never silently dropped.
3. A rule does not fire on an event in its own causation chain (same rule id
   found by walking `caused_by_execution_id`).

**At-least-once tolerance.** `set_field`/`change_status` are naturally
idempotent. `add_comment`/`send_webhook` are guarded by only advancing execution
state after the side effect succeeds; a crash mid-action re-runs that one
execution, which is the accepted at-least-once trade-off (documented on the UI).

## API surface

New routes in `apps/api/src/routes/automations.routes.ts`, valibot-validated,
registered in `app.ts`:

- `GET  /api/projects/:key/rules` — list rules for a project
- `POST /api/projects/:key/rules` — create
- `GET  /api/rules/:id` — read
- `PATCH /api/rules/:id` — update (name, enabled, trigger, conditions, actions)
- `DELETE /api/rules/:id` — delete
- `GET  /api/rules/:id/executions` — execution log for one rule
- `GET  /api/projects/:key/rule-executions` — execution log across a project

Rule create/update validates that `trigger` is a known kind, conditions
reference known fields, and actions are well-formed for their type.

## Web UI

A **Settings → Automations** page in `apps/web`, built with the Instrument design
system and existing TanStack Query/Router patterns. Use the project component
skills (`mapping-component-states`, `implementing-a-component`,
`verifying-a-component`).

- **Rules list** — name, trigger, enabled toggle, last-run status.
- **Rule editor** — name; trigger dropdown; condition rows (field / op / value);
  action rows (type + params); save / enable.
- **Execution log** — table of recent executions (status, event, time, error)
  for debugging, per-rule and project-wide.

## Testing

vitest already runs in `apps/api` and `packages/db`. Follow the house style —
extract decision logic as pure functions and unit-test them; do **not** stand up
a DB test harness (the repo has none).

- **Pure-unit (automated)** — the condition evaluator across every `op`; the
  rule-matching selector (`selectMatchingRules`); the action runner driven by
  **injected effect functions** (spies for `addComment`/`applyFieldValue`/
  `sendWebhook` — no DB); comment/webhook template rendering; the depth-cap loop
  guard; and backoff scheduling. This covers all branching logic.
- **End-to-end (manual, documented)** — the thin DB layer (fan-out/execute
  queries, effect implementations) is verified by a scripted manual run using the
  `running-the-stack` skill: create a rule via the API, PATCH a ticket, and
  observe the action land plus a `rule_execution` row appear. Exercise three
  paths: happy path; an illegal `change_status` (→ `failed`, logged); and a
  self-triggering rule hitting the depth cap (→ `skipped`). Standing up an
  automated DB integration harness is deferred to a later spec.

## Out of scope (this spec)

Real Jira/Linear/Notion connectors; inbound webhooks; bidirectional sync;
OR/grouped conditions; MCP tools for managing rules; a rule dry-run/test
endpoint; archive/link actions. Each belongs to a later layer or spec.

## Types

Every named type used above, defined here.

```ts
// Event kinds already emitted by the API today.
type EventKind =
  | 'created'
  | 'status-changed'
  | 'value-changed'
  | 'parent-changed'
  | 'commented'
  | 'archived'
  | 'unarchived';

// A single ANDed predicate on an event + its ticket.
type RuleCondition = {
  field: string; // ticket field key, or 'type' | 'status.to' | 'status.from'
  op: 'eq' | 'neq' | 'in' | 'changed' | 'changed_to' | 'changed_from';
  value?: unknown; // omitted for 'changed'
};

// One action performed when a rule matches. Params are per-type.
type RuleAction =
  | { type: 'add_comment'; params: { body: string } }
  | { type: 'set_field'; params: { fieldKey: string; value: unknown } }
  | { type: 'change_status'; params: { statusKey: string } }
  | { type: 'send_webhook'; params: { url: string; template: string } };

// Rows in automation_rules.
type AutomationRule = {
  id: number;
  projectId: number;
  name: string;
  enabled: boolean;
  trigger: EventKind;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
};

type ExecutionStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

// Per-action outcome recorded on a rule_execution.
type ExecutionResult = {
  actions: Array<{
    type: RuleAction['type'];
    ok: boolean;
    detail?: string; // error message, emitted comment id, webhook status, …
  }>;
};

// Rows in rule_executions — the retry unit and the execution log.
type RuleExecution = {
  id: number;
  ruleId: number;
  eventId: number;
  ticketId: number;
  status: ExecutionStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  result: ExecutionResult | null;
};
```
