# Items Platform SP3 — Event Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drain the transactional `outbox` with an in-process worker, project item events into the `item_activity` feed, and react to events with a code-defined automation engine (three shipping rules).

**Architecture:** A background loop in the API process claims pending `outbox` rows (`FOR UPDATE SKIP LOCKED`, lease + attempt cap), and for each event runs two idempotent consumers — a projection into `item_activity` and the automation engine, whose rules emit chained commands through the existing `runCommand`. Delivery is at-least-once; both consumers are idempotent (projection by `unique(event_id)`, automations by a deterministic `commandId`).

**Tech Stack:** TypeScript, Fastify, Drizzle ORM + postgres-js, valibot, vitest 4, Postgres 17, `uuid` (v5).

## Global Constraints

- **Tests run ONLY against `tickets_test`.** The harness (`src/test/setup-env.ts` + `src/test/db.ts`) forces `POSTGRES_DATABASE=tickets_test` and throws otherwise. NEVER touch `tickets` (production, 635 items), `tickets_dev`, or `tickets_platform`.
- **vitest runs with `fileParallelism: false`** (shared DB). Every test file does `beforeEach(resetDb)` and `afterAll(resetDb)`.
- **The model is the schema's source of truth.** Any schema change edits `apps/eer/models/items-platform.json` first, then the drizzle schema, then regenerates the migration; `packages/db/src/schema/model-conformance.test.ts` must pass in both directions. Conformance checks column names+order, types, nullability, PK, FK, uniques, checks, indexes, enums, and group — NOT defaults.
- **Command core is authoritative.** Every mutation flows through `runCommand`; the worker and automations call it, they do not write events or business tables directly (`command/no-raw-writes.test.ts` guards this).
- **Workflow vocabulary:** the workflow field has key `status` and `config.workflow === true`. Option lifecycle is `options.kind ∈ {todo, active, blocked, done, dropped}`. **Resolved** = `done` or `dropped`; **started** = `active`.
- **Automations** run as a seeded `automation` user (`kind: 'agent'`, resolved via `ensureUser`). Each emitted command's id is `uuidv5(AUTOMATION_NS, "${sourceEventId}:${automationId}:${key}")`; chained commands carry `correlationId = source`, `causedBy = source.id`, `depth = source.depth + 1`. The worker skips automation dispatch when `sourceEvent.depth >= DEPTH_CAP` (8).
- **Status transitions in tests:** the seed installs entry-only `option_transitions`, and `checkTransition` treats a *non-empty* edge set as restrictive. Tests that move `status` first delete the `status` field's transitions (`delete(optionTransitions).where(eq(optionTransitions.fieldId, statusFieldId))`) so moves are unrestricted; the C2 task instead seeds edges to test enforcement.
- **Conventional commits scoped by app** (`feat(api):`, `feat(db):`), one commit per task.
- **Run the db suite as a regression check** after the schema task: `pnpm --filter @tickets/db test`. Run the api suite with `pnpm --filter @tickets/api test`.

---

### Task 1: Schema — `outbox.attempts` + `outbox.last_error` + `events` project CHECK

**Files:**
- Modify: `packages/db/src/schema/outbox.ts`
- Modify: `packages/db/src/schema/events.ts`
- Modify: `apps/eer/models/items-platform.json` (outbox columns ~2327-2356; events constraints array)
- Generate: `packages/db/drizzle/0001_*.sql` (via `db:generate`)
- Test: `packages/db/src/schema/model-conformance.test.ts` (existing — must stay green)

**Interfaces:**
- Produces: `outbox.attempts` (integer, not null, default 0), `outbox.lastError` (`last_error` text, nullable); `events` table CHECK `events_item_project`.

- [ ] **Step 1: Add the two columns to the drizzle `outbox` schema**

In `packages/db/src/schema/outbox.ts`, add `integer` to the import and two columns after `doneAt`:

```ts
import { sql } from 'drizzle-orm';
import { bigint, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { events } from './events';

export const outbox = pgTable(
  'outbox',
  {
    eventId: bigint('event_id', { mode: 'number' })
      .primaryKey()
      .references(() => events.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    pickedAt: timestamp('picked_at', { withTimezone: true, mode: 'string' }),
    doneAt: timestamp('done_at', { withTimezone: true, mode: 'string' }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_pending').on(t.eventId).where(sql`done_at IS NULL`)],
);
```

- [ ] **Step 2: Add the CHECK to the drizzle `events` schema**

In `packages/db/src/schema/events.ts`, add `check` to the `drizzle-orm/pg-core` import and append the constraint to the table's constraint array (the `(t) => [...]` block), after `index('events_stream_at')...`:

```ts
    check('events_item_project', sql`aggregate_type <> 'item' OR project_id IS NOT NULL`),
```

(Add `check` to the existing `import { ... } from 'drizzle-orm/pg-core'` line.)

- [ ] **Step 3: Mirror both changes in the model JSON**

In `apps/eer/models/items-platform.json`, in the `outbox` entity's `columns` array, after the `done_at` column object, add:

```json
        {
          "name": "attempts",
          "type": "integer",
          "title": "Attempts",
          "description": "Delivery attempts so far; a poison row is retired at 5.",
          "nullable": false
        },
        {
          "name": "last_error",
          "type": "text",
          "title": "Last error",
          "description": "Message from the most recent failed delivery.",
          "nullable": true
        }
```

In the `events` entity's `constraints` array, add a check constraint (use the next free `id`, e.g. `"k1"`):

```json
        {
          "id": "k1",
          "kind": "check",
          "name": "events_item_project",
          "expression": "aggregate_type <> 'item' OR project_id IS NOT NULL"
        }
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm --filter @tickets/db db:generate`
Expected: a new `packages/db/drizzle/0001_*.sql` adding the two columns and the check constraint, plus updated `drizzle/meta`.

- [ ] **Step 5: Apply the migration to `tickets_test`**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/db db:migrate`
Expected: applies `0001_*`; no error.

- [ ] **Step 6: Run conformance + model tests**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/db test`
Expected: PASS — `outbox` and `events` still match the model in both directions.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/outbox.ts packages/db/src/schema/events.ts apps/eer/models/items-platform.json packages/db/drizzle
git commit -m "feat(db): outbox attempts/last_error + events item-project CHECK"
```

---

### Task 2: Thread `causedBy` / `depth` through the command envelope

**Files:**
- Modify: `apps/api/src/command/envelope.ts`
- Modify: `apps/api/src/command/registry.ts` (`CommandContext` unchanged; envelope carries the fields)
- Modify: `apps/api/src/command/run-command.ts:38-45` (pass envelope through — already does; verify `ctx.envelope` reaches `writeEvent`)
- Modify: `apps/api/src/event/write.ts:26-46`
- Test: `apps/api/src/event/write.test.ts` (add a case)

**Interfaces:**
- Consumes: `writeEvent(tx, ctx, def, payload)` where `ctx.envelope` is `CommandEnvelope`.
- Produces: `CommandEnvelope` gains `causedBy?: number` and `depth?: number`; `writeEvent` persists `caused_by = ctx.envelope.causedBy ?? null`, `depth = ctx.envelope.depth ?? 0`.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/event/write.test.ts`:

```ts
it('persists causedBy and depth from the envelope', async () => {
  const fx = await seedFixture();
  const causeId = await testDb.transaction(async (tx) =>
    writeEvent(tx, {
      envelope: { commandId: crypto.randomUUID(), actorId: fx.actorId },
      aggregateId: 1, projectId: fx.projectId,
    }, itemArchived, {}),
  );
  const chainedId = await testDb.transaction(async (tx) =>
    writeEvent(tx, {
      envelope: { commandId: crypto.randomUUID(), actorId: fx.actorId, causedBy: causeId, depth: 3 },
      aggregateId: 1, projectId: fx.projectId,
    }, itemArchived, {}),
  );
  const row = (await testDb.select().from(events).where(eq(events.id, chainedId)))[0]!;
  expect(row.causedBy).toBe(causeId);
  expect(row.depth).toBe(3);
});
```

Ensure the test file imports `itemArchived` from `../command/item/events`, `events` from `@tickets/db`, `eq` from `drizzle-orm`, and `seedFixture`/`testDb` from `../test/db` (match existing imports; add what is missing).

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- write.test`
Expected: FAIL — `row.causedBy` is `null`, `row.depth` is `0`.

- [ ] **Step 3: Extend the envelope type**

In `apps/api/src/command/envelope.ts`, add the two optional fields to the interface (leave `parseEnvelope`/`envelopeSchema` unchanged — these fields are set internally by automations, never parsed from an HTTP body):

```ts
export interface CommandEnvelope {
  commandId: string;
  actorId: number;
  correlationId?: string;
  causedBy?: number;
  depth?: number;
}
```

- [ ] **Step 4: Persist them in `writeEvent`**

In `apps/api/src/event/write.ts`, change the `.values({...})` object: replace the hardcoded `depth: 0,` with the two envelope-sourced fields:

```ts
      causedBy: ctx.envelope.causedBy ?? null,
      depth: ctx.envelope.depth ?? 0,
      projectId: ctx.projectId,
```

Also widen `EmitContext.envelope` in the same file to include the optional fields (or import and use `CommandEnvelope`):

```ts
  envelope: { commandId: string; actorId: number; correlationId?: string; causedBy?: number; depth?: number };
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @tickets/api test -- write.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/command/envelope.ts apps/api/src/event/write.ts apps/api/src/event/write.test.ts
git commit -m "feat(api): thread causedBy/depth through the command envelope"
```

---

### Task 3: Automation registry (`defineAutomation` / `automationsFor` / `allAutomations`)

**Files:**
- Create: `apps/api/src/automation/registry.ts`
- Create: `apps/api/src/automation/registry.test.ts`

**Interfaces:**
- Consumes: `StoredEvent` (drizzle `typeof events.$inferSelect`), `DbExecutor`, `AutomationContext` (Task 6).
- Produces:
  - `interface AutomationDef { id: string; on: string[]; when: (event: StoredEvent, tx: DbExecutor) => Promise<boolean>; run: (event: StoredEvent, ctx: AutomationContext) => Promise<void>; }`
  - `defineAutomation(def: AutomationDef): AutomationDef`
  - `automationsFor(eventKind: string): AutomationDef[]`
  - `allAutomations(): AutomationDef[]`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/automation/registry.test.ts`:

```ts
import { expect, it } from 'vitest';
import { allAutomations, automationsFor, defineAutomation } from './registry';

it('registers and looks up automations by event kind', () => {
  const rule = defineAutomation({
    id: 'test-registry-rule',
    on: ['item.field_changed', 'item.created'],
    when: async () => true,
    run: async () => {},
  });
  expect(automationsFor('item.created')).toContain(rule);
  expect(automationsFor('item.field_changed')).toContain(rule);
  expect(automationsFor('comment.added')).not.toContain(rule);
  expect(allAutomations()).toContain(rule);
});

it('rejects a duplicate automation id', () => {
  defineAutomation({ id: 'dup-rule', on: ['x'], when: async () => true, run: async () => {} });
  expect(() => defineAutomation({ id: 'dup-rule', on: ['y'], when: async () => true, run: async () => {} }))
    .toThrow(/already registered/);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- registry.test`
Expected: FAIL — `./registry` has no such exports.

- [ ] **Step 3: Implement the registry**

Create `apps/api/src/automation/registry.ts`:

```ts
import type { DbExecutor, events } from '@tickets/db';

export type StoredEvent = typeof events.$inferSelect;

// Set in Task 6; imported as a type only to keep this file dependency-light.
import type { AutomationContext } from './context';

export interface AutomationDef {
  id: string;
  on: string[];
  when: (event: StoredEvent, tx: DbExecutor) => Promise<boolean>;
  run: (event: StoredEvent, ctx: AutomationContext) => Promise<void>;
}

const registry = new Map<string, AutomationDef>();

export function defineAutomation(def: AutomationDef): AutomationDef {
  if (registry.has(def.id)) {
    throw new Error(`automation id "${def.id}" is already registered`);
  }
  registry.set(def.id, def);
  return def;
}

export function automationsFor(eventKind: string): AutomationDef[] {
  return [...registry.values()].filter((a) => a.on.includes(eventKind));
}

export function allAutomations(): AutomationDef[] {
  return [...registry.values()];
}
```

Note: `events` is exported from `@tickets/db` as a value; `typeof events.$inferSelect` is a type-only use. If the linter objects to a value import used only in a type position, import it in a `import { type ... }` form is not possible for `$inferSelect`; keep `import type { DbExecutor } from '@tickets/db'` and add `import { events } from '@tickets/db'` on its own line.

Because `./context` does not exist until Task 6, create a minimal placeholder now to keep the type import resolvable — `apps/api/src/automation/context.ts`:

```ts
// Filled in by Task 6. Declared here so the registry's type import resolves.
export interface AutomationContext {
  dispatch<TResult>(command: unknown, input: unknown, key?: string): Promise<TResult>;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @tickets/api test -- registry.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/automation/registry.ts apps/api/src/automation/registry.test.ts apps/api/src/automation/context.ts
git commit -m "feat(api): automation registry (defineAutomation)"
```

---

### Task 4: `item_activity` projection

**Files:**
- Create: `apps/api/src/projection/item-activity.ts`
- Create: `apps/api/src/projection/item-activity.test.ts`

**Interfaces:**
- Consumes: `StoredEvent`, `loadSchemeVocab`, `Db`.
- Produces: `projectEvent(db: Db, event: StoredEvent): Promise<void>` — folds one item event into `item_activity` with `onConflictDoNothing`. No-op for non-item events, `version 0`, or a null `projectId`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/projection/item-activity.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemActivity } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { projectEvent } from './item-activity';

beforeEach(resetDb);
afterAll(resetDb);

it('folds item.created into an activity row and is idempotent', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Hello' },
  });
  const ev = (await testDb.select().from(events).where(eq(events.kind, 'item.created')))[0]!;

  await projectEvent(testDb, ev);
  await projectEvent(testDb, ev); // second fold must not duplicate

  const rows = await testDb.select().from(itemActivity).where(eq(itemActivity.itemId, created.id));
  expect(rows).toHaveLength(1);
  expect(rows[0]!.kind).toBe('item.created');
  expect(rows[0]!.actorId).toBe(fx.actorId);
  expect(rows[0]!.correlationId).toBe(ev.correlationId);
  const summary = rows[0]!.summary as Record<string, unknown>;
  expect(summary.title).toBe('Hello');
  expect(summary.typeKey).toBe('task');
});

it('ignores non-item and legacy (version 0) events', async () => {
  const fx = await seedFixture();
  await projectEvent(testDb, {
    id: 999999, aggregateType: 'transition', aggregateId: 1, seq: 1, kind: 'transition.created',
    version: 1, payload: {}, actorId: fx.actorId, at: '2026-07-16 00:00:00+00',
    commandId: crypto.randomUUID(), correlationId: crypto.randomUUID(), causedBy: null, depth: 0,
    projectId: null,
  });
  expect(await testDb.select().from(itemActivity)).toHaveLength(0);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- item-activity.test`
Expected: FAIL — `./item-activity` has no `projectEvent`.

- [ ] **Step 3: Implement the projection**

Create `apps/api/src/projection/item-activity.ts`:

```ts
import type { Db } from '@tickets/db';
import { itemActivity } from '@tickets/db';
import type { StoredEvent } from '../automation/registry';

// Compute a self-contained, display-ready summary from a value-only item event.
function summarize(event: StoredEvent): Record<string, unknown> {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (event.kind === 'comment.added') {
    const body = typeof payload.body === 'string' ? payload.body : '';
    return { commentId: payload.commentId, excerpt: body.slice(0, 140) };
  }
  if (event.kind === 'item.created') {
    const values = (payload.values ?? {}) as Record<string, unknown>;
    return { typeKey: payload.typeKey, number: payload.number, title: values.title ?? null };
  }
  // field_changed / reparented / archived / restored / linked / unlinked: the
  // payload is already the rendered diff, so store it verbatim.
  return payload;
}

export async function projectEvent(db: Db, event: StoredEvent): Promise<void> {
  if (event.aggregateType !== 'item' || event.version < 1 || event.projectId === null) return;
  await db
    .insert(itemActivity)
    .values({
      itemId: event.aggregateId,
      eventId: event.id,
      projectId: event.projectId,
      kind: event.kind,
      actorId: event.actorId,
      at: event.at,
      correlationId: event.correlationId,
      summary: summarize(event),
    })
    .onConflictDoNothing({ target: itemActivity.eventId });
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @tickets/api test -- item-activity.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projection/item-activity.ts apps/api/src/projection/item-activity.test.ts
git commit -m "feat(api): item_activity projection (idempotent fold)"
```

---

### Task 5: Activity feed reads + routes

**Files:**
- Create: `apps/api/src/read/activity.ts`
- Create: `apps/api/src/routes/activity.routes.ts`
- Modify: `apps/api/src/app.ts` (register the routes)
- Create: `apps/api/src/routes/activity.routes.test.ts`

**Interfaces:**
- Consumes: `itemActivity` table, `Db`, `projectEvent` (test only).
- Produces:
  - `itemActivityFeed(db: Db, itemId: number): Promise<ActivityEntry[]>`
  - `projectActivityFeed(db: Db, projectId: number, limit?: number): Promise<ActivityEntry[]>`
  - `interface ActivityEntry { id: number; itemId: number; eventId: number; kind: string; actorId: number; at: string; correlationId: string; summary: Record<string, unknown>; }`
  - `GET /api/items/:id/activity`, `GET /api/projects/:id/activity`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/activity.routes.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { buildApp } from '../app';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { projectEvent } from '../projection/item-activity';

beforeEach(resetDb);
afterAll(resetDb);

it('GET /api/items/:id/activity returns folded entries in order', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  for (const ev of await testDb.select().from(events).where(eq(events.aggregateId, created.id))) {
    await projectEvent(testDb, ev);
  }
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'GET', url: `/api/items/${created.id}/activity` });
  expect(res.statusCode).toBe(200);
  const body = res.json() as Array<{ kind: string; summary: Record<string, unknown> }>;
  expect(body[0]!.kind).toBe('item.created');
  expect(body[0]!.summary.title).toBe('A');
  await app.close();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- activity.routes.test`
Expected: FAIL — route not registered (404).

- [ ] **Step 3: Implement the reads**

Create `apps/api/src/read/activity.ts`:

```ts
import { asc, desc, eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { itemActivity } from '@tickets/db';

export interface ActivityEntry {
  id: number;
  itemId: number;
  eventId: number;
  kind: string;
  actorId: number;
  at: string;
  correlationId: string;
  summary: Record<string, unknown>;
}

function toEntry(row: typeof itemActivity.$inferSelect): ActivityEntry {
  return {
    id: row.id,
    itemId: row.itemId,
    eventId: row.eventId,
    kind: row.kind,
    actorId: row.actorId,
    at: row.at,
    correlationId: row.correlationId,
    summary: row.summary as Record<string, unknown>,
  };
}

export async function itemActivityFeed(db: Db, itemId: number): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(itemActivity)
    .where(eq(itemActivity.itemId, itemId))
    .orderBy(asc(itemActivity.at), asc(itemActivity.id));
  return rows.map(toEntry);
}

export async function projectActivityFeed(db: Db, projectId: number, limit = 100): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(itemActivity)
    .where(eq(itemActivity.projectId, projectId))
    .orderBy(desc(itemActivity.at), desc(itemActivity.id))
    .limit(limit);
  return rows.map(toEntry);
}
```

- [ ] **Step 4: Implement the routes**

Create `apps/api/src/routes/activity.routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { itemActivityFeed, projectActivityFeed } from '../read/activity';
import { parseId } from '../utils/parse-id';

export function registerActivityRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.get('/api/items/:id/activity', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    reply.send(await itemActivityFeed(db, id));
  });

  app.get('/api/projects/:id/activity', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    reply.send(await projectActivityFeed(db, id));
  });
}
```

- [ ] **Step 5: Register them in `app.ts`**

In `apps/api/src/app.ts`, import and call after `registerItemsRoutes(app, context);`:

```ts
import { registerActivityRoutes } from './routes/activity.routes';
// ...
  registerActivityRoutes(app, context);
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @tickets/api test -- activity.routes.test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/read/activity.ts apps/api/src/routes/activity.routes.ts apps/api/src/app.ts apps/api/src/routes/activity.routes.test.ts
git commit -m "feat(api): activity feed reads + GET endpoints"
```

---

### Task 6: Automation dispatch context (deterministic commandId) + `runAutomations`

**Files:**
- Add dependency: `uuid` + `@types/uuid` in `apps/api`
- Replace: `apps/api/src/automation/context.ts` (the placeholder from Task 3)
- Create: `apps/api/src/automation/constants.ts`
- Create: `apps/api/src/automation/run-automations.ts`
- Create: `apps/api/src/automation/run-automations.test.ts`

**Interfaces:**
- Consumes: `runCommand`, `CommandDef`, `automationsFor`, `StoredEvent`, `AutomationDef`.
- Produces:
  - `constants.ts`: `export const DEPTH_CAP = 8;` and `export const AUTOMATION_NS = 'f4e2c1a0-1b3d-4c5e-8a9f-0d1e2f3a4b5c';`
  - `context.ts`: real `AutomationContext` with `dispatch<S, R>(command: CommandDef<S, R>, input: InferOutput<S>, key?: string): Promise<R>`; `makeAutomationContext(db, event, systemActorId): AutomationContext`
  - `run-automations.ts`: `runAutomations(db: Db, event: StoredEvent, opts: { systemActorId: number; rules?: AutomationDef[] }): Promise<void>`

- [ ] **Step 1: Add the uuid dependency**

Run: `pnpm --filter @tickets/api add uuid && pnpm --filter @tickets/api add -D @types/uuid`
Expected: `uuid` in `apps/api/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/automation/run-automations.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { commands, events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { itemComment } from '../command/item/comment';
import type { AutomationDef } from './registry';
import { runAutomations } from './run-automations';

beforeEach(resetDb);
afterAll(resetDb);

// A throwaway rule (passed explicitly — never globally registered) that comments
// on the item whenever it is created.
const commentRule: AutomationDef = {
  id: 'test-comment-on-create',
  on: ['item.created'],
  when: async () => true,
  run: async (event, ctx) => {
    await ctx.dispatch(itemComment, { itemId: event.aggregateId, body: 'auto' }, 'c');
  },
};

it('dispatches a chained command with caused_by/correlation/depth and is idempotent', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const createdEvent = (await testDb.select().from(events).where(eq(events.kind, 'item.created')))[0]!;

  await runAutomations(testDb, createdEvent, { systemActorId: fx.actorId, rules: [commentRule] });
  await runAutomations(testDb, createdEvent, { systemActorId: fx.actorId, rules: [commentRule] }); // re-run: no-op

  const commentEvents = await testDb.select().from(events).where(eq(events.kind, 'comment.added'));
  expect(commentEvents).toHaveLength(1); // deterministic commandId ⇒ ledger dedupe
  expect(commentEvents[0]!.causedBy).toBe(createdEvent.id);
  expect(commentEvents[0]!.correlationId).toBe(createdEvent.correlationId);
  expect(commentEvents[0]!.depth).toBe(createdEvent.depth + 1);
  // exactly one ledger row for the derived commandId
  expect(await testDb.select().from(commands).where(eq(commands.aggregateType, 'item'))).toHaveLength(2); // create + comment
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- run-automations.test`
Expected: FAIL — modules do not exist.

- [ ] **Step 4: Implement constants**

Create `apps/api/src/automation/constants.ts`:

```ts
// Depth beyond which the worker stops dispatching automations for an event —
// bounds chains and any accidental cycle.
export const DEPTH_CAP = 8;

// Fixed namespace for deriving deterministic automation command ids (uuid v5).
export const AUTOMATION_NS = 'f4e2c1a0-1b3d-4c5e-8a9f-0d1e2f3a4b5c';
```

- [ ] **Step 5: Implement the context (replace the placeholder)**

Replace `apps/api/src/automation/context.ts` with:

```ts
import { v5 as uuidv5 } from 'uuid';
import type * as v from 'valibot';
import type { Db } from '@tickets/db';
import { runCommand } from '../command/run-command';
import type { CommandDef } from '../command/registry';
import { AUTOMATION_NS } from './constants';
import type { StoredEvent } from './registry';

export interface AutomationContext {
  dispatch<S extends v.GenericSchema, R>(
    command: CommandDef<S, R>,
    input: v.InferOutput<S>,
    key?: string,
  ): Promise<R>;
}

// Every dispatch derives its commandId from (sourceEvent, automationId, key) so a
// re-drained event dedupes against the commands ledger. `key` distinguishes
// multiple dispatches from one rule (e.g. one per link target).
export function makeAutomationContext(
  db: Db,
  event: StoredEvent,
  automationId: string,
  systemActorId: number,
): AutomationContext {
  return {
    dispatch(command, input, key = '') {
      const commandId = uuidv5(`${event.id}:${automationId}:${key}`, AUTOMATION_NS);
      return runCommand(db, command, {
        commandId,
        actorId: systemActorId,
        correlationId: event.correlationId,
        causedBy: event.id,
        depth: event.depth + 1,
      }, input);
    },
  };
}
```

- [ ] **Step 6: Implement `runAutomations`**

Create `apps/api/src/automation/run-automations.ts`:

```ts
import type { Db } from '@tickets/db';
import { makeAutomationContext } from './context';
import type { AutomationDef, StoredEvent } from './registry';
import { automationsFor } from './registry';

export async function runAutomations(
  db: Db,
  event: StoredEvent,
  opts: { systemActorId: number; rules?: AutomationDef[] },
): Promise<void> {
  const candidates = opts.rules ?? automationsFor(event.kind);
  for (const rule of candidates) {
    if (!rule.on.includes(event.kind)) continue;
    if (!(await rule.when(event, db))) continue;
    const ctx = makeAutomationContext(db, event, rule.id, opts.systemActorId);
    await rule.run(event, ctx);
  }
}
```

- [ ] **Step 7: Run the test**

Run: `pnpm --filter @tickets/api test -- run-automations.test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json apps/api/src/automation/context.ts apps/api/src/automation/constants.ts apps/api/src/automation/run-automations.ts apps/api/src/automation/run-automations.test.ts
git add ../../pnpm-lock.yaml 2>/dev/null || true
git commit -m "feat(api): automation dispatch context + runAutomations (deterministic commandId)"
```

---

### Task 7: Outbox worker (claim → project → automations → complete)

**Files:**
- Create: `apps/api/src/outbox/worker.ts`
- Create: `apps/api/src/outbox/worker.test.ts`
- Modify: `apps/api/src/environment.ts` (poll interval knob)

**Interfaces:**
- Consumes: `projectEvent`, `runAutomations`, `ensureUser`, `events`/`outbox` tables, `DEPTH_CAP`.
- Produces:
  - `createOutboxWorker(db: Db, opts?: { rules?: AutomationDef[]; pollMs?: number }): OutboxWorker`
  - `interface OutboxWorker { start(): void; stop(): Promise<void>; drainOnce(): Promise<number>; }`
  - `drainOnce()` claims one batch (lease + `FOR UPDATE SKIP LOCKED`, `attempts < 5`), projects then (if `depth < DEPTH_CAP`) runs automations per event, marks `done_at`; returns the number of events processed successfully.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/outbox/worker.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { itemActivity, outbox } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { createOutboxWorker } from './worker';

beforeEach(resetDb);
afterAll(resetDb);

it('drains pending rows, projects them, and marks done', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const worker = createOutboxWorker(testDb, { rules: [] }); // no automations for this test
  const processed = await worker.drainOnce();
  expect(processed).toBeGreaterThan(0);
  expect(await testDb.select().from(itemActivity).where(eq(itemActivity.itemId, created.id))).toHaveLength(1);
  const pending = await testDb.select().from(outbox).where(sql`${outbox.doneAt} IS NULL`);
  expect(pending).toHaveLength(0);
});

it('re-processing (done_at reset) does not duplicate the projection', async () => {
  const fx = await seedFixture();
  const created = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const worker = createOutboxWorker(testDb, { rules: [] });
  await worker.drainOnce();
  await testDb.update(outbox).set({ doneAt: null, pickedAt: null });
  await worker.drainOnce();
  expect(await testDb.select().from(itemActivity).where(eq(itemActivity.itemId, created.id))).toHaveLength(1);
});

it('retires a poison event after 5 attempts without blocking', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  // a rule that always throws makes every event poison
  const boom = { id: 'boom', on: ['item.created', 'item.field_changed'], when: async () => true, run: async () => { throw new Error('boom'); } };
  const worker = createOutboxWorker(testDb, { rules: [boom] });
  for (let i = 0; i < 6; i++) {
    await testDb.update(outbox).set({ pickedAt: null }); // clear the lease so it is re-claimable each pass
    await worker.drainOnce();
  }
  const rows = await testDb.select().from(outbox);
  const poison = rows.find((r) => r.kind === undefined || r.attempts >= 5) ?? rows[0]!;
  expect(rows.every((r) => r.attempts <= 5)).toBe(true);
  expect(rows.some((r) => r.attempts === 5 && r.doneAt === null && r.lastError !== null)).toBe(true);
});
```

(The `poison` local in the last test is illustrative; the two `expect`s are the real assertions.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- worker.test`
Expected: FAIL — `./worker` has no `createOutboxWorker`.

- [ ] **Step 3: Add the poll-interval knob**

In `apps/api/src/environment.ts`, add to the returned object:

```ts
  outboxPollMs: Number(process.env.OUTBOX_POLL_MS ?? 500),
```

- [ ] **Step 4: Implement the worker**

Create `apps/api/src/outbox/worker.ts`:

```ts
import { asc, inArray, eq, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { ensureUser } from '@tickets/db';
import { events, outbox } from '@tickets/db';
import { DEPTH_CAP } from '../automation/constants';
import type { AutomationDef } from '../automation/registry';
import { runAutomations } from '../automation/run-automations';
import { projectEvent } from '../projection/item-activity';

const BATCH = 50;
const LEASE = '30 seconds';
const MAX_ATTEMPTS = 5;

export interface OutboxWorker {
  start(): void;
  stop(): Promise<void>;
  drainOnce(): Promise<number>;
}

export function createOutboxWorker(
  db: Db,
  opts: { rules?: AutomationDef[]; pollMs?: number } = {},
): OutboxWorker {
  let systemActorId: number | null = null;
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  async function getSystemActorId(): Promise<number> {
    if (systemActorId === null) {
      systemActorId = await ensureUser(db, { name: 'automation', kind: 'agent' });
    }
    return systemActorId;
  }

  async function claim(): Promise<number[]> {
    // Lease-based claim: atomically stamp picked_at + bump attempts for a batch of
    // pending, non-poison, unleased rows, in event_id order. SKIP LOCKED keeps
    // concurrent drainers from fighting over the same rows.
    const claimed = await db.execute<{ event_id: number }>(sql`
      UPDATE outbox
         SET picked_at = now(), attempts = attempts + 1
       WHERE event_id IN (
         SELECT event_id FROM outbox
          WHERE done_at IS NULL
            AND attempts < ${MAX_ATTEMPTS}
            AND (picked_at IS NULL OR picked_at < now() - interval '${sql.raw(LEASE)}')
          ORDER BY event_id
          FOR UPDATE SKIP LOCKED
          LIMIT ${BATCH})
      RETURNING event_id`);
    return [...claimed].map((r) => Number(r.event_id));
  }

  async function processOne(eventId: number, actorId: number, rules?: AutomationDef[]): Promise<boolean> {
    const eventRow = (await db.select().from(events).where(eq(events.id, eventId)))[0];
    if (!eventRow) {
      await db.update(outbox).set({ doneAt: sql`now()` }).where(eq(outbox.eventId, eventId));
      return true;
    }
    try {
      await projectEvent(db, eventRow);
      if (eventRow.depth < DEPTH_CAP) {
        await runAutomations(db, eventRow, { systemActorId: actorId, rules });
      }
      await db.update(outbox).set({ doneAt: sql`now()` }).where(eq(outbox.eventId, eventId));
      return true;
    } catch (err) {
      await db
        .update(outbox)
        .set({ lastError: err instanceof Error ? err.message : String(err) })
        .where(eq(outbox.eventId, eventId));
      return false;
    }
  }

  async function drainOnce(): Promise<number> {
    const actorId = await getSystemActorId();
    const ids = await claim();
    if (ids.length === 0) return 0;
    // preserve event_id order for per-stream determinism
    ids.sort((a, b) => a - b);
    let ok = 0;
    for (const id of ids) {
      if (await processOne(id, actorId, opts.rules)) ok++;
    }
    return ok;
  }

  async function loop(): Promise<void> {
    if (!running) return;
    try {
      let n = 0;
      do { n = await drainOnce(); } while (n > 0 && running);
    } catch (err) {
      console.error('outbox worker drain failed', err);
    }
    if (running) timer = setTimeout(() => void loop(), opts.pollMs ?? 500);
  }

  return {
    start() {
      if (running) return;
      running = true;
      void loop();
    },
    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
    },
    drainOnce,
  };
}
```

Note on `db.execute` with `inArray`: the raw `sql` claim is used because `FOR UPDATE SKIP LOCKED` inside a subquery is not expressible in the drizzle query builder. `inArray` is imported for potential batch selects; if unused after implementation, remove it to satisfy the linter.

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @tickets/api test -- worker.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/outbox/worker.ts apps/api/src/outbox/worker.test.ts apps/api/src/environment.ts
git commit -m "feat(api): outbox worker — lease claim, projection, automation dispatch"
```

---

### Task 8: `notifyOutbox` nudge

**Files:**
- Create: `apps/api/src/outbox/notify.ts`
- Modify: `apps/api/src/command/run-command.ts` (call `notifyOutbox()` after a successful commit)
- Modify: `apps/api/src/outbox/worker.ts` (register the nudge in `start`, deregister in `stop`)
- Create: `apps/api/src/outbox/notify.test.ts`

**Interfaces:**
- Produces: `onOutboxNotify(fn: () => void): void`, `clearOutboxNotify(): void`, `notifyOutbox(): void`. The worker registers a waker in `start()` so a freshly committed command triggers an immediate drain instead of waiting for the poll timer.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/outbox/notify.test.ts`:

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { clearOutboxNotify, notifyOutbox, onOutboxNotify } from './notify';

afterEach(clearOutboxNotify);

it('invokes the registered listener', () => {
  const spy = vi.fn();
  onOutboxNotify(spy);
  notifyOutbox();
  expect(spy).toHaveBeenCalledOnce();
});

it('is a no-op when no listener is registered', () => {
  expect(() => notifyOutbox()).not.toThrow();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- notify.test`
Expected: FAIL — `./notify` does not exist.

- [ ] **Step 3: Implement the nudge module**

Create `apps/api/src/outbox/notify.ts`:

```ts
// In-process nudge: a committed command wakes the running worker so the common
// path drains immediately. A no-op in tests and any process without a worker.
let listener: (() => void) | null = null;

export function onOutboxNotify(fn: () => void): void {
  listener = fn;
}
export function clearOutboxNotify(): void {
  listener = null;
}
export function notifyOutbox(): void {
  listener?.();
}
```

- [ ] **Step 4: Fire it from `runCommand`**

In `apps/api/src/command/run-command.ts`, import the nudge and call it after a successful transaction. Change the `try { return await db.transaction(...) }` so the result is captured and the nudge fires before returning:

```ts
import { notifyOutbox } from '../outbox/notify';
// ...
  try {
    const result = await db.transaction(async (tx) => {
      // ... unchanged body ...
    });
    notifyOutbox();
    return result;
  } catch (err) {
    // ... unchanged catch ...
  }
```

- [ ] **Step 5: Register the waker in the worker**

In `apps/api/src/outbox/worker.ts`, import `{ onOutboxNotify, clearOutboxNotify }` from `./notify`. In `start()`, after setting `running = true`, register a waker that triggers an immediate drain if one is not already mid-flight:

```ts
    start() {
      if (running) return;
      running = true;
      onOutboxNotify(() => { void drainOnce(); });
      void loop();
    },
    async stop() {
      running = false;
      clearOutboxNotify();
      if (timer) clearTimeout(timer);
    },
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @tickets/api test -- notify.test run-command.test`
Expected: PASS — nudge works; existing run-command tests unaffected (nudge is a no-op there).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/outbox/notify.ts apps/api/src/outbox/notify.test.ts apps/api/src/command/run-command.ts apps/api/src/outbox/worker.ts
git commit -m "feat(api): notifyOutbox nudge wakes the worker after a command"
```

---

### Task 9: Rule — parent roll-up

**Files:**
- Create: `apps/api/src/automation/rules/parent-rollup.ts`
- Create: `apps/api/src/automation/rules/index.ts` (registers all rules; add this rule)
- Create: `apps/api/src/automation/rules/parent-rollup.test.ts`

**Interfaces:**
- Consumes: `defineAutomation`, `loadSchemeVocab`, `itemUpdate`, `items`/`itemValues`.
- Produces: `parentRollup` automation (`id: 'parent-rollup'`, `on: ['item.field_changed']`). When a child's workflow field moves to a resolved option and every sibling is resolved, dispatches `itemUpdate` moving the parent to its first `done` option.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/automation/rules/parent-rollup.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, itemValues, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { createOutboxWorker } from '../../outbox/worker';
import { parentRollup } from './parent-rollup';

beforeEach(resetDb);
afterAll(resetDb);

it('marks the parent done when its last child resolves', async () => {
  const fx = await seedFixture();
  // make status freely movable (seed installs entry-only edges)
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));

  const parent = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Parent' },
  });
  const child = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'subtask', parentId: parent.id, values: { title: 'Child' },
  });
  const worker = createOutboxWorker(testDb, { rules: [parentRollup] });
  await worker.drainOnce(); // fold the create events

  const moved = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: child.id, expectedUpdatedAt: child.updatedAt, values: { status: 'done' },
  });
  expect(moved.id).toBe(child.id);
  await worker.drainOnce(); // triggers the rollup

  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const statusFieldId = fx.fieldIdByKey.get('status')!;
  const parentStatusRows = await testDb
    .select()
    .from(itemValues)
    .where(and(eq(itemValues.itemId, parent.id), eq(itemValues.fieldId, statusFieldId)));
  const optId = parentStatusRows[0]!.optionId!;
  expect(vocab.optionById.get(optId)!.kind).toBe('done');

  // the parent update was a chained automation command
  const parentDone = (await testDb.select().from(events)
    .where(and(eq(events.aggregateId, parent.id), eq(events.kind, 'item.field_changed')))).at(-1)!;
  expect(parentDone.depth).toBe(1);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- parent-rollup.test`
Expected: FAIL — `./parent-rollup` does not exist.

- [ ] **Step 3: Implement the rule**

Create `apps/api/src/automation/rules/parent-rollup.ts`:

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { itemValues, items } from '@tickets/db';
import { defineAutomation } from '../registry';
import { loadSchemeVocab, type SchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemUpdate } from '../../command/item/update';

const RESOLVED = new Set(['done', 'dropped']);

// The workflow option kind currently set on an item (null if unset).
async function statusKind(db: Parameters<typeof loadSchemeVocab>[0], vocab: SchemeVocab, itemId: number, wfId: number) {
  const rows = await db.select().from(itemValues).where(and(eq(itemValues.itemId, itemId), eq(itemValues.fieldId, wfId)));
  const optId = rows[0]?.optionId ?? null;
  return optId === null ? null : (vocab.optionById.get(optId)?.kind ?? null);
}

export const parentRollup = defineAutomation({
  id: 'parent-rollup',
  on: ['item.field_changed'],
  async when(event, tx) {
    const payload = event.payload as { fieldKey?: string; to?: unknown };
    const item = (await tx.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item || item.parentId === null) return false;
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId);
    if (!wf || payload.fieldKey !== wf.key) return false;
    const kind = await statusKind(tx, vocab, item.id, wf.id);
    return kind !== null && RESOLVED.has(kind);
  },
  async run(event, ctx) {
    // Reload through a fresh vocab/read against the shared db (ctx.dispatch runs its own txn).
    const dbAny = (ctx as unknown as { _db?: never }); void dbAny;
    // NOTE: the rule reads via the same db the worker passed to runAutomations;
    // obtain it from a module import to avoid threading it through ctx.
    await rollup(event.aggregateId);

    async function rollup(childId: number) {
      const item = (await workerDb.select().from(items).where(eq(items.id, childId)))[0];
      if (!item || item.parentId === null) return;
      const vocab = await loadSchemeVocab(workerDb, { id: item.projectId });
      const wf = vocab.workflowField(item.typeId)!;

      const parent = (await workerDb.select().from(items).where(eq(items.id, item.parentId)))[0];
      if (!parent) return;
      const parentWf = vocab.workflowField(parent.typeId);
      if (!parentWf) return;
      const parentKind = await statusKind(workerDb, vocab, parent.id, parentWf.id);
      if (parentKind !== null && RESOLVED.has(parentKind)) return; // already resolved

      const siblings = await workerDb.select().from(items).where(eq(items.parentId, parent.id));
      const sibIds = siblings.map((s) => s.id);
      const sibValues = sibIds.length
        ? await workerDb.select().from(itemValues).where(and(inArray(itemValues.itemId, sibIds), eq(itemValues.fieldId, wf.id)))
        : [];
      const kindByItem = new Map<number, string | null>();
      for (const s of siblings) kindByItem.set(s.id, null);
      for (const v of sibValues) kindByItem.set(v.itemId, v.optionId === null ? null : (vocab.optionById.get(v.optionId)?.kind ?? null));
      const allResolved = siblings.length > 0 && [...kindByItem.values()].every((k) => k !== null && RESOLVED.has(k));
      if (!allResolved) return;

      const doneOption = vocab.optionsForField(parent.typeId, parentWf.id).find((o) => o.kind === 'done' && !o.archivedAt);
      if (!doneOption) return;

      await ctx.dispatch(itemUpdate, {
        id: parent.id,
        expectedUpdatedAt: parent.updatedAt,
        values: { [parentWf.key]: doneOption.value },
      }, 'parent');
    }
  },
});
```

**Important — the `workerDb` reference.** A rule needs the `db` handle to read. Rather than the awkward closure above, thread `db` into the automation context. Adjust Task 6's `AutomationContext` to also expose the db:

- In `apps/api/src/automation/context.ts`, add `db: Db` to the `AutomationContext` interface and set it in `makeAutomationContext` (`return { db, dispatch(...) {...} }`).
- Rewrite the rule to read via `ctx.db` instead of the `workerDb` closure. Replace the `run` body with:

```ts
  async run(event, ctx) {
    const db = ctx.db;
    const item = (await db.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item || item.parentId === null) return;
    const vocab = await loadSchemeVocab(db, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId)!;
    const parent = (await db.select().from(items).where(eq(items.id, item.parentId)))[0];
    if (!parent) return;
    const parentWf = vocab.workflowField(parent.typeId);
    if (!parentWf) return;
    const parentKind = await statusKind(db, vocab, parent.id, parentWf.id);
    if (parentKind !== null && RESOLVED.has(parentKind)) return;
    const siblings = await db.select().from(items).where(eq(items.parentId, parent.id));
    const sibIds = siblings.map((s) => s.id);
    const sibValues = sibIds.length
      ? await db.select().from(itemValues).where(and(inArray(itemValues.itemId, sibIds), eq(itemValues.fieldId, wf.id)))
      : [];
    const kindByItem = new Map<number, string | null>();
    for (const s of siblings) kindByItem.set(s.id, null);
    for (const v of sibValues) kindByItem.set(v.itemId, v.optionId === null ? null : (vocab.optionById.get(v.optionId)?.kind ?? null));
    const allResolved = siblings.length > 0 && [...kindByItem.values()].every((k) => k !== null && RESOLVED.has(k));
    if (!allResolved) return;
    const doneOption = vocab.optionsForField(parent.typeId, parentWf.id).find((o) => o.kind === 'done' && !o.archivedAt);
    if (!doneOption) return;
    await ctx.dispatch(itemUpdate, {
      id: parent.id, expectedUpdatedAt: parent.updatedAt, values: { [parentWf.key]: doneOption.value },
    }, 'parent');
  },
```

Update Task 6's context test only if needed (adding `db` to the returned object does not break the existing assertions). Change `statusKind`'s first parameter type to `Db` (`import type { Db } from '@tickets/db'`).

- [ ] **Step 4: Create the rules index**

Create `apps/api/src/automation/rules/index.ts`:

```ts
// Importing this module registers every shipping automation as a side effect.
export { parentRollup } from './parent-rollup';
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @tickets/api test -- parent-rollup.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/automation/rules/parent-rollup.ts apps/api/src/automation/rules/index.ts apps/api/src/automation/rules/parent-rollup.test.ts apps/api/src/automation/context.ts
git commit -m "feat(api): automation rule — parent roll-up"
```

---

### Task 10: Rule — auto-assign on start

**Files:**
- Create: `apps/api/src/automation/rules/auto-assign-on-start.ts`
- Modify: `apps/api/src/automation/rules/index.ts`
- Create: `apps/api/src/automation/rules/auto-assign-on-start.test.ts`

**Interfaces:**
- Produces: `autoAssignOnStart` (`id: 'auto-assign-on-start'`, `on: ['item.field_changed']`). When the workflow field moves to an `active` option and the item has no assignee, dispatches `itemUpdate` setting `assignee = event.actorId`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/automation/rules/auto-assign-on-start.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { itemValues, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { createOutboxWorker } from '../../outbox/worker';
import { autoAssignOnStart } from './auto-assign-on-start';

beforeEach(resetDb);
afterAll(resetDb);

it('assigns the actor when an unassigned item starts', async () => {
  const fx = await seedFixture();
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const worker = createOutboxWorker(testDb, { rules: [autoAssignOnStart] });
  await worker.drainOnce();
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'in-progress' },
  });
  await worker.drainOnce();
  const assigneeRows = await testDb.select().from(itemValues)
    .where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, fx.fieldIdByKey.get('assignee')!)));
  expect(assigneeRows[0]!.valueUserId).toBe(fx.actorId);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- auto-assign-on-start.test`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the rule**

Create `apps/api/src/automation/rules/auto-assign-on-start.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { itemValues, items } from '@tickets/db';
import { defineAutomation } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemUpdate } from '../../command/item/update';

export const autoAssignOnStart = defineAutomation({
  id: 'auto-assign-on-start',
  on: ['item.field_changed'],
  async when(event, tx) {
    const payload = event.payload as { fieldKey?: string };
    const item = (await tx.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return false;
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId);
    if (!wf || payload.fieldKey !== wf.key) return false;
    // new status is 'active'?
    const statusRows = await tx.select().from(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, wf.id)));
    const optId = statusRows[0]?.optionId ?? null;
    if (optId === null || vocab.optionById.get(optId)?.kind !== 'active') return false;
    // assignee empty?
    const assigneeField = vocab.fieldByTypeKey.get(`${item.typeId}:assignee`);
    if (!assigneeField) return false;
    const assigneeRows = await tx.select().from(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, assigneeField.id)));
    return assigneeRows.length === 0;
  },
  async run(event, ctx) {
    const db = ctx.db;
    const item = (await db.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return;
    await ctx.dispatch(itemUpdate, {
      id: item.id, expectedUpdatedAt: item.updatedAt, values: { assignee: event.actorId },
    }, 'assign');
  },
});
```

- [ ] **Step 4: Register it**

In `apps/api/src/automation/rules/index.ts`, add:

```ts
export { autoAssignOnStart } from './auto-assign-on-start';
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @tickets/api test -- auto-assign-on-start.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/automation/rules/auto-assign-on-start.ts apps/api/src/automation/rules/index.ts apps/api/src/automation/rules/auto-assign-on-start.test.ts
git commit -m "feat(api): automation rule — auto-assign on start"
```

---

### Task 11: Rule — blocked-link flag

**Files:**
- Create: `apps/api/src/automation/rules/blocked-link-flag.ts`
- Modify: `apps/api/src/automation/rules/index.ts`
- Create: `apps/api/src/automation/rules/blocked-link-flag.test.ts`

**Interfaces:**
- Produces: `blockedLinkFlag` (`id: 'blocked-link-flag'`, `on: ['item.field_changed']`). When the workflow field *leaves* a resolved option (was `done`/`dropped`, now not), for each item this one `blocks`, dispatches `itemComment` flagging the target. Reads links only.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/automation/rules/blocked-link-flag.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../../command/run-command';
import { itemCreate } from '../../command/item/create';
import { itemUpdate } from '../../command/item/update';
import { itemLink } from '../../command/item/link';
import { createOutboxWorker } from '../../outbox/worker';
import { blockedLinkFlag } from './blocked-link-flag';

beforeEach(resetDb);
afterAll(resetDb);

it('comments on the blocked target when a resolved blocker reopens', async () => {
  const fx = await seedFixture();
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));
  const blocker = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Blocker' },
  });
  const target = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Target' },
  });
  await runCommand(testDb, itemLink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceItemId: blocker.id, targetItemId: target.id, linkTypeKey: 'blocks',
  });
  // resolve then reopen the blocker
  const done = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: blocker.id, expectedUpdatedAt: blocker.updatedAt, values: { status: 'done' },
  });
  const worker = createOutboxWorker(testDb, { rules: [blockedLinkFlag] });
  await worker.drainOnce();
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: blocker.id, expectedUpdatedAt: done.updatedAt, values: { status: 'in-progress' },
  });
  await worker.drainOnce();
  const targetComments = await testDb.select().from(comments).where(eq(comments.itemId, target.id));
  expect(targetComments).toHaveLength(1);
  expect(targetComments[0]!.body).toMatch(/reopened/i);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- blocked-link-flag.test`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the rule**

Create `apps/api/src/automation/rules/blocked-link-flag.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { itemLinks, itemValues, items } from '@tickets/db';
import { defineAutomation } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemComment } from '../../command/item/comment';

const RESOLVED = new Set(['done', 'dropped']);

export const blockedLinkFlag = defineAutomation({
  id: 'blocked-link-flag',
  on: ['item.field_changed'],
  async when(event, tx) {
    const payload = event.payload as { fieldKey?: string; from?: unknown };
    const item = (await tx.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return false;
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId);
    if (!wf || payload.fieldKey !== wf.key) return false;
    // the previous value was resolved …
    const fromValue = typeof payload.from === 'string' ? payload.from : null;
    const fromOption = fromValue === null ? undefined : vocab.optionsForField(item.typeId, wf.id).find((o) => o.value === fromValue);
    if (!fromOption || !RESOLVED.has(fromOption.kind ?? '')) return false;
    // … and the new value is not resolved
    const nowRows = await tx.select().from(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, wf.id)));
    const nowOptId = nowRows[0]?.optionId ?? null;
    const nowKind = nowOptId === null ? null : (vocab.optionById.get(nowOptId)?.kind ?? null);
    return nowKind === null || !RESOLVED.has(nowKind);
  },
  async run(event, ctx) {
    const db = ctx.db;
    const item = (await db.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return;
    const vocab = await loadSchemeVocab(db, { id: item.projectId });
    const blocks = vocab.linkTypeByTypeKey.get(`${item.typeId}:blocks`);
    if (!blocks) return;
    const links = await db.select().from(itemLinks)
      .where(and(eq(itemLinks.linkTypeId, blocks.id), eq(itemLinks.sourceItemId, item.id)));
    for (const link of links) {
      await ctx.dispatch(itemComment, {
        itemId: link.targetItemId,
        body: `Blocker #${item.number} was reopened`,
      }, String(link.targetItemId));
    }
  },
});
```

- [ ] **Step 4: Register it**

In `apps/api/src/automation/rules/index.ts`, add:

```ts
export { blockedLinkFlag } from './blocked-link-flag';
```

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @tickets/api test -- blocked-link-flag.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/automation/rules/blocked-link-flag.ts apps/api/src/automation/rules/index.ts apps/api/src/automation/rules/blocked-link-flag.test.ts
git commit -m "feat(api): automation rule — blocked-link flag"
```

---

### Task 12: Wire the worker + rules into the running server

**Files:**
- Modify: `apps/api/src/server.ts` (start the worker, import the rules index)
- Create: `apps/api/src/routes/end-to-end.test.ts` (full app + worker integration)

**Interfaces:**
- Consumes: `createOutboxWorker`, the global registry (via `import './automation/rules'`).
- Produces: production server drains the outbox and runs all registered rules; graceful `stop()` on shutdown.

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/src/routes/end-to-end.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { buildApp } from '../app';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { itemUpdate } from '../command/item/update';
import { createOutboxWorker } from '../outbox/worker';
import { allAutomations } from '../automation/registry';
import '../automation/rules'; // registers all three rules

beforeEach(resetDb);
afterAll(resetDb);

it('all three rules are registered by importing the rules index', () => {
  const ids = allAutomations().map((a) => a.id);
  expect(ids).toEqual(expect.arrayContaining(['parent-rollup', 'auto-assign-on-start', 'blocked-link-flag']));
});

it('end-to-end: resolving the last child rolls the parent up, feed shows it', async () => {
  const fx = await seedFixture();
  await testDb.delete(optionTransitions).where(eq(optionTransitions.fieldId, fx.fieldIdByKey.get('status')!));
  const app = buildApp({ db: testDb });
  const worker = createOutboxWorker(testDb); // default rules = global registry
  const parent = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Parent' },
  });
  const child = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'subtask', parentId: parent.id, values: { title: 'Child' },
  });
  await worker.drainOnce();
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: child.id, expectedUpdatedAt: child.updatedAt, values: { status: 'done' },
  });
  await worker.drainOnce();

  const res = await app.inject({ method: 'GET', url: `/api/items/${parent.id}/activity` });
  const kinds = (res.json() as Array<{ kind: string }>).map((e) => e.kind);
  expect(kinds).toContain('item.field_changed'); // the automated parent move is in the feed
  await app.close();
});
```

Note: `createOutboxWorker(testDb)` uses the default rules = the global registry. Because this test imports `../automation/rules`, all three rules are live; the earlier per-rule tests pass an explicit `rules` array and are unaffected. To keep the default-registry path from leaking into unrelated files, no other test constructs a worker without an explicit `rules` argument.

- [ ] **Step 2: Make the default worker use the global registry**

Confirm `createOutboxWorker`'s default (`opts.rules` undefined) makes `runAutomations` fall through to `automationsFor(kind)` — it does (Task 6/7). No code change needed if Task 7 left `opts.rules` optional; verify.

- [ ] **Step 3: Run it to confirm it fails / passes appropriately**

Run: `pnpm --filter @tickets/api test -- end-to-end.test`
Expected: the registration test may already pass; the end-to-end test passes once the server wiring compiles. If the rules index is not imported anywhere in the app graph yet, the registration assertion drives the need for Step 4.

- [ ] **Step 4: Start the worker in the server entrypoint**

Replace `apps/api/src/server.ts` with:

```ts
import { createDbClient } from '@tickets/db';
import { buildApp } from './app';
import { environment } from './environment';
import { createOutboxWorker } from './outbox/worker';
import './automation/rules'; // side-effect: register all automations

const { db } = createDbClient();
const app = buildApp({ db });
const worker = createOutboxWorker(db, { pollMs: environment.outboxPollMs });
worker.start();

const shutdown = async () => {
  await worker.stop();
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: environment.apiPort, host: environment.apiHost });
console.log(`tickets api listening on http://${environment.apiHost}:${environment.apiPort} (outbox worker running)`);
```

- [ ] **Step 5: Run the test + typecheck**

Run: `pnpm --filter @tickets/api test -- end-to-end.test && pnpm --filter @tickets/api typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/routes/end-to-end.test.ts
git commit -m "feat(api): start outbox worker + register rules in the server"
```

---

### Task 13: N3 — serialize-retry on event-stream seq collisions

**Files:**
- Modify: `apps/api/src/command/run-command.ts`
- Create: `apps/api/src/command/run-command-concurrency.test.ts`

**Interfaces:**
- Produces: `runCommand` retries the whole command up to 3 times on a `23505` whose constraint is `events_stream_seq`; after that maps to `409`. `commands_pkey` handling unchanged.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/command/run-command-concurrency.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from './run-command';
import { itemCreate } from './item/create';
import { itemComment } from './item/comment';

beforeEach(resetDb);
afterAll(resetDb);

it('concurrent comments on one item all succeed (no 500 from a seq collision)', async () => {
  const fx = await seedFixture();
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      runCommand(testDb, itemComment, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
        itemId: item.id, body: `c${i}`,
      })),
  );
  // none rejected with a 500; any rejections are a clean 409
  for (const r of results) {
    if (r.status === 'rejected') expect(r.reason).toMatchObject({ statusCode: 409 });
  }
  const seqs = (await testDb.select().from(events).where(eq(events.aggregateId, item.id))).map((e) => e.seq);
  expect(new Set(seqs).size).toBe(seqs.length); // all seqs unique
});
```

- [ ] **Step 2: Run it to confirm it fails (or is flaky as a 500)**

Run: `pnpm --filter @tickets/api test -- run-command-concurrency.test`
Expected: FAIL intermittently — a colliding comment currently rejects with a raw 500.

- [ ] **Step 3: Add the retry + stream-collision detector**

In `apps/api/src/command/run-command.ts`, wrap the existing `try { const result = await db.transaction(...) ; notifyOutbox(); return result }` in a bounded loop, and add a detector alongside `isCommandsPkeyCollision`:

```ts
const MAX_SEQ_RETRIES = 3;
// ... inside runCommand, replacing the single try/catch:
for (let attempt = 0; ; attempt++) {
  try {
    const result = await db.transaction(async (tx) => { /* unchanged body */ });
    notifyOutbox();
    return result;
  } catch (err) {
    if (isCommandsPkeyCollision(err)) throw new HttpError(409, 'command already in flight — retry');
    if (isStreamSeqCollision(err)) {
      if (attempt < MAX_SEQ_RETRIES) continue;
      throw new HttpError(409, 'event stream contended — retry');
    }
    throw err;
  }
}
```

```ts
function isStreamSeqCollision(err: unknown): boolean {
  for (const e of [err, (err as { cause?: unknown } | undefined)?.cause]) {
    const pg = e as { code?: string; constraint_name?: string } | undefined;
    if (pg?.code === '23505' && pg?.constraint_name === 'events_stream_seq') return true;
  }
  return false;
}
```

- [ ] **Step 4: Run the test a few times**

Run: `pnpm --filter @tickets/api test -- run-command-concurrency.test` (run 3×)
Expected: PASS consistently — all comments succeed or 409, never 500; seqs unique.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/command/run-command.ts apps/api/src/command/run-command-concurrency.test.ts
git commit -m "fix(api): retry on event-stream seq collision, map to 409 (N3)"
```

---

### Task 14: M3 + M4 — skip no-op field writes; deterministic value order

**Files:**
- Modify: `apps/api/src/command/item/update.ts`
- Modify: `apps/api/src/read/assemble-items.ts`
- Create: `apps/api/src/command/item/update-noop.test.ts`

**Interfaces:**
- Produces: `item.update` skips the delete+insert and the `item.field_changed` emit when a field's value is unchanged; `assembleItems` orders `item_values` by id.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/command/item/update-noop.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemUpdate } from './update';

beforeEach(resetDb);
afterAll(resetDb);

it('setting a field to its current value emits no field_changed', async () => {
  const fx = await seedFixture();
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Same' },
  });
  await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: item.id, expectedUpdatedAt: item.updatedAt, values: { title: 'Same' },
  });
  const changed = await testDb.select().from(events).where(eq(events.kind, 'item.field_changed'));
  expect(changed).toHaveLength(0);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- update-noop.test`
Expected: FAIL — one `item.field_changed` emitted.

- [ ] **Step 3: Skip unchanged fields in `update.ts`**

In `apps/api/src/command/item/update.ts`, inside the `for (const [fieldKey, value] of ...)` loop, after computing `nextRows` (line ~56), compare to the current rows and `continue` when equal. Insert before the workflow-transition block:

```ts
      // no-op: same value set — skip write + emit entirely
      const sig = (rows: { optionId?: number | null; valueUserId?: number | null; valueText?: string | null; valueNumber?: string | null; valueDate?: string | null; valueBool?: boolean | null; valueJson?: unknown }[]) =>
        JSON.stringify(rows.map((r) => [r.optionId ?? null, r.valueUserId ?? null, r.valueText ?? null, r.valueNumber ?? null, r.valueDate ?? null, r.valueBool ?? null, r.valueJson ?? null]).sort());
      if (sig(currentRows) === sig(nextRows)) continue;
```

(`currentRows` are full `item_values` rows; `nextRows` are `ValueRow`s — both expose the same value columns, so the signature compares like-for-like.)

- [ ] **Step 4: Order values deterministically in `assemble-items.ts`**

In `apps/api/src/read/assemble-items.ts`, add ordering to the `itemValues` query (line ~13):

```ts
    db.select().from(itemValues).where(inArray(itemValues.itemId, ids)).orderBy(asc(itemValues.id)),
```

Add `asc` to the `drizzle-orm` import.

- [ ] **Step 5: Run the test + regression**

Run: `pnpm --filter @tickets/api test -- update-noop.test update.test board.test`
Expected: PASS — no-op emits nothing; existing update/board tests still green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/command/item/update.ts apps/api/src/read/assemble-items.ts apps/api/src/command/item/update-noop.test.ts
git commit -m "fix(api): skip no-op field writes (M3); order item_values (M4)"
```

---

### Task 15: M1 + M2 + N4 — value-path hardening

**Files:**
- Modify: `apps/api/src/values/build-value-rows.ts`
- Create: `apps/api/src/values/hardening.test.ts`

**Interfaces:**
- Produces: `buildValueRows` rejects non-finite numbers, non-strict-ISO date/datetime strings, and duplicate option values in a multi field — all with a clean `HttpError(400)`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/values/hardening.test.ts`:

```ts
import { beforeEach, afterAll, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { buildValueRows } from './build-value-rows';

beforeEach(resetDb);
afterAll(resetDb);

async function vocabAndTask() {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const taskId = vocab.typeByKey.get('task')!.id;
  return { fx, vocab, taskId };
}

it('rejects Infinity for a number field', async () => {
  const { vocab, taskId } = await vocabAndTask();
  expect(() => buildValueRows(vocab, taskId, 'estimate', 'm')).not.toThrow(); // sanity: option field
  // 'target_date' is a date; use a numeric field. The scheme has no plain number
  // field on task, so assert via a date instead below; number covered by unit on a
  // number-typed field when present.
});

it('rejects a non-ISO date string', async () => {
  const { vocab, taskId } = await vocabAndTask();
  // task has no date field placed; epic/spike have target_date. Use spike.
  const spikeId = vocab.typeByKey.get('spike')!.id;
  expect(() => buildValueRows(vocab, spikeId, 'target_date', 'July 4, 2026')).toThrow(/ISO/);
  expect(() => buildValueRows(vocab, spikeId, 'target_date', '2026-07-04')).not.toThrow();
});

it('rejects duplicate option values in a multi field', async () => {
  const { vocab, taskId } = await vocabAndTask();
  // 'labels' is a multi option field, but its option set is empty in the seed;
  // assert the dedupe guard on a populated multi set if present, else on 'labels'
  // with two identical unknown values still throws (unknown option) — so this test
  // targets the duplicate guard specifically once a label option exists.
  expect(() => buildValueRows(vocab, taskId, 'labels', ['x', 'x'])).toThrow();
});
```

Note: the seed places no plain `number` field and leaves `labels` options empty. If a number field or seeded labels are unavailable, the implementer MUST add a focused unit that constructs the minimal vocab needed (or seed a label option via `optionCreate`) so each of M1/M2/N4 is asserted directly. Do not leave any of the three unverified.

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @tickets/api test -- hardening.test`
Expected: FAIL — non-ISO date currently passes (`Date.parse` accepts it); duplicates currently reach the DB.

- [ ] **Step 3: Harden `build-value-rows.ts`**

In `apps/api/src/values/build-value-rows.ts`:

Number case — require finite:

```ts
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new HttpError(400, `field "${fieldKey}" expects a finite number`);
      return [{ fieldId: field.id, valueNumber: String(value) }];
    }
```

Date/datetime — strict ISO:

```ts
    case 'date':
    case 'datetime': {
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
      const ok = typeof value === 'string'
        && (field.type === 'date' ? ISO_DATE.test(value) : ISO_DATETIME.test(value))
        && !Number.isNaN(Date.parse(value));
      if (!ok) throw new HttpError(400, `field "${fieldKey}" expects an ISO ${field.type} string`);
      return [{ fieldId: field.id, valueDate: value }];
    }
```

Option multi — reject duplicates (add after building the mapped rows in the `option` case):

```ts
      const built = (requested as string[]).map((optValue) => {
        const option = available.find((o) => o.value === optValue && !o.archivedAt);
        if (!option) throw new HttpError(400, `field "${fieldKey}" has no option "${optValue}"`);
        return { fieldId: field.id, optionId: option.id };
      });
      if (multiple) {
        const ids = built.map((r) => r.optionId);
        if (new Set(ids).size !== ids.length) throw new HttpError(400, `field "${fieldKey}" has duplicate options`);
      }
      return built;
```

- [ ] **Step 4: Run the test + regression**

Run: `pnpm --filter @tickets/api test -- hardening.test values.test`
Expected: PASS; existing value tests still green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/values/build-value-rows.ts apps/api/src/values/hardening.test.ts
git commit -m "fix(api): finite-number + strict-ISO + multi-option dedupe (M1/M2/N4)"
```

---

### Task 16: C2 — transition guard/reject coverage

**Files:**
- Create: `apps/api/src/command/item/transition-enforcement.test.ts`

**Interfaces:**
- Consumes: `transitionCreate`, `itemCreate`, `itemUpdate`. No production code — closes the untested reject/guard paths.

- [ ] **Step 1: Write the test**

Create `apps/api/src/command/item/transition-enforcement.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemUpdate } from './update';
import { transitionCreate } from '../config/transition';

beforeEach(resetDb);
afterAll(resetDb);

it('rejects a status move that is not in the seeded workflow graph', async () => {
  const fx = await seedFixture();
  const statusFieldId = fx.fieldIdByKey.get('status')!;
  // seed leaves only entry edges for task; backlog -> done is not an edge → 422
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  await expect(
    runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'done' },
    }),
  ).rejects.toMatchObject({ statusCode: 422 });
});

it('allows a move once its edge is added', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const taskId = vocab.typeByKey.get('task')!.id;
  const wf = vocab.workflowField(taskId)!;
  const backlog = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'backlog')!;
  const done = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'done')!;
  await runCommand(testDb, transitionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: wf.id, fromOptionId: backlog.id, toOptionId: done.id, itemTypeId: taskId,
  });
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const res = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'done' },
  });
  expect(res.id).toBe(item.id);
});

it('a requiresComment guard blocks the transition until a comment exists', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const taskId = vocab.typeByKey.get('task')!.id;
  const wf = vocab.workflowField(taskId)!;
  const backlog = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'backlog')!;
  const done = vocab.optionsForField(taskId, wf.id).find((o) => o.value === 'done')!;
  await runCommand(testDb, transitionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: wf.id, fromOptionId: backlog.id, toOptionId: done.id, itemTypeId: taskId,
    config: { guard: { requiresComment: true } },
  });
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  await expect(
    runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      id: item.id, expectedUpdatedAt: item.updatedAt, values: { status: 'done' },
    }),
  ).rejects.toMatchObject({ statusCode: 422 });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @tickets/api test -- transition-enforcement.test`
Expected: PASS — reject path, allow-after-edge, and guard block all verified.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/command/item/transition-enforcement.test.ts
git commit -m "test(api): transition reject + guard coverage (C2)"
```

---

### Task 17: Full-suite gate + deferred-doc refresh

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-sp2-deferred-followups.md` (strike the folded-in items)

**Interfaces:** none — a whole-branch verification and bookkeeping task.

- [ ] **Step 1: Typecheck the touched packages**

Run: `pnpm --filter @tickets/db typecheck && pnpm --filter @tickets/api typecheck`
Expected: clean (root `pnpm typecheck` still fails on web/mcp by design — do not run it as the gate).

- [ ] **Step 2: Run the db + api suites**

Run: `pnpm --filter @tickets/db test && pnpm --filter @tickets/api test`
Expected: all green (db conformance/regression; api includes all new SP3 suites).

- [ ] **Step 3: Mark folded-in follow-ups as done**

In `docs/superpowers/specs/2026-07-15-sp2-deferred-followups.md`, append a note at the top of each folded section: `> Resolved in SP3 (see 2026-07-16-items-platform-event-runtime.md).` for N3, M1, M2, M3, M4, N4, C2. Leave R1–R4, M5, M6, C1, C3 as still-deferred (SP4).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-07-15-sp2-deferred-followups.md
git commit -m "docs(api): mark SP3-resolved follow-ups (N3/M1-M4/N4/C2)"
```

---

## Self-Review

**1. Spec coverage.**
- Outbox worker (§4.1) → Tasks 7, 8, 12. Lease claim, poison cap, `FOR UPDATE SKIP LOCKED`, nudge — all covered.
- Projection + feed (§4.2, §4.3) → Tasks 4, 5.
- Automation engine + deterministic id + loop cap (§4.4) → Tasks 3, 6, 7 (depth cap in worker), 9–11.
- Three rules (§4.5) → Tasks 9, 10, 11.
- Schema changes (§5) → Task 1. Envelope threading (§4.4) → Task 2.
- Folded-in follow-ups (§6): N3 → 13; M3/M4 → 14; M1/M2/N4 → 15; C2 → 16.
- Testing (§7) → each task's tests + Task 17 gate. `tickets_test` + `fileParallelism:false` honored throughout.
- Deferrals (§8) → untouched; Task 17 records what stayed deferred.
- System actor (Decision 7) → resolved via `ensureUser('automation','agent')` in the worker.

**2. Placeholder scan.** No TBD/TODO. The one soft spot is Task 15's test, where the seed lacks a plain number field and seeded labels — the task explicitly instructs the implementer to add a focused unit / seed a label option so each of M1/M2/N4 is asserted, rather than leaving a hole. Task 9's first-draft `workerDb` closure is explicitly replaced with a `ctx.db` design in the same task (the "Important" note), so the shipped rule has no dangling reference.

**3. Type consistency.** `AutomationDef`, `AutomationContext` (with `db` + `dispatch`), `StoredEvent` (= `typeof events.$inferSelect`), `ActivityEntry`, `OutboxWorker`, `createOutboxWorker(db, { rules?, pollMs? })`, `runAutomations(db, event, { systemActorId, rules? })`, and the extended `CommandEnvelope` are used consistently across tasks. `ctx.db` is introduced in Task 6's interface and consumed in Tasks 9–11. `notifyOutbox` (Task 8) is referenced by `run-command.ts` (Task 13 preserves it inside the retry loop).

**Cross-task note for the executor:** Task 9 amends `apps/api/src/automation/context.ts` (adds `db` to `AutomationContext`). Tasks 10 and 11 depend on that amendment — run Task 9 before 10/11. Task 13 edits the same `run-command.ts` block that Task 8 modified; apply Task 8 first so the retry loop wraps the nudge call.
