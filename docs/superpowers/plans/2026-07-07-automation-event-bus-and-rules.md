# Automation: event bus + no-code rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create no-code automation rules ("when a ticket event matches conditions → run internal actions") that fire reliably off committed domain events, surviving crashes and retrying on failure.

**Architecture:** Every mutation already writes a `ticket_events` row in its own transaction. A single-flight background dispatcher in `apps/api` polls undispatched events (fan-out pass → one `rule_execution` per matching rule) then runs due executions (execute pass → actions, with per-execution retry/backoff). All decision logic is extracted into pure functions and unit-tested; the DB glue is thin and verified by a documented manual end-to-end run.

**Tech Stack:** TypeScript (ESM, strict), Fastify 5, drizzle-orm + postgres-js, valibot (API validation), React 19 + TanStack Query/Router + Tailwind v4 (Instrument design system), vitest.

## Global Constraints

- Node ≥ 20; pnpm 9.15.0; all packages `"type": "module"`. One line each below is a hard rule for every task.
- **Validate all request bodies with valibot** via `parseBody(schema, request.body)` (`apps/api/src/utils/parse-body.ts`); throw `HttpError(status, msg)` for user errors.
- **Reuse, don't duplicate.** Action side effects go through the shared `addComment` / `applyFieldValue` helpers (Tasks 3–4); routes use the same helpers.
- **Loop safety is non-negotiable.** Every event an action emits carries `depth = triggerEvent.depth + 1` and `causedByExecutionId`; the fan-out pass records over-cap events as `skipped`, never dropped.
- **`loadProjectVocab(db, …)` takes the root `Db`** (not a tx). Read reference data with `db`; do writes inside `db.transaction(async (tx) => …)`.
- **Test style:** extract pure decision logic and unit-test it (like `check-parent.test.ts`). Do **not** add a DB test harness.
- Conventional commits scoped by app: `feat(db|api|web): …`. One commit per task.
- Checks that must pass before a commit: `pnpm typecheck`; for tasks with tests, the relevant `pnpm --filter <pkg> test`.

**Canonical types** (used across tasks; defined once here, created in code in Task 5):

```ts
export type EventKind =
  | 'created' | 'status-changed' | 'value-changed'
  | 'parent-changed' | 'commented' | 'archived' | 'unarchived';

export type ConditionOp = 'eq' | 'neq' | 'in' | 'changed' | 'changed_to' | 'changed_from';

export type RuleCondition = { field: string; op: ConditionOp; value?: unknown };

export type RuleAction =
  | { type: 'add_comment'; params: { body: string } }
  | { type: 'set_field'; params: { fieldKey: string; value: unknown } }
  | { type: 'change_status'; params: { statusKey: string } }
  | { type: 'send_webhook'; params: { url: string; template: string } };

export type EvalContext = {
  eventKind: EventKind;
  ticketTypeKey: string;
  fieldValues: Record<string, unknown>; // current rendered values, keyed by field key
  changed: { fieldKey: string | null; from: unknown; to: unknown }; // from the event payload
};

export type ActionOutcome = { type: RuleAction['type']; ok: boolean; detail?: string };
export type ExecutionResult = { actions: ActionOutcome[] };
export type RunOutcome = { result: ExecutionResult; ok: boolean; error?: string };
```

---

## Task 1: Database schema + migration

**Files:**
- Modify: `packages/db/src/schema/ticket-events.ts`
- Create: `packages/db/src/schema/automation-rules.ts`
- Create: `packages/db/src/schema/rule-executions.ts`
- Modify: `packages/db/src/schema/index.ts`
- Generated: `packages/db/drizzle/0001_*.sql` (via `db:generate`)

**Interfaces:**
- Produces: `automationRules`, `ruleExecutions` drizzle tables; `ticketEvents` gains `dispatchedAt`, `depth`, `causedByExecutionId`.

- [ ] **Step 1: Extend `ticket_events`**

Replace `packages/db/src/schema/ticket-events.ts` with:

```ts
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { users } from './users';

// Append-only audit trail; written in the same transaction as the mutation it
// records. The three trailing columns are dispatch bookkeeping for the automation
// engine — they never change the audit content.
export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: serial('id').primaryKey(),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id),
    actorId: integer('actor_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    // automation dispatch bookkeeping
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true, mode: 'string' }),
    depth: integer('depth').notNull().default(0),
    // rule_executions.id whose action emitted this event; plain int (no FK) to
    // avoid a circular reference with rule_executions.event_id.
    causedByExecutionId: integer('caused_by_execution_id'),
  },
  (table) => [
    index('ticket_events_ticket_created').on(table.ticketId, table.createdAt),
    index('ticket_events_undispatched')
      .on(table.id)
      .where(sql`${table.dispatchedAt} is null`),
  ],
);
```

- [ ] **Step 2: Create `automation_rules`**

Create `packages/db/src/schema/automation-rules.ts`:

```ts
import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { users } from './users';

// User-authored automation. `trigger` is an event kind; conditions/actions are
// validated in app code (RuleCondition[] / RuleAction[]).
export const automationRules = pgTable(
  'automation_rules',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    trigger: text('trigger').notNull(),
    conditions: jsonb('conditions').notNull().default(sql`'[]'::jsonb`),
    actions: jsonb('actions').notNull().default(sql`'[]'::jsonb`),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [index('automation_rules_project_trigger').on(table.projectId, table.trigger)],
);
```

- [ ] **Step 3: Create `rule_executions`**

Create `packages/db/src/schema/rule-executions.ts`:

```ts
import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { automationRules } from './automation-rules';
import { ticketEvents } from './ticket-events';
import { tickets } from './tickets';

// One row per (event, rule) — the durable retry unit AND the execution log.
// status ∈ pending | running | done | failed | skipped.
export const ruleExecutions = pgTable(
  'rule_executions',
  {
    id: serial('id').primaryKey(),
    ruleId: integer('rule_id')
      .notNull()
      .references(() => automationRules.id),
    eventId: integer('event_id')
      .notNull()
      .references(() => ticketEvents.id),
    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'string' }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    result: jsonb('result'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('rule_executions_rule_event').on(table.ruleId, table.eventId),
    index('rule_executions_due').on(table.status, table.nextAttemptAt),
  ],
);
```

- [ ] **Step 4: Export the new tables**

In `packages/db/src/schema/index.ts`, add after the `ticketEvents` export:

```ts
export { automationRules } from './automation-rules';
export { ruleExecutions } from './rule-executions';
```

- [ ] **Step 5: Generate the migration**

Run: `pnpm --filter @tickets/db db:generate`
Expected: a new `packages/db/drizzle/0001_*.sql` is written altering `ticket_events` and creating `automation_rules` + `rule_executions`. Open it and confirm the three `ticket_events` columns and both new tables are present.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @tickets/db typecheck`
Expected: PASS.

- [ ] **Step 7: Apply the migration to the dev DB**

Ensure Postgres is up (`docker compose up -d`), then run: `pnpm --filter @tickets/db db:migrate`
Expected: `migrations applied`.

- [ ] **Step 8: Commit**

```bash
git add packages/db
git commit -m "feat(db): automation event-bus columns + rules & executions tables"
```

---

## Task 2: Extend `writeEvent` with depth + causation

**Files:**
- Modify: `apps/api/src/events/write-event.ts`

**Interfaces:**
- Produces: `writeEvent(tx, { ticketId, actorId, kind, payload?, depth?, causedByExecutionId? })` — new optional `depth` (default 0) and `causedByExecutionId` (default null). All existing callers keep working unchanged.

- [ ] **Step 1: Update the helper**

Replace `apps/api/src/events/write-event.ts` with:

```ts
import type { DbExecutor } from '@tickets/db';
import { ticketEvents } from '@tickets/db';

export async function writeEvent(
  tx: DbExecutor,
  input: {
    ticketId: number;
    actorId: number;
    kind: string;
    payload?: unknown;
    depth?: number;
    causedByExecutionId?: number | null;
  },
): Promise<void> {
  await tx.insert(ticketEvents).values({
    ticketId: input.ticketId,
    actorId: input.actorId,
    kind: input.kind,
    payload: input.payload ?? {},
    depth: input.depth ?? 0,
    causedByExecutionId: input.causedByExecutionId ?? null,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS (existing callers omit the new fields and default correctly).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/events/write-event.ts
git commit -m "feat(api): writeEvent accepts depth + causedByExecutionId"
```

---

## Task 3: Extract shared `addComment` helper

**Files:**
- Create: `apps/api/src/comments/add-comment.ts`
- Modify: `apps/api/src/routes/comments.routes.ts`

**Interfaces:**
- Produces: `addComment(tx, { ticketId, authorId, body, depth?, causedByExecutionId? }): Promise<{ id: number }>` — inserts a comment and its `commented` event in one call.
- Consumes: `writeEvent` (Task 2).

- [ ] **Step 1: Create the helper**

Create `apps/api/src/comments/add-comment.ts`:

```ts
import type { DbExecutor } from '@tickets/db';
import { comments } from '@tickets/db';
import { HttpError } from '../errors';
import { writeEvent } from '../events/write-event';

// Single source of truth for "add a comment": used by the comments route and by
// the automation add_comment action. Emits the `commented` event so the activity
// feed and (recursively) other rules see it.
export async function addComment(
  tx: DbExecutor,
  input: {
    ticketId: number;
    authorId: number;
    body: string;
    depth?: number;
    causedByExecutionId?: number | null;
  },
): Promise<{ id: number }> {
  const inserted = await tx
    .insert(comments)
    .values({ ticketId: input.ticketId, authorId: input.authorId, body: input.body })
    .returning({ id: comments.id });
  const comment = inserted[0];
  if (!comment) {
    throw new HttpError(500, 'comment insert returned no row');
  }
  await writeEvent(tx, {
    ticketId: input.ticketId,
    actorId: input.authorId,
    kind: 'commented',
    payload: { commentId: comment.id },
    depth: input.depth,
    causedByExecutionId: input.causedByExecutionId,
  });
  return comment;
}
```

- [ ] **Step 2: Use it from the route**

In `apps/api/src/routes/comments.routes.ts`, replace the `db.transaction(...)` block body in `createComment` with a call to the helper. The route becomes:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { tickets } from '@tickets/db';
import { HttpError } from '../errors';
import { addComment } from '../comments/add-comment';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';

const createCommentSchema = v.object({
  authorId: v.pipe(v.number(), v.integer()),
  body: v.pipe(v.string(), v.minLength(1)),
});

export function registerCommentsRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const createComment = async (request: FastifyRequest, reply: FastifyReply) => {
    const ticketId = parseId((request.params as { id: string }).id);
    const body = parseBody(createCommentSchema, request.body);
    const ticketRows = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, ticketId));
    if (!ticketRows[0]) {
      throw new HttpError(404, 'ticket not found');
    }
    const created = await db.transaction((tx) =>
      addComment(tx, { ticketId, authorId: body.authorId, body: body.body }),
    );
    reply.status(201).send(created);
  };

  app.post('/api/tickets/:id/comments', createComment);
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS.

- [ ] **Step 4: Manual smoke — comments still work**

With the stack running (see `running-the-stack` skill), POST a comment to an existing ticket and confirm a 201 + the comment appears. Example:

Run: `curl -s -X POST localhost:4600/api/tickets/1/comments -H 'content-type: application/json' -d '{"authorId":1,"body":"helper smoke"}'`
Expected: JSON `{ "id": <n> }`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/comments/add-comment.ts apps/api/src/routes/comments.routes.ts
git commit -m "refactor(api): extract shared addComment helper"
```

---

## Task 4: Extract shared `applyFieldValue` helper

**Files:**
- Create: `apps/api/src/tickets/apply-field-value.ts`
- Modify: `apps/api/src/routes/tickets.routes.ts`

**Interfaces:**
- Produces: `applyFieldValue(tx, { vocab, ticketId, typeId, fieldKey, value, actorId, depth?, causedByExecutionId? }): Promise<void>` — validates + writes one field/status change and its event. Throws `HttpError` on unknown field / illegal transition / cleared status.
- Consumes: `buildValueRows`, `checkTransition`, `renderValue`, `writeEvent`.

- [ ] **Step 1: Create the helper (move the per-field block out of `patchTicket`)**

Create `apps/api/src/tickets/apply-field-value.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { ticketValues } from '@tickets/db';
import { HttpError } from '../errors';
import { writeEvent } from '../events/write-event';
import type { ProjectVocab } from '../vocab/load-project-vocab';
import { buildValueRows } from './build-value-rows';
import { checkTransition } from './check-transition';
import { renderValue } from './render-value';

async function currentFieldValue(tx: DbExecutor, vocab: ProjectVocab, ticketId: number, fieldId: number) {
  const rows = await tx
    .select()
    .from(ticketValues)
    .where(and(eq(ticketValues.ticketId, ticketId), eq(ticketValues.fieldId, fieldId)));
  if (rows.length === 0) {
    return { rows, rendered: null as unknown };
  }
  const rendered =
    rows.length === 1 ? renderValue(vocab, rows[0]!) : rows.map((row) => renderValue(vocab, row));
  return { rows, rendered };
}

// Single source of truth for "set one field (or status) on a ticket": used by
// PATCH /tickets/:id and by the automation set_field / change_status actions.
// Replace semantics; status goes through checkTransition. No-op returns early.
export async function applyFieldValue(
  tx: DbExecutor,
  input: {
    vocab: ProjectVocab;
    ticketId: number;
    typeId: number;
    fieldKey: string;
    value: unknown;
    actorId: number;
    depth?: number;
    causedByExecutionId?: number | null;
  },
): Promise<void> {
  const { vocab, ticketId, typeId, fieldKey, value, actorId } = input;
  const field = vocab.fieldByKey.get(fieldKey);
  if (!field || field.archivedAt) {
    throw new HttpError(400, `unknown field "${fieldKey}"`);
  }
  const current = await currentFieldValue(tx, vocab, ticketId, field.id);
  const nextRows = buildValueRows(vocab, fieldKey, value, typeId);

  if (field.type === 'status') {
    const nextStatusId = nextRows[0]?.statusId;
    if (!nextStatusId) {
      throw new HttpError(400, 'status cannot be cleared');
    }
    const fromStatusId = current.rows[0]?.statusId ?? null;
    if (fromStatusId === nextStatusId) {
      return;
    }
    checkTransition(vocab, { fromStatusId, toStatusId: nextStatusId, typeId });
  }

  await tx
    .delete(ticketValues)
    .where(and(eq(ticketValues.ticketId, ticketId), eq(ticketValues.fieldId, field.id)));
  if (nextRows.length > 0) {
    await tx.insert(ticketValues).values(nextRows.map((row) => ({ ...row, ticketId })));
  }
  const rendered = nextRows.length === 0 ? null : value;
  await writeEvent(tx, {
    ticketId,
    actorId,
    kind: field.type === 'status' ? 'status-changed' : 'value-changed',
    payload: { fieldId: field.id, fieldKey, from: current.rendered, to: rendered },
    depth: input.depth,
    causedByExecutionId: input.causedByExecutionId,
  });
}
```

- [ ] **Step 2: Use it from `patchTicket`**

In `apps/api/src/routes/tickets.routes.ts`: delete the local `currentFieldValue` function, and replace the `for (const [fieldKey, value] of Object.entries(body.values ?? {})) { … }` loop body with a call to the helper:

```ts
import { applyFieldValue } from '../tickets/apply-field-value';
// …
      for (const [fieldKey, value] of Object.entries(body.values ?? {})) {
        await applyFieldValue(tx, {
          vocab,
          ticketId: id,
          typeId,
          fieldKey,
          value,
          actorId: body.actorId,
        });
      }
```

Remove the now-unused imports (`renderValue`, `checkTransition`, `buildValueRows`, `ticketValues`, `and`) from `tickets.routes.ts` if nothing else uses them (create-ticket still uses `buildValueRows`/`checkTransition`/`ticketValues` — keep those; remove only what the typecheck flags).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS. Fix any unused-import errors it flags.

- [ ] **Step 4: Manual smoke — patch still works**

With the stack running, change a field and a status on a ticket and confirm both succeed and an illegal status move still 422s. Example (value change):

Run: `curl -s -X PATCH localhost:4600/api/tickets/1 -H 'content-type: application/json' -d '{"actorId":1,"expectedUpdatedAt":"<paste current updatedAt>","values":{"priority":"high"}}'`
Expected: `{ "id": 1, "updatedAt": "…" }` and the change visible on the ticket.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tickets/apply-field-value.ts apps/api/src/routes/tickets.routes.ts
git commit -m "refactor(api): extract shared applyFieldValue helper"
```

---

## Task 5: Automation types + condition evaluator (pure, TDD)

**Files:**
- Create: `apps/api/src/automation/types.ts`
- Create: `apps/api/src/automation/conditions.ts`
- Test: `apps/api/src/automation/conditions.test.ts`

**Interfaces:**
- Produces: the canonical types (see Global Constraints); `matchCondition(cond, ctx)`, `matchConditions(conds, ctx)`, `selectMatchingRules(rules, ctx)`.

- [ ] **Step 1: Create the types**

Create `apps/api/src/automation/types.ts` with exactly the **Canonical types** block from Global Constraints above (copy it verbatim into this file, all `export`ed).

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/automation/conditions.test.ts`:

```ts
import { expect, test } from 'vitest';
import { matchConditions, selectMatchingRules } from './conditions';
import type { EvalContext, RuleCondition } from './types';

const base: EvalContext = {
  eventKind: 'status-changed',
  ticketTypeKey: 'bug',
  fieldValues: { priority: 'high', assignee: 'ada' },
  changed: { fieldKey: 'status', from: 'in_progress', to: 'done' },
};

test('type eq matches on ticket type', () => {
  expect(matchConditions([{ field: 'type', op: 'eq', value: 'bug' }], base)).toBe(true);
  expect(matchConditions([{ field: 'type', op: 'eq', value: 'task' }], base)).toBe(false);
});

test('status.to eq reads the event delta', () => {
  expect(matchConditions([{ field: 'status.to', op: 'eq', value: 'done' }], base)).toBe(true);
  expect(matchConditions([{ field: 'status.from', op: 'eq', value: 'done' }], base)).toBe(false);
});

test('field eq reads current value; neq inverts; in checks membership', () => {
  expect(matchConditions([{ field: 'priority', op: 'eq', value: 'high' }], base)).toBe(true);
  expect(matchConditions([{ field: 'priority', op: 'neq', value: 'low' }], base)).toBe(true);
  expect(matchConditions([{ field: 'priority', op: 'in', value: ['low', 'high'] }], base)).toBe(true);
  expect(matchConditions([{ field: 'priority', op: 'in', value: ['low'] }], base)).toBe(false);
});

test('changed_to / changed_from / changed key off the changed field', () => {
  const ctx: EvalContext = {
    ...base,
    eventKind: 'value-changed',
    changed: { fieldKey: 'assignee', from: 'ada', to: 'lin' },
  };
  expect(matchConditions([{ field: 'assignee', op: 'changed', value: undefined }], ctx)).toBe(true);
  expect(matchConditions([{ field: 'priority', op: 'changed', value: undefined }], ctx)).toBe(false);
  expect(matchConditions([{ field: 'assignee', op: 'changed_to', value: 'lin' }], ctx)).toBe(true);
  expect(matchConditions([{ field: 'assignee', op: 'changed_from', value: 'ada' }], ctx)).toBe(true);
});

test('empty conditions match everything (AND over nothing)', () => {
  expect(matchConditions([] as RuleCondition[], base)).toBe(true);
});

test('selectMatchingRules filters by trigger then conditions', () => {
  const rules = [
    { id: 1, trigger: 'status-changed' as const, conditions: [{ field: 'status.to', op: 'eq' as const, value: 'done' }] },
    { id: 2, trigger: 'status-changed' as const, conditions: [{ field: 'type', op: 'eq' as const, value: 'task' }] },
    { id: 3, trigger: 'commented' as const, conditions: [] },
  ];
  expect(selectMatchingRules(rules, base).map((r) => r.id)).toEqual([1]);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @tickets/api test conditions`
Expected: FAIL — `conditions.ts` does not exist yet.

- [ ] **Step 4: Implement the evaluator**

Create `apps/api/src/automation/conditions.ts`:

```ts
import type { EvalContext, EventKind, RuleCondition } from './types';

// Resolve the value a condition compares against. `type` and `status.*` are
// special tokens; anything else is a current field value.
function resolveField(field: string, ctx: EvalContext): unknown {
  if (field === 'type') return ctx.ticketTypeKey;
  if (field === 'status.to') return ctx.changed.to;
  if (field === 'status.from') return ctx.changed.from;
  return ctx.fieldValues[field];
}

export function matchCondition(cond: RuleCondition, ctx: EvalContext): boolean {
  switch (cond.op) {
    case 'eq':
      return resolveField(cond.field, ctx) === cond.value;
    case 'neq':
      return resolveField(cond.field, ctx) !== cond.value;
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(resolveField(cond.field, ctx));
    case 'changed':
      return ctx.changed.fieldKey === cond.field;
    case 'changed_to':
      return ctx.changed.fieldKey === cond.field && ctx.changed.to === cond.value;
    case 'changed_from':
      return ctx.changed.fieldKey === cond.field && ctx.changed.from === cond.value;
    default:
      return false;
  }
}

export function matchConditions(conds: RuleCondition[], ctx: EvalContext): boolean {
  return conds.every((cond) => matchCondition(cond, ctx));
}

// Pure rule selection: trigger must equal the event kind, then all conditions
// must hold. Generic over any row shape carrying trigger + conditions.
export function selectMatchingRules<R extends { trigger: EventKind; conditions: RuleCondition[] }>(
  rules: R[],
  ctx: EvalContext,
): R[] {
  return rules.filter((rule) => rule.trigger === ctx.eventKind && matchConditions(rule.conditions, ctx));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @tickets/api test conditions`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/automation/types.ts apps/api/src/automation/conditions.ts apps/api/src/automation/conditions.test.ts
git commit -m "feat(api): automation types + pure condition evaluator"
```

---

## Task 6: Template rendering (pure, TDD)

**Files:**
- Create: `apps/api/src/automation/template.ts`
- Test: `apps/api/src/automation/template.test.ts`

**Interfaces:**
- Produces: `type TemplateContext = { ticketKey: string; from: unknown; to: unknown }`; `renderTemplate(tpl, ctx): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/automation/template.test.ts`:

```ts
import { expect, test } from 'vitest';
import { renderTemplate } from './template';

const ctx = { ticketKey: 'TIX-90', from: 'in_progress', to: 'done' };

test('substitutes known tokens', () => {
  expect(renderTemplate('{{ticket.key}} moved {{event.from}}→{{event.to}}', ctx)).toBe(
    'TIX-90 moved in_progress→done',
  );
});

test('unknown tokens render empty; literal text preserved', () => {
  expect(renderTemplate('hi {{nope}} there', ctx)).toBe('hi  there');
});

test('null delta renders empty string', () => {
  expect(renderTemplate('[{{event.to}}]', { ticketKey: 'X-1', from: null, to: null })).toBe('[]');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/api test template`
Expected: FAIL — `template.ts` missing.

- [ ] **Step 3: Implement**

Create `apps/api/src/automation/template.ts`:

```ts
export type TemplateContext = { ticketKey: string; from: unknown; to: unknown };

const TOKENS: Record<string, (ctx: TemplateContext) => unknown> = {
  'ticket.key': (ctx) => ctx.ticketKey,
  'event.from': (ctx) => ctx.from,
  'event.to': (ctx) => ctx.to,
};

// Minimal {{token}} substitution. Unknown tokens and null/undefined values
// render as the empty string, so a template never leaks "undefined".
export function renderTemplate(tpl: string, ctx: TemplateContext): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token: string) => {
    const resolver = TOKENS[token];
    const value = resolver ? resolver(ctx) : undefined;
    return value === undefined || value === null ? '' : String(value);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/api test template`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/automation/template.ts apps/api/src/automation/template.test.ts
git commit -m "feat(api): automation comment/webhook template rendering"
```

---

## Task 7: Backoff + depth-cap constants (pure, TDD)

**Files:**
- Create: `apps/api/src/automation/limits.ts`
- Test: `apps/api/src/automation/limits.test.ts`

**Interfaces:**
- Produces: `MAX_ATTEMPTS = 5`, `DEPTH_CAP = 5`, `nextBackoffMs(attempts): number`, `isOverDepthCap(depth): boolean`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/automation/limits.test.ts`:

```ts
import { expect, test } from 'vitest';
import { DEPTH_CAP, isOverDepthCap, MAX_ATTEMPTS, nextBackoffMs } from './limits';

test('constants', () => {
  expect(MAX_ATTEMPTS).toBe(5);
  expect(DEPTH_CAP).toBe(5);
});

test('backoff grows exponentially and is capped', () => {
  expect(nextBackoffMs(1)).toBe(1000);
  expect(nextBackoffMs(2)).toBe(2000);
  expect(nextBackoffMs(3)).toBe(4000);
  expect(nextBackoffMs(10)).toBe(60000); // capped at 60s
});

test('depth cap boundary', () => {
  expect(isOverDepthCap(DEPTH_CAP)).toBe(false);
  expect(isOverDepthCap(DEPTH_CAP + 1)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/api test limits`
Expected: FAIL — `limits.ts` missing.

- [ ] **Step 3: Implement**

Create `apps/api/src/automation/limits.ts`:

```ts
export const MAX_ATTEMPTS = 5;
export const DEPTH_CAP = 5;

const BASE_MS = 1000;
const MAX_MS = 60000;

// Exponential backoff: 1s, 2s, 4s, … capped at 60s. `attempts` is the attempt
// number about to be scheduled (1-based).
export function nextBackoffMs(attempts: number): number {
  return Math.min(MAX_MS, BASE_MS * 2 ** (attempts - 1));
}

export function isOverDepthCap(depth: number): boolean {
  return depth > DEPTH_CAP;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/api test limits`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/automation/limits.ts apps/api/src/automation/limits.test.ts
git commit -m "feat(api): automation backoff + depth-cap limits"
```

---

## Task 8: Action runner with injected effects (pure, TDD)

**Files:**
- Create: `apps/api/src/automation/actions.ts`
- Test: `apps/api/src/automation/actions.test.ts`

**Interfaces:**
- Produces: `type ActionEffects`; `runActions(actions, effects, tctx, prior?): Promise<RunOutcome>`.
- Consumes: `renderTemplate` (Task 6), types (Task 5).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/automation/actions.test.ts`:

```ts
import { expect, test, vi } from 'vitest';
import { runActions } from './actions';
import type { ActionEffects } from './actions';
import type { ExecutionResult, RuleAction } from './types';

function makeEffects(overrides: Partial<ActionEffects> = {}): ActionEffects {
  return {
    addComment: vi.fn(async () => {}),
    setField: vi.fn(async () => {}),
    changeStatus: vi.fn(async () => {}),
    sendWebhook: vi.fn(async () => {}),
    ...overrides,
  };
}

const tctx = { ticketKey: 'TIX-90', from: 'a', to: 'b' };

test('runs actions in order, renders templates, reports ok', async () => {
  const effects = makeEffects();
  const actions: RuleAction[] = [
    { type: 'add_comment', params: { body: '{{ticket.key}} done' } },
    { type: 'set_field', params: { fieldKey: 'priority', value: 'high' } },
  ];
  const outcome = await runActions(actions, effects, tctx);
  expect(outcome.ok).toBe(true);
  expect(effects.addComment).toHaveBeenCalledWith('TIX-90 done');
  expect(effects.setField).toHaveBeenCalledWith('priority', 'high');
  expect(outcome.result.actions).toEqual([
    { type: 'add_comment', ok: true },
    { type: 'set_field', ok: true },
  ]);
});

test('a throwing effect stops the run and records the error', async () => {
  const effects = makeEffects({
    changeStatus: vi.fn(async () => {
      throw new Error('transition not allowed');
    }),
  });
  const actions: RuleAction[] = [
    { type: 'change_status', params: { statusKey: 'done' } },
    { type: 'add_comment', params: { body: 'after' } },
  ];
  const outcome = await runActions(actions, effects, tctx);
  expect(outcome.ok).toBe(false);
  expect(outcome.error).toBe('transition not allowed');
  expect(effects.addComment).not.toHaveBeenCalled();
  expect(outcome.result.actions[0]).toEqual({
    type: 'change_status',
    ok: false,
    detail: 'transition not allowed',
  });
});

test('prior successes are skipped on retry (at-least-once safety)', async () => {
  const effects = makeEffects();
  const actions: RuleAction[] = [
    { type: 'add_comment', params: { body: 'once' } },
    { type: 'send_webhook', params: { url: 'http://x', template: '{{ticket.key}}' } },
  ];
  const prior: ExecutionResult = { actions: [{ type: 'add_comment', ok: true }] };
  const outcome = await runActions(actions, effects, tctx, prior);
  expect(outcome.ok).toBe(true);
  expect(effects.addComment).not.toHaveBeenCalled(); // skipped
  expect(effects.sendWebhook).toHaveBeenCalledWith('http://x', 'TIX-90');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tickets/api test actions`
Expected: FAIL — `actions.ts` missing.

- [ ] **Step 3: Implement**

Create `apps/api/src/automation/actions.ts`:

```ts
import { renderTemplate, type TemplateContext } from './template';
import type { ActionOutcome, ExecutionResult, RuleAction, RunOutcome } from './types';

// The side effects the runner is allowed to cause. The DB-backed implementation
// lives in effects.ts; tests pass spies.
export type ActionEffects = {
  addComment(body: string): Promise<void>;
  setField(fieldKey: string, value: unknown): Promise<void>;
  changeStatus(statusKey: string): Promise<void>;
  sendWebhook(url: string, body: string): Promise<void>;
};

async function runOne(action: RuleAction, effects: ActionEffects, tctx: TemplateContext): Promise<void> {
  switch (action.type) {
    case 'add_comment':
      return effects.addComment(renderTemplate(action.params.body, tctx));
    case 'set_field':
      return effects.setField(action.params.fieldKey, action.params.value);
    case 'change_status':
      return effects.changeStatus(action.params.statusKey);
    case 'send_webhook':
      return effects.sendWebhook(action.params.url, renderTemplate(action.params.template, tctx));
  }
}

// Runs actions in order. Actions already marked ok in `prior` are skipped so a
// retry doesn't repeat committed side effects. Stops at the first failure and
// reports it; earlier successes are preserved in the result.
export async function runActions(
  actions: RuleAction[],
  effects: ActionEffects,
  tctx: TemplateContext,
  prior?: ExecutionResult,
): Promise<RunOutcome> {
  const outcomes: ActionOutcome[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    if (prior?.actions[i]?.ok) {
      outcomes.push(prior.actions[i]!);
      continue;
    }
    try {
      await runOne(action, effects, tctx);
      outcomes.push({ type: action.type, ok: true });
    } catch (error) {
      const message = (error as Error).message;
      outcomes.push({ type: action.type, ok: false, detail: message });
      return { result: { actions: outcomes }, ok: false, error: message };
    }
  }
  return { result: { actions: outcomes }, ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tickets/api test actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/automation/actions.ts apps/api/src/automation/actions.test.ts
git commit -m "feat(api): automation action runner with injected effects"
```

---

## Task 9: DB-backed effects + automation actor

**Files:**
- Create: `apps/api/src/automation/effects.ts`

**Interfaces:**
- Produces: `getAutomationActorId(tx): Promise<number>`; `buildEffects(tx, { vocab, ticket, actorId, depth, causedByExecutionId }): ActionEffects`.
- Consumes: `addComment` (Task 3), `applyFieldValue` (Task 4), `ActionEffects` (Task 8).

- [ ] **Step 1: Implement effects**

Create `apps/api/src/automation/effects.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { tickets, users } from '@tickets/db';
import { addComment } from '../comments/add-comment';
import { applyFieldValue } from '../tickets/apply-field-value';
import type { ProjectVocab } from '../vocab/load-project-vocab';
import type { ActionEffects } from './actions';

// The automation actor owns every action-generated write. Looked up by name and
// created on first use (kind 'agent') so seeding order never matters.
export async function getAutomationActorId(tx: DbExecutor): Promise<number> {
  const existing = await tx.select({ id: users.id }).from(users).where(eq(users.name, 'Automation'));
  if (existing[0]) return existing[0].id;
  const inserted = await tx
    .insert(users)
    .values({ name: 'Automation', kind: 'agent' })
    .returning({ id: users.id });
  if (!inserted[0]) throw new Error('could not create Automation user');
  return inserted[0].id;
}

type TicketRow = typeof tickets.$inferSelect;

function statusFieldKey(vocab: ProjectVocab): string {
  const field = vocab.fields.find((f) => f.type === 'status');
  if (!field) throw new Error('project has no status field');
  return field.key;
}

// Bind the pure action runner's effects to a transaction + ticket context.
// depth/causedByExecutionId are threaded into every emitted event for loop safety.
export function buildEffects(
  tx: DbExecutor,
  ctx: {
    vocab: ProjectVocab;
    ticket: TicketRow;
    actorId: number;
    depth: number;
    causedByExecutionId: number;
  },
): ActionEffects {
  const { vocab, ticket, actorId, depth, causedByExecutionId } = ctx;
  return {
    addComment: async (body) => {
      await addComment(tx, { ticketId: ticket.id, authorId: actorId, body, depth, causedByExecutionId });
    },
    setField: (fieldKey, value) =>
      applyFieldValue(tx, {
        vocab,
        ticketId: ticket.id,
        typeId: ticket.typeId,
        fieldKey,
        value,
        actorId,
        depth,
        causedByExecutionId,
      }),
    changeStatus: (statusKey) =>
      applyFieldValue(tx, {
        vocab,
        ticketId: ticket.id,
        typeId: ticket.typeId,
        fieldKey: statusFieldKey(vocab),
        value: statusKey,
        actorId,
        depth,
        causedByExecutionId,
      }),
    sendWebhook: async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      if (!response.ok) {
        throw new Error(`webhook POST ${url} → ${response.status}`);
      }
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/automation/effects.ts
git commit -m "feat(api): DB-backed automation effects + Automation actor"
```

---

## Task 10: Fan-out pass

**Files:**
- Create: `apps/api/src/automation/eval-context.ts`
- Create: `apps/api/src/automation/fanout.ts`

**Interfaces:**
- Produces: `buildEvalContext(event, ticket, vocab, fieldValues): EvalContext`; `loadFieldValues(db, vocab, ticketId): Promise<Record<string, unknown>>`; `runFanout(db): Promise<number>` (returns events processed).
- Consumes: `selectMatchingRules`, `isOverDepthCap`, schema tables.

- [ ] **Step 1: Build the eval-context helpers**

Create `apps/api/src/automation/eval-context.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { ticketEvents, ticketValues, tickets } from '@tickets/db';
import { renderValue } from '../tickets/render-value';
import type { ProjectVocab } from '../vocab/load-project-vocab';
import type { EvalContext, EventKind } from './types';

type EventRow = typeof ticketEvents.$inferSelect;
type TicketRow = typeof tickets.$inferSelect;

// Current rendered field values for a ticket, keyed by field key.
export async function loadFieldValues(
  db: Db,
  vocab: ProjectVocab,
  ticketId: number,
): Promise<Record<string, unknown>> {
  const rows = await db.select().from(ticketValues).where(eq(ticketValues.ticketId, ticketId));
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const field = vocab.fieldById.get(row.fieldId);
    if (!field) continue;
    const rendered = renderValue(vocab, row);
    if (field.type === 'multi_select') {
      const bucket = (out[field.key] as unknown[]) ?? [];
      bucket.push(rendered);
      out[field.key] = bucket;
    } else {
      out[field.key] = rendered;
    }
  }
  return out;
}

export function buildEvalContext(
  event: EventRow,
  ticket: TicketRow,
  vocab: ProjectVocab,
  fieldValues: Record<string, unknown>,
): EvalContext {
  const payload = (event.payload ?? {}) as { fieldKey?: string; from?: unknown; to?: unknown };
  return {
    eventKind: event.kind as EventKind,
    ticketTypeKey: vocab.typeById.get(ticket.typeId)?.key ?? '',
    fieldValues,
    changed: {
      fieldKey: payload.fieldKey ?? null,
      from: payload.from ?? null,
      to: payload.to ?? null,
    },
  };
}
```

- [ ] **Step 2: Implement fan-out**

Create `apps/api/src/automation/fanout.ts`:

```ts
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { automationRules, ruleExecutions, ticketEvents, tickets } from '@tickets/db';
import { loadProjectVocab } from '../vocab/load-project-vocab';
import { buildEvalContext, loadFieldValues } from './eval-context';
import { isOverDepthCap } from './limits';
import { selectMatchingRules } from './conditions';
import type { EventKind, RuleCondition } from './types';

const BATCH = 100;

// Pass 1: for each undispatched event, insert one rule_execution per matching
// enabled rule, then mark the event dispatched. Over-depth events get 'skipped'
// executions instead of 'pending' — recorded, never dropped. Idempotent via the
// unique (rule_id, event_id) index.
export async function runFanout(db: Db): Promise<number> {
  const events = await db
    .select()
    .from(ticketEvents)
    .where(isNull(ticketEvents.dispatchedAt))
    .orderBy(asc(ticketEvents.id))
    .limit(BATCH);

  for (const event of events) {
    const ticketRows = await db.select().from(tickets).where(eq(tickets.id, event.ticketId));
    const ticket = ticketRows[0];
    if (!ticket) {
      await db.update(ticketEvents).set({ dispatchedAt: sql`now()` }).where(eq(ticketEvents.id, event.id));
      continue;
    }
    const vocab = await loadProjectVocab(db, { id: ticket.projectId });
    const rules = await db
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.projectId, ticket.projectId),
          eq(automationRules.enabled, true),
          eq(automationRules.trigger, event.kind),
        ),
      );
    const fieldValues = await loadFieldValues(db, vocab, ticket.id);
    const ctx = buildEvalContext(event, ticket, vocab, fieldValues);
    const matched = selectMatchingRules(
      rules.map((r) => ({
        ...r,
        trigger: r.trigger as EventKind,
        conditions: r.conditions as RuleCondition[],
      })),
      ctx,
    );

    // Loop guard #3: a rule never fires on an event it directly caused. The
    // event carries caused_by_execution_id; exclude that execution's rule.
    let excludedRuleId: number | null = null;
    if (event.causedByExecutionId != null) {
      const parent = await db
        .select({ ruleId: ruleExecutions.ruleId })
        .from(ruleExecutions)
        .where(eq(ruleExecutions.id, event.causedByExecutionId));
      excludedRuleId = parent[0]?.ruleId ?? null;
    }
    const finalMatched = matched.filter((rule) => rule.id !== excludedRuleId);
    const over = isOverDepthCap(event.depth);

    await db.transaction(async (tx) => {
      for (const rule of finalMatched) {
        await tx
          .insert(ruleExecutions)
          .values({
            ruleId: rule.id,
            eventId: event.id,
            ticketId: event.ticketId,
            status: over ? 'skipped' : 'pending',
            lastError: over ? 'depth cap exceeded' : null,
            result: over ? { actions: [] } : null,
            finishedAt: over ? sql`now()` : null,
          })
          .onConflictDoNothing();
      }
      await tx.update(ticketEvents).set({ dispatchedAt: sql`now()` }).where(eq(ticketEvents.id, event.id));
    });
  }
  return events.length;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/automation/eval-context.ts apps/api/src/automation/fanout.ts
git commit -m "feat(api): automation fan-out pass"
```

---

## Task 11: Execute pass

**Files:**
- Create: `apps/api/src/automation/execute.ts`

**Interfaces:**
- Produces: `runExecute(db): Promise<number>` (returns executions processed).
- Consumes: `buildEffects`, `getAutomationActorId`, `runActions`, `MAX_ATTEMPTS`, `nextBackoffMs`.

- [ ] **Step 1: Implement execute**

Create `apps/api/src/automation/execute.ts`:

```ts
import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { automationRules, ruleExecutions, ticketEvents, tickets } from '@tickets/db';
import { loadProjectVocab } from '../vocab/load-project-vocab';
import { runActions } from './actions';
import { buildEffects, getAutomationActorId } from './effects';
import { MAX_ATTEMPTS, nextBackoffMs } from './limits';
import type { ExecutionResult, RuleAction } from './types';

const BATCH = 50;

type ExecRow = typeof ruleExecutions.$inferSelect;

// Pass 2: run due executions. Single-flight caller ⇒ no execution is legitimately
// 'running' between ticks, so reclaim any stragglers first.
export async function runExecute(db: Db): Promise<number> {
  await db.update(ruleExecutions).set({ status: 'pending' }).where(eq(ruleExecutions.status, 'running'));

  const due = await db
    .select()
    .from(ruleExecutions)
    .where(
      and(
        eq(ruleExecutions.status, 'pending'),
        or(isNull(ruleExecutions.nextAttemptAt), lte(ruleExecutions.nextAttemptAt, sql`now()`)),
      ),
    )
    .orderBy(asc(ruleExecutions.id))
    .limit(BATCH);

  for (const exec of due) {
    await processExecution(db, exec);
  }
  return due.length;
}

async function processExecution(db: Db, exec: ExecRow): Promise<void> {
  await db
    .update(ruleExecutions)
    .set({ status: 'running', startedAt: sql`now()` })
    .where(eq(ruleExecutions.id, exec.id));

  try {
    const ruleRows = await db.select().from(automationRules).where(eq(automationRules.id, exec.ruleId));
    const eventRows = await db.select().from(ticketEvents).where(eq(ticketEvents.id, exec.eventId));
    const ticketRows = await db.select().from(tickets).where(eq(tickets.id, exec.ticketId));
    const rule = ruleRows[0];
    const event = eventRows[0];
    const ticket = ticketRows[0];

    if (!rule || !rule.enabled || !event || !ticket) {
      await db
        .update(ruleExecutions)
        .set({ status: 'skipped', finishedAt: sql`now()`, lastError: 'rule or ticket missing/disabled' })
        .where(eq(ruleExecutions.id, exec.id));
      return;
    }

    const vocab = await loadProjectVocab(db, { id: ticket.projectId });
    const payload = (event.payload ?? {}) as { from?: unknown; to?: unknown };
    const tctx = {
      ticketKey: `${vocab.project.ticketPrefix}-${ticket.number}`,
      from: payload.from ?? null,
      to: payload.to ?? null,
    };
    const prior = (exec.result as ExecutionResult | null) ?? undefined;

    const outcome = await db.transaction(async (tx) => {
      const actorId = await getAutomationActorId(tx);
      const effects = buildEffects(tx, {
        vocab,
        ticket,
        actorId,
        depth: event.depth + 1,
        causedByExecutionId: exec.id,
      });
      return runActions(rule.actions as RuleAction[], effects, tctx, prior);
    });

    if (outcome.ok) {
      await db
        .update(ruleExecutions)
        .set({ status: 'done', result: outcome.result, finishedAt: sql`now()`, lastError: null })
        .where(eq(ruleExecutions.id, exec.id));
    } else {
      await scheduleRetry(db, exec, outcome.result, outcome.error ?? 'action failed');
    }
  } catch (error) {
    // Unexpected failure (vocab load, connection) — treat as transient.
    await scheduleRetry(db, exec, (exec.result as ExecutionResult | null) ?? { actions: [] }, (error as Error).message);
  }
}

async function scheduleRetry(db: Db, exec: ExecRow, result: ExecutionResult, message: string): Promise<void> {
  const attempts = exec.attempts + 1;
  const terminal = attempts >= MAX_ATTEMPTS;
  await db
    .update(ruleExecutions)
    .set({
      status: terminal ? 'failed' : 'pending',
      attempts,
      result,
      lastError: message,
      nextAttemptAt: terminal ? null : new Date(Date.now() + nextBackoffMs(attempts)).toISOString(),
      finishedAt: terminal ? sql`now()` : null,
    })
    .where(eq(ruleExecutions.id, exec.id));
}
```

Note: when `runActions` reports a business failure it does **not** throw, so the transaction commits any earlier successful action + we persist the partial `result`. Only unexpected throws roll the transaction back and hit the outer `catch`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/automation/execute.ts
git commit -m "feat(api): automation execute pass with retry/backoff"
```

---

## Task 12: Dispatcher loop + server wiring

**Files:**
- Create: `apps/api/src/automation/dispatcher.ts`
- Modify: `apps/api/src/server.ts`

**Interfaces:**
- Produces: `startDispatcher(db, intervalMs?): () => void` (returns a stop function).

- [ ] **Step 1: Implement the dispatcher**

Create `apps/api/src/automation/dispatcher.ts`:

```ts
import type { Db } from '@tickets/db';
import { runExecute } from './execute';
import { runFanout } from './fanout';

// Single-flight polling loop: a tick never overlaps the previous one. Fan-out
// then execute, each pass swallowing its own errors so one bad event never
// wedges the loop.
export function startDispatcher(db: Db, intervalMs = 1000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runFanout(db);
      await runExecute(db);
    } catch (error) {
      console.error('[dispatcher] tick failed', error);
    } finally {
      running = false;
    }
  };
  const handle = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(handle);
}
```

- [ ] **Step 2: Start it from the server**

Replace `apps/api/src/server.ts` with:

```ts
import { createDbClient } from '@tickets/db';
import { buildApp } from './app';
import { startDispatcher } from './automation/dispatcher';
import { environment } from './environment';

const { db } = createDbClient();
const app = buildApp({ db });

await app.listen({ port: environment.apiPort, host: environment.apiHost });
startDispatcher(db);
console.log(`tickets api listening on http://${environment.apiHost}:${environment.apiPort}`);
console.log('automation dispatcher started');
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS.

- [ ] **Step 4: Boot smoke**

Start the API (`pnpm --filter @tickets/api dev`) and confirm it logs `automation dispatcher started` and stays up with no errors for ~5 seconds.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/automation/dispatcher.ts apps/api/src/server.ts
git commit -m "feat(api): start automation dispatcher with the API"
```

---

## Task 13: Rule validation schemas + CRUD/executions routes

**Files:**
- Create: `apps/api/src/automation/rule-validation.ts`
- Create: `apps/api/src/routes/automations.routes.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces routes: `GET/POST /api/projects/:key/rules`, `GET/PATCH/DELETE /api/rules/:id`, `GET /api/rules/:id/executions`, `GET /api/projects/:key/rule-executions`.
- Consumes: `parseBody`, `HttpError`, schema tables.

- [ ] **Step 1: Validation schemas**

Create `apps/api/src/automation/rule-validation.ts`:

```ts
import * as v from 'valibot';

const EVENT_KINDS = [
  'created',
  'status-changed',
  'value-changed',
  'parent-changed',
  'commented',
  'archived',
  'unarchived',
] as const;

const conditionSchema = v.object({
  field: v.pipe(v.string(), v.minLength(1)),
  op: v.picklist(['eq', 'neq', 'in', 'changed', 'changed_to', 'changed_from']),
  value: v.optional(v.unknown()),
});

const actionSchema = v.variant('type', [
  v.object({ type: v.literal('add_comment'), params: v.object({ body: v.pipe(v.string(), v.minLength(1)) }) }),
  v.object({
    type: v.literal('set_field'),
    params: v.object({ fieldKey: v.pipe(v.string(), v.minLength(1)), value: v.unknown() }),
  }),
  v.object({
    type: v.literal('change_status'),
    params: v.object({ statusKey: v.pipe(v.string(), v.minLength(1)) }),
  }),
  v.object({
    type: v.literal('send_webhook'),
    params: v.object({ url: v.pipe(v.string(), v.url()), template: v.string() }),
  }),
]);

export const createRuleSchema = v.object({
  actorId: v.pipe(v.number(), v.integer()),
  name: v.pipe(v.string(), v.minLength(1)),
  trigger: v.picklist(EVENT_KINDS),
  enabled: v.optional(v.boolean()),
  conditions: v.array(conditionSchema),
  actions: v.pipe(v.array(actionSchema), v.minLength(1)),
});

export const patchRuleSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
  trigger: v.optional(v.picklist(EVENT_KINDS)),
  enabled: v.optional(v.boolean()),
  conditions: v.optional(v.array(conditionSchema)),
  actions: v.optional(v.pipe(v.array(actionSchema), v.minLength(1))),
});
```

- [ ] **Step 2: Routes**

Create `apps/api/src/routes/automations.routes.ts`:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { count, desc, eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { automationRules, projects, ruleExecutions } from '@tickets/db';
import { HttpError } from '../errors';
import { createRuleSchema, patchRuleSchema } from '../automation/rule-validation';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';

async function projectByKey(db: Db, key: string) {
  const rows = await db.select().from(projects).where(eq(projects.key, key));
  if (!rows[0]) throw new HttpError(404, `unknown project "${key}"`);
  return rows[0];
}

export function registerAutomationsRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const listRules = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const project = await projectByKey(db, key);
    const rows = await db
      .select()
      .from(automationRules)
      .where(eq(automationRules.projectId, project.id))
      .orderBy(desc(automationRules.createdAt));
    reply.send({ data: rows });
  };

  const createRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const project = await projectByKey(db, key);
    const body = parseBody(createRuleSchema, request.body);
    const inserted = await db
      .insert(automationRules)
      .values({
        projectId: project.id,
        name: body.name,
        trigger: body.trigger,
        enabled: body.enabled ?? true,
        conditions: body.conditions,
        actions: body.actions,
        createdBy: body.actorId,
      })
      .returning();
    reply.status(201).send(inserted[0]);
  };

  const getRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const rows = await db.select().from(automationRules).where(eq(automationRules.id, id));
    if (!rows[0]) throw new HttpError(404, 'rule not found');
    reply.send(rows[0]);
  };

  const patchRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchRuleSchema, request.body);
    const updated = await db
      .update(automationRules)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(automationRules.id, id))
      .returning();
    if (!updated[0]) throw new HttpError(404, 'rule not found');
    reply.send(updated[0]);
  };

  const deleteRule = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    // executions reference the rule; drop them first to satisfy the FK
    await db.delete(ruleExecutions).where(eq(ruleExecutions.ruleId, id));
    const deleted = await db.delete(automationRules).where(eq(automationRules.id, id)).returning({ id: automationRules.id });
    if (!deleted[0]) throw new HttpError(404, 'rule not found');
    reply.status(204).send();
  };

  const listRuleExecutions = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const query = request.query as { take?: string };
    const take = Math.min(200, Math.max(1, Number(query.take ?? 50) || 50));
    const rows = await db
      .select()
      .from(ruleExecutions)
      .where(eq(ruleExecutions.ruleId, id))
      .orderBy(desc(ruleExecutions.id))
      .limit(take);
    reply.send({ data: rows });
  };

  const listProjectExecutions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const project = await projectByKey(db, key);
    const query = request.query as { take?: string };
    const take = Math.min(200, Math.max(1, Number(query.take ?? 50) || 50));
    const [rows, total] = await Promise.all([
      db
        .select({
          id: ruleExecutions.id,
          ruleId: ruleExecutions.ruleId,
          ruleName: automationRules.name,
          ticketId: ruleExecutions.ticketId,
          status: ruleExecutions.status,
          attempts: ruleExecutions.attempts,
          lastError: ruleExecutions.lastError,
          finishedAt: ruleExecutions.finishedAt,
          createdAt: ruleExecutions.createdAt,
        })
        .from(ruleExecutions)
        .innerJoin(automationRules, eq(automationRules.id, ruleExecutions.ruleId))
        .where(eq(automationRules.projectId, project.id))
        .orderBy(desc(ruleExecutions.id))
        .limit(take),
      db
        .select({ value: count() })
        .from(ruleExecutions)
        .innerJoin(automationRules, eq(automationRules.id, ruleExecutions.ruleId))
        .where(eq(automationRules.projectId, project.id)),
    ]);
    reply.send({ data: rows, meta: { take, total: total[0]?.value ?? 0 } });
  };

  app.get('/api/projects/:key/rules', listRules);
  app.post('/api/projects/:key/rules', createRule);
  app.get('/api/rules/:id', getRule);
  app.patch('/api/rules/:id', patchRule);
  app.delete('/api/rules/:id', deleteRule);
  app.get('/api/rules/:id/executions', listRuleExecutions);
  app.get('/api/projects/:key/rule-executions', listProjectExecutions);
}
```

- [ ] **Step 3: Register the routes**

In `apps/api/src/app.ts`, add the import and registration alongside the others:

```ts
import { registerAutomationsRoutes } from './routes/automations.routes';
// … inside buildApp, after registerVocabularyRoutes(app, context):
  registerAutomationsRoutes(app, context);
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: PASS. Remove any import the compiler reports as unused.

- [ ] **Step 5: Manual smoke — CRUD**

With the stack running, create a rule and list it:

```bash
curl -s -X POST localhost:4600/api/projects/tickets/rules -H 'content-type: application/json' \
  -d '{"actorId":1,"name":"comment on done","trigger":"status-changed","conditions":[{"field":"status.to","op":"eq","value":"done"}],"actions":[{"type":"add_comment","params":{"body":"auto: {{ticket.key}} is done"}}]}'
curl -s localhost:4600/api/projects/tickets/rules
```

Expected: 201 with the rule JSON, then a list containing it.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/automation/rule-validation.ts apps/api/src/routes/automations.routes.ts apps/api/src/app.ts
git commit -m "feat(api): automation rules CRUD + executions endpoints"
```

---

## Task 14: End-to-end verification (manual, documented)

**Files:** none (verification task). Uses the `running-the-stack` skill.

**Interfaces:** Consumes everything above. No code produced.

- [ ] **Step 1: Bring up the stack**

Follow `running-the-stack`: `docker compose up -d`, migrate (`pnpm --filter @tickets/db db:migrate`), and run the API with the dispatcher (`pnpm --filter @tickets/api dev`).

- [ ] **Step 2: Happy path**

Create the "comment on done" rule from Task 13 Step 5. Then move a ticket in project `tickets` to its done status via PATCH (fetch the ticket first for `expectedUpdatedAt` and the correct status key). Within ~2 seconds:
- Confirm a new comment `auto: TIX-… is done` appears on the ticket, authored by **Automation**.
- Confirm an execution row: `curl -s localhost:4600/api/projects/tickets/rule-executions` shows one row `status: "done"`.

- [ ] **Step 3: Failure path (illegal transition, logged)**

Create a rule `trigger: created`, one action `change_status` to a status that is NOT a legal entry transition for the type. Create a ticket of that type. Confirm within a few seconds the execution ends `status: "failed"` with `lastError` describing the illegal transition, and the ticket's status is unchanged. (With `MAX_ATTEMPTS=5` it will retry a few times first — confirm `attempts` climbs then lands on `failed`.)

- [ ] **Step 4a: Loop guard #3 — direct self-causation (one run only)**

Create a single self-referential rule: `trigger: commented`, action `add_comment` body `echo {{ticket.key}}`. Add one manual comment to a ticket. Confirm **exactly one** `done` execution results — the comment the rule itself emitted does NOT re-trigger the same rule (guard #3). Delete this rule afterward.

- [ ] **Step 4b: Loop guard #2 — depth cap on a mutual cycle (skipped)**

Create two rules that trigger each other: `R-ping` (`trigger: commented`, `add_comment` body `ping`) and `R-pong` (`trigger: commented`, `add_comment` body `pong`). Add one manual comment. Each rule's comment triggers the *other* (guard #3 only blocks self, not cross-rule), so the depth climbs each hop. Confirm `rule-executions` shows a bounded burst of `done` rows then `skipped` rows (`lastError: "depth cap exceeded"`) — the cycle terminates at depth 5, never unbounded. Delete both rules afterward.

- [ ] **Step 5: Record the result**

If all three paths behave as described, note it in the PR/commit description. If not, fix the offending task before proceeding. No commit for this task unless a fix was needed.

---

## Task 15: Web API hooks + types

**Files:**
- Modify: `apps/web/src/api/types.ts`
- Create: `apps/web/src/api/use-rules.ts`
- Create: `apps/web/src/api/use-create-rule.ts`
- Create: `apps/web/src/api/use-update-rule.ts`
- Create: `apps/web/src/api/use-delete-rule.ts`
- Create: `apps/web/src/api/use-rule-executions.ts`

**Interfaces:**
- Produces: query/mutation hooks + the shared types the settings UI consumes.
- Consumes: `fetchJson` (`apps/web/src/api/client.ts`).

- [ ] **Step 1: Add types**

Append to `apps/web/src/api/types.ts`:

```ts
export type EventKind =
  | 'created' | 'status-changed' | 'value-changed'
  | 'parent-changed' | 'commented' | 'archived' | 'unarchived';

export type ConditionOp = 'eq' | 'neq' | 'in' | 'changed' | 'changed_to' | 'changed_from';
export type RuleCondition = { field: string; op: ConditionOp; value?: unknown };

export type RuleAction =
  | { type: 'add_comment'; params: { body: string } }
  | { type: 'set_field'; params: { fieldKey: string; value: unknown } }
  | { type: 'change_status'; params: { statusKey: string } }
  | { type: 'send_webhook'; params: { url: string; template: string } };

export type AutomationRule = {
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

export type CreateRuleInput = {
  projectKey: string;
  actorId: number;
  name: string;
  trigger: EventKind;
  enabled?: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
};

export type UpdateRuleInput = {
  id: number;
  name?: string;
  trigger?: EventKind;
  enabled?: boolean;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
};

export type RuleExecution = {
  id: number;
  ruleId: number;
  ruleName: string;
  ticketId: number;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  attempts: number;
  lastError: string | null;
  finishedAt: string | null;
  createdAt: string;
};
```

- [ ] **Step 2: Query hook — list rules**

Create `apps/web/src/api/use-rules.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { AutomationRule } from './types';

export function useRules(projectKey: string) {
  return useQuery({
    queryKey: ['rules', projectKey],
    queryFn: () => fetchJson<{ data: AutomationRule[] }>(`/api/projects/${projectKey}/rules`),
    select: (response) => response.data,
  });
}
```

- [ ] **Step 3: Mutation hooks**

Create `apps/web/src/api/use-create-rule.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { AutomationRule, CreateRuleInput } from './types';

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRuleInput) => {
      const { projectKey, ...body } = input;
      return fetchJson<AutomationRule>(`/api/projects/${projectKey}/rules`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, input) =>
      queryClient.invalidateQueries({ queryKey: ['rules', input.projectKey] }),
  });
}
```

Create `apps/web/src/api/use-update-rule.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { AutomationRule, UpdateRuleInput } from './types';

export function useUpdateRule(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRuleInput) => {
      const { id, ...body } = input;
      return fetchJson<AutomationRule>(`/api/rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules', projectKey] }),
  });
}
```

Create `apps/web/src/api/use-delete-rule.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';

export function useDeleteRule(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchJson<void>(`/api/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules', projectKey] }),
  });
}
```

- [ ] **Step 4: Executions hook**

Create `apps/web/src/api/use-rule-executions.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { RuleExecution } from './types';

export function useRuleExecutions(projectKey: string, take = 50) {
  return useQuery({
    queryKey: ['rule-executions', projectKey, take],
    queryFn: () =>
      fetchJson<{ data: RuleExecution[]; meta: { total: number } }>(
        `/api/projects/${projectKey}/rule-executions?take=${take}`,
      ),
    refetchInterval: 4000,
  });
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @tickets/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/types.ts apps/web/src/api/use-rules.ts apps/web/src/api/use-create-rule.ts apps/web/src/api/use-update-rule.ts apps/web/src/api/use-delete-rule.ts apps/web/src/api/use-rule-executions.ts
git commit -m "feat(web): automation rules + executions query/mutation hooks"
```

---

## Task 16: Rule editor

**Files:**
- Create: `apps/web/src/components/settings/rule-editor.tsx`

**Interfaces:**
- Produces: `RuleEditor` component (`{ projectKey, rule, onClose }`) — hosted by the Automations tab (Task 17).
- Consumes: `useCreateRule`, `useUpdateRule`, types; the project's dialog/select/input primitives (see `users-settings.tsx` for `Combobox`, `Input`, `Button`).

**REQUIRED SUB-SKILLS for this task:** `mapping-component-states` (new vs edit; add/remove condition rows; add/remove action rows; per-action-type param fields; validation error; submit pending) then `implementing-a-component`.

- [ ] **Step 1: Build the editor**

Create `apps/web/src/components/settings/rule-editor.tsx`. It renders in a dialog (use the same dialog primitive as `new-ticket-dialog.tsx`/`new-project-dialog.tsx` — check those for the exact component) and lets the user set: name (Input), trigger (Combobox over the 7 `EventKind`s), a list of condition rows (`field` Input + `op` Combobox + `value` Input), and a list of action rows (type Combobox + type-specific param inputs). On save it calls `useCreateRule` (when `rule` is null) or `useUpdateRule`. Field/status/option keys can be typed freely for v1 (the API validates existence at execution time and logs failures).

Concrete starting scaffold (wire the actual dialog/primitive imports to match a sibling dialog component):

```tsx
import { useState } from 'react';
import { useCreateRule } from '../../api/use-create-rule';
import { useUpdateRule } from '../../api/use-update-rule';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Combobox } from '../../ui/combobox';
import { useCurrentUser } from '../../state/current-user-context';
import type { AutomationRule, ConditionOp, EventKind, RuleAction, RuleCondition } from '../../api/types';

const TRIGGERS: EventKind[] = [
  'created', 'status-changed', 'value-changed', 'parent-changed', 'commented', 'archived', 'unarchived',
];
const OPS: ConditionOp[] = ['eq', 'neq', 'in', 'changed', 'changed_to', 'changed_from'];
const ACTION_TYPES: RuleAction['type'][] = ['add_comment', 'set_field', 'change_status', 'send_webhook'];

export function RuleEditor({
  projectKey,
  rule,
  onClose,
}: {
  projectKey: string;
  rule: AutomationRule | null;
  onClose: () => void;
}) {
  const createRule = useCreateRule();
  const updateRule = useUpdateRule(projectKey);
  const currentUser = useCurrentUser();

  const [name, setName] = useState(rule?.name ?? '');
  const [trigger, setTrigger] = useState<EventKind>(rule?.trigger ?? 'status-changed');
  const [conditions, setConditions] = useState<RuleCondition[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<RuleAction[]>(
    rule?.actions ?? [{ type: 'add_comment', params: { body: '' } }],
  );
  const [error, setError] = useState('');
  const pending = createRule.isPending || updateRule.isPending;

  const submit = async () => {
    setError('');
    try {
      if (rule) {
        await updateRule.mutateAsync({ id: rule.id, name, trigger, conditions, actions });
      } else {
        await createRule.mutateAsync({
          projectKey,
          actorId: currentUser.id,
          name,
          trigger,
          conditions,
          actions,
        });
      }
      onClose();
    } catch (submitError) {
      setError((submitError as Error).message);
    }
  };

  // … render name Input, trigger Combobox(TRIGGERS), condition rows editor
  //   (field Input, op Combobox(OPS), value Input) with add/remove, action rows
  //   editor (type Combobox(ACTION_TYPES) + per-type param inputs) with add/remove,
  //   an error line, and Save/Cancel buttons calling submit()/onClose().
  //   Follow mapping-component-states for the full matrix.
  return null; // replace with the dialog markup per the sub-skills
}
```

Notes:
- Confirm `useCurrentUser` export name/shape in `apps/web/src/state/current-user-context.tsx`; use whatever it exposes for the acting user id (the composer in other screens passes an actor id).
- The `return null` is a **placeholder you must replace** in this step. The scaffold only shows the state + submit wiring; complete the dialog render before moving on. Strict TS (`noUnusedLocals`) means the file will **not** typecheck until the render consumes every declared piece of state (`name`/`setName`, `trigger`, `conditions`/`setConditions`, `actions`/`setActions`, `error`, `pending`) and every imported primitive (`Button`, `Input`, `Combobox`, `TRIGGERS`, `OPS`, `ACTION_TYPES`). Drive the full render with `mapping-component-states` + `implementing-a-component`.

- [ ] **Step 2: Typecheck the completed editor**

Run: `pnpm --filter @tickets/web typecheck`
Expected: PASS — only after Step 1's render is fully implemented (the literal `return null` scaffold will not pass). Full browser verification happens in Task 17, where the Automations tab hosts this editor.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/settings/rule-editor.tsx
git commit -m "feat(web): automation rule editor (trigger/conditions/actions)"
```

---

## Task 17: Automations settings tab (list, toggle, delete, executions)

**Files:**
- Create: `apps/web/src/components/settings/automations-settings.tsx`
- Modify: `apps/web/src/components/settings/settings-screen.tsx`

**Interfaces:**
- Consumes: hooks from Task 15; the `RuleEditor` from Task 16; the Instrument UI primitives in `apps/web/src/ui/*` (`Button`, `cn`, etc., as used by `users-settings.tsx`).

**REQUIRED SUB-SKILLS for this task:** `mapping-component-states` (enumerate list/empty/loading/error, toggle pending, delete-confirm, execution statuses) then `implementing-a-component`, and `verifying-a-component` before marking done. The scaffold below is the starting point; the skills drive state coverage and visual parity with `docs/design/06-settings-admin.html`.

- [ ] **Step 1: Build the Automations section (scaffold)**

Create `apps/web/src/components/settings/automations-settings.tsx`. Model structure/classNames on `users-settings.tsx` (raised panel, uppercase header row, composer/rows). Minimum behavior: list rules with an enable/disable toggle and a delete control, a "New rule" button that opens the `RuleEditor` from Task 16, and a collapsible recent-executions table. Starting scaffold:

```tsx
import { useState } from 'react';
import { useRules } from '../../api/use-rules';
import { useUpdateRule } from '../../api/use-update-rule';
import { useDeleteRule } from '../../api/use-delete-rule';
import { useRuleExecutions } from '../../api/use-rule-executions';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';
import { RelativeDate } from '../../ui/relative-date';
import type { AutomationRule } from '../../api/types';
import { RuleEditor } from './rule-editor';

export function AutomationsSettings({ projectKey }: { projectKey: string }) {
  const rulesQuery = useRules(projectKey);
  const updateRule = useUpdateRule(projectKey);
  const deleteRule = useDeleteRule(projectKey);
  const executionsQuery = useRuleExecutions(projectKey);
  const [editing, setEditing] = useState<AutomationRule | 'new' | null>(null);

  const rules = rulesQuery.data ?? [];

  return (
    <section className="flex min-h-0 flex-col p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-ink">Automations</h1>
        <span className="font-mono text-meta text-ink-3">
          {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
        </span>
        <span className="flex-1" />
        <Button variant="primary" className="h-8" onClick={() => setEditing('new')}>
          ＋ New rule
        </Button>
      </div>

      <div className="overflow-hidden rounded-panel border border-hairline bg-raised">
        <div className="grid h-9 grid-cols-[1.6fr_1fr_90px_80px] items-center border-b border-hairline bg-app px-1 font-sans text-label font-medium uppercase text-ink-2">
          <span className="px-3">Rule</span>
          <span className="px-2">Trigger</span>
          <span className="px-2">Enabled</span>
          <span className="px-2">Actions</span>
        </div>
        {rules.length === 0 ? (
          <p className="m-0 px-4 py-6 text-center font-sans text-meta text-ink-3">No rules yet.</p>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'grid h-11 grid-cols-[1.6fr_1fr_90px_80px] items-center border-b border-hairline px-1',
                !rule.enabled && 'opacity-60',
              )}
            >
              <button
                type="button"
                className="truncate px-3 text-left font-sans text-ui font-medium text-ink hover:underline"
                onClick={() => setEditing(rule)}
              >
                {rule.name}
              </button>
              <span className="px-2 font-mono text-[11px] text-ink-2">{rule.trigger}</span>
              <span className="px-2">
                <button
                  type="button"
                  className="font-mono text-[11px] text-accent hover:underline"
                  disabled={updateRule.isPending}
                  onClick={() => updateRule.mutate({ id: rule.id, enabled: !rule.enabled })}
                >
                  {rule.enabled ? 'on' : 'off'}
                </button>
              </span>
              <span className="px-2">
                <button
                  type="button"
                  className="font-mono text-[11px] text-danger hover:underline"
                  disabled={deleteRule.isPending}
                  onClick={() => {
                    if (confirm(`Delete rule "${rule.name}"?`)) deleteRule.mutate(rule.id);
                  }}
                >
                  delete
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <h2 className="mb-2 mt-8 font-sans text-[15px] font-semibold text-ink">Recent runs</h2>
      <div className="overflow-hidden rounded-panel border border-hairline bg-raised">
        <div className="grid h-8 grid-cols-[1.4fr_90px_1.2fr_120px] items-center border-b border-hairline bg-app px-1 font-sans text-label font-medium uppercase text-ink-2">
          <span className="px-3">Rule</span>
          <span className="px-2">Status</span>
          <span className="px-2">Error</span>
          <span className="px-2">When</span>
        </div>
        {(executionsQuery.data?.data ?? []).length === 0 ? (
          <p className="m-0 px-4 py-5 text-center font-sans text-meta text-ink-3">No runs yet.</p>
        ) : (
          executionsQuery.data!.data.map((run) => (
            <div
              key={run.id}
              className="grid h-9 grid-cols-[1.4fr_90px_1.2fr_120px] items-center border-b border-hairline px-1"
            >
              <span className="truncate px-3 font-sans text-ui text-ink">{run.ruleName}</span>
              <span
                className={cn(
                  'px-2 font-mono text-[11px]',
                  run.status === 'done' && 'text-accent',
                  run.status === 'failed' && 'text-danger',
                  run.status === 'skipped' && 'text-ink-3',
                )}
              >
                {run.status}
              </span>
              <span className="truncate px-2 font-sans text-meta text-ink-3">{run.lastError ?? '—'}</span>
              <span className="px-2">
                <RelativeDate value={run.finishedAt ?? run.createdAt} />
              </span>
            </div>
          ))
        )}
      </div>

      {editing !== null ? (
        <RuleEditor
          projectKey={projectKey}
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
```

Note: `confirm()`/`alert()` are placeholders — replace with the project's dialog primitive if `mapping-component-states` flags it. Verify `Button`, `cn`, `RelativeDate` import paths against `users-settings.tsx`.

- [ ] **Step 2: Wire it into the settings nav**

In `apps/web/src/components/settings/settings-screen.tsx`:
- add `'automations'` to `SectionKey`;
- add `{ key: 'automations', label: 'Automations' }` to `PROJECT_SECTIONS`;
- add a count: call `useRules(projectKey)` at the top and set `automations: rulesQuery.data?.length ?? 0` in `counts`;
- render `<AutomationsSettings projectKey={projectKey} />` when `section === 'automations'`.

Add the imports:

```ts
import { AutomationsSettings } from './automations-settings';
import { useRules } from '../../api/use-rules';
```

Change the section render tail so `automations` maps to the new component (add a branch before the final `users` fallback), e.g.:

```tsx
        ) : section === 'automations' ? (
          <AutomationsSettings projectKey={projectKey} />
        ) : (
          <UsersSettings board={board} indexes={indexes} projectKey={projectKey} />
        )}
```

- [ ] **Step 3: Typecheck + existing tests**

Run: `pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web test`
Expected: PASS (no existing settings test should break; the nav gains one item).

- [ ] **Step 4: Verify in the browser**

Per `verifying-a-component` + `running-the-stack`: open the deployed/dev web app, go to a project's Settings → Automations. Confirm the rule created in Task 14 lists, the enable toggle flips it, "Recent runs" shows the `done` execution, and delete removes it. Then exercise the `RuleEditor` end to end: click "New rule", set name + trigger + one condition + one `add_comment` action, save, confirm it lists and fires on the matching event (reuse the Task 14 happy-path check); re-open it, change a value, save, and confirm the change persists via `GET /api/rules/:id`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/settings/automations-settings.tsx apps/web/src/components/settings/settings-screen.tsx
git commit -m "feat(web): Automations settings tab — rules list, toggle, runs log"
```

---

## Task 18: Docs

**Files:**
- Create: `docs/api/automations.md`
- Modify: `CLAUDE.md`

**Interfaces:** none.

- [ ] **Step 1: Endpoint docs**

Create `docs/api/automations.md` documenting the seven endpoints (method, path, request body, response) for rules CRUD + executions. Keep it **self-contained on types** (repo convention): include a `## Types` section defining `AutomationRule`, `RuleCondition`, `RuleAction`, `RuleExecution`, `EventKind`, `ConditionOp` — copy them from the Canonical types block. Document that actions run as the **Automation** user, delivery is at-least-once, and rules with self-triggering chains are bounded at depth 5.

- [ ] **Step 2: Note the feature in CLAUDE.md**

Add a short subsection under a new `## Automations` heading in `CLAUDE.md`: the dispatcher runs inside `apps/api` (polls `ticket_events`, fans out to `automation_rules`, logs `rule_executions`); rules are per-project no-code automations configured in Settings → Automations; this is Spec 1 of 4 (see `docs/superpowers/specs/2026-07-07-automation-event-bus-and-rules-design.md`).

- [ ] **Step 3: Commit**

```bash
git add docs/api/automations.md CLAUDE.md
git commit -m "docs: automations endpoints + CLAUDE.md note"
```

---

## Final verification

- [ ] Run the full check suite: `pnpm typecheck && pnpm --filter @tickets/api test && pnpm --filter @tickets/web test && pnpm build`. All PASS.
- [ ] Re-run the three end-to-end paths from Task 14 against the built stack.
- [ ] Confirm `git log` shows one focused commit per task.
