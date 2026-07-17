# Items Platform API — Command Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `apps/api` off the deleted `ticket*` schema onto the 22-table items platform, routing every mutation through one audited `defineCommand` → `runCommand` → typed-event pipeline, so the API compiles, runs, and writes a lossless event + outbox row per mutation.

**Architecture:** Two central registries (`defineCommand`, `defineEvent`) and one pipeline (`runCommand`) own the transaction, the idempotency ledger, `seq` allocation, and event+outbox writes. Route handlers shrink to parse-envelope → parse-input → `runCommand`. Reads (board, export, item events) bypass the pipeline entirely and are rebuilt on the new schema. Tier A: the tables are the source of truth; events are written alongside.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM (postgres-js), valibot, vitest 4, Postgres 17.

## Global Constraints

- **Spec of record:** `docs/superpowers/specs/2026-07-15-items-platform-api-command-path-design.md`. Every decision below traces to it.
- **Branch:** work on a branch cut from `items-platform` (e.g. `sp2-api`). Never commit to `items-platform` directly; the schema deliverable stays untouched until SP2's gates are green.
- **Test DB is `tickets_test`** — created, migrated, and torn down by the suite. Never `tickets` (production), never `tickets_dev` (legacy dev app), never `tickets_platform` (the verified deliverable). Set `POSTGRES_DATABASE=tickets_test` for the api test run.
- **Envelope:** every mutation body carries `commandId` (required uuid) and `actorId` (required integer). `correlationId` is optional and defaults to `commandId`.
- **`commandId` is the idempotency key** — the `commands` primary key. A replayed `commandId` returns the first stored `result` and never re-runs the handler.
- **Every mutation** (item AND config) writes exactly one `commands` row and ≥1 `events` row (schema-validated) plus one `outbox` row per event, all in one transaction.
- **`emit()` writes the `outbox` row** alongside each `events` row. The outbox worker is SP3; SP2 only populates it.
- **Item events set `events.project_id`.** Config events leave it null.
- **Event payloads carry `fieldKey`, never `fieldId`** (stale-id trap; spec §4.1).
- **Field-type mapping (old→new):** `text`→`string`; `select`/`multi_select`→`option` (multi via `config.multiple`); `status`→`option` (over the status option set); plus new `datetime` and `user`. There is no `status`/`select`/`multi_select`/`text` field type on the new schema.
- **`items.updated_at` is the optimistic-lock token** — always compared as text.
- **Exit gate is per-filter:** `pnpm --filter @tickets/api typecheck` and `pnpm --filter @tickets/db typecheck` clean, and the api test suite green. Root `pnpm typecheck` still fails (web/mcp are SP4) — that is expected, not a regression.
- **Conventional commits, scope `api`:** `feat(api): …`, one commit per task.

## File Structure

New under `apps/api/src/`:

| File | Responsibility |
| --- | --- |
| `test/db.ts` | `tickets_test` harness: migrate-fresh, `resetDb`, `seedFixture`, a shared `Db` handle |
| `event/registry.ts` | `defineEvent`, the event registry, `eventKind` lookup |
| `event/seq.ts` | `nextSeq(tx, aggregateType, aggregateId)` |
| `event/kinds.ts` | every `defineEvent` declaration (imported for its side effect of registering) |
| `command/envelope.ts` | `CommandEnvelope` type, `parseEnvelope` |
| `command/registry.ts` | `defineCommand`, the command registry |
| `command/run-command.ts` | `runCommand`: transaction + 5-step pipeline + ledger/idempotency + `ctx.emit` |
| `command/item/create.ts`, `update.ts`, `comment.ts`, `link.ts` | one file per item command |
| `command/config/*.ts` | one file per config command (field, option, transition, link-type, scheme, project, user, view) |
| `vocab/load-scheme-vocab.ts` | the new-schema vocabulary loader (replaces `vocab/load-project-vocab.ts`) |
| `values/build-value-rows.ts`, `values/render-value.ts` | new-schema value round-trip (replace `tickets/build-value-rows.ts`, `tickets/render-value.ts`) |
| `read/assemble-items.ts`, `read/board.ts` | rebuilt read path (replace `tickets/assemble-tickets.ts`) |
| `routes/items.routes.ts` | thin item routes (replaces `routes/tickets.routes.ts`) |

Deleted at the end: `events/write-event.ts`, `tickets/resolve-status.ts`, `tickets/assemble-tickets.ts`, `tickets/build-value-rows.ts`, `tickets/render-value.ts`, `tickets/check-transition.ts` (rewritten), `routes/tickets.routes.ts`, `vocab/load-project-vocab.ts`, and every hand-rolled `db.transaction` in a route.

**Domain rules preserved (ported, not rewritten in spirit):** `checkParent` (type-aware nesting), the transition-graph check, `checkGuard` (requiresField/requiresComment). Their *code* moves onto the new schema; their *rules* are unchanged.

---

### Task 1: Test harness against `tickets_test`

**Files:**
- Create: `apps/api/src/test/db.ts`
- Create: `apps/api/src/test/db.test.ts`
- Modify: `apps/api/vitest.config.ts` (add a setup that points `POSTGRES_DATABASE` at `tickets_test` before any DB import) — if no config exists, create it.

**Interfaces:**
- Produces: `testDb: Db` (shared postgres-js handle); `resetDb(): Promise<void>` (truncate all tables, restart identities); `seedFixture(): Promise<Fixture>` where `Fixture = { schemeId: number; projectKey: string; projectId: number; actorId: number; typeIdByKey: Map<string,number>; fieldIdByKey: Map<string,number>; optionIdByKey: Map<string,number> }`.

- [ ] **Step 1: Prepare the database (manual, once per machine)**

The suite assumes `tickets_test` exists and is migrated. Document and run:

```bash
docker exec tickets-postgres-1 psql -U postgres -c "CREATE DATABASE tickets_test;"
POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/db db:migrate
```

Expected: `migrations applied`, and `tickets_test` has 22 tables.

- [ ] **Step 2: Write the harness**

```ts
// apps/api/src/test/db.ts
import { and, eq, sql } from 'drizzle-orm';
import { createDbClient, ensureSoftwareScheme, ensureUser, seedProject } from '@tickets/db';
import type { Db } from '@tickets/db';

if (process.env.POSTGRES_DATABASE !== 'tickets_test') {
  throw new Error(
    `api tests must run against tickets_test, not "${process.env.POSTGRES_DATABASE}". ` +
      'Set POSTGRES_DATABASE=tickets_test.',
  );
}

const client = createDbClient({ max: 1 });
export const testDb: Db = client.db;

// Every table, child-first, so a plain TRUNCATE ... CASCADE resets cleanly.
const TABLES = [
  'outbox', 'events', 'commands', 'item_activity',
  'item_links', 'comment_reactions', 'comments', 'item_values', 'items',
  'option_transitions', 'link_type_target_types', 'link_types', 'options', 'option_sets',
  'item_type_fields', 'item_type_child_types', 'fields', 'item_types',
  'views', 'projects', 'schemes', 'users',
];

export async function resetDb(): Promise<void> {
  await client.sql.unsafe(
    `TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export interface Fixture {
  schemeId: number;
  projectKey: string;
  projectId: number;
  actorId: number;
  typeIdByKey: Map<string, number>;
  fieldIdByKey: Map<string, number>;
  optionIdByKey: Map<string, number>;
}

export async function seedFixture(): Promise<Fixture> {
  const scheme = await ensureSoftwareScheme(testDb);
  const actorId = await ensureUser(testDb, { name: 'tester', kind: 'human' });
  const project = await seedProject(testDb, {
    key: 'test',
    name: 'Test',
    itemPrefix: 'TST',
    schemeId: scheme.schemeId,
  });
  return {
    schemeId: scheme.schemeId,
    projectKey: 'test',
    projectId: project.id,
    actorId,
    typeIdByKey: scheme.typeIdByKey,
    fieldIdByKey: scheme.fieldIdByKey,
    optionIdByKey: scheme.optionIdByKey,
  };
}
```

Note: `seedProject` returns the inserted project row — confirm it returns `{ id, ... }`; if it returns the view too, destructure accordingly.

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/test/db.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from './db';
import { items, projects } from '@tickets/db';

beforeEach(resetDb);
afterAll(resetDb);

it('seeds a project bound to the software scheme, on a clean db', async () => {
  const fx = await seedFixture();
  expect(fx.projectId).toBeGreaterThan(0);
  expect(fx.typeIdByKey.size).toBeGreaterThan(0);
  const projectRows = await testDb.select().from(projects);
  expect(projectRows).toHaveLength(1);
  const itemRows = await testDb.select().from(items);
  expect(itemRows).toHaveLength(0);
});
```

- [ ] **Step 4: Run it**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/test/db.test.ts`
Expected: PASS. If it fails on connection, re-check Step 1.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/test/ apps/api/vitest.config.ts
git commit -m "test(api): tickets_test harness — reset + seed fixture"
```

---

### Task 2: Event registry, `seq`, and the event writer

**Files:**
- Create: `apps/api/src/event/registry.ts`
- Create: `apps/api/src/event/seq.ts`
- Create: `apps/api/src/event/write.ts`
- Create: `apps/api/src/event/write.test.ts`

**Interfaces:**
- Produces:
  - `defineEvent<S extends v.GenericSchema>(def: { kind: string; aggregateType: string; version: number; payload: S }): EventDef<S>` — registers by kind, throws on a duplicate kind.
  - `EventDef<S>` = the def object; `eventKind(kind: string): EventDef | undefined`.
  - `nextSeq(tx: DbExecutor, aggregateType: string, aggregateId: number): Promise<number>`.
  - `writeEvent(tx, ctx, def, payload)` — validates payload against `def.payload`, allocates `seq`, inserts `events` + `outbox`; where `ctx = { envelope, aggregateId, projectId }`. Returns the new `events.id`.

- [ ] **Step 1: Write the registry**

```ts
// apps/api/src/event/registry.ts
import type * as v from 'valibot';

export interface EventDef<S extends v.GenericSchema = v.GenericSchema> {
  kind: string;
  aggregateType: string;
  version: number;
  payload: S;
}

const registry = new Map<string, EventDef>();

export function defineEvent<S extends v.GenericSchema>(def: EventDef<S>): EventDef<S> {
  if (registry.has(def.kind)) {
    throw new Error(`event kind "${def.kind}" is already registered`);
  }
  registry.set(def.kind, def as unknown as EventDef);
  return def;
}

export function eventKind(kind: string): EventDef | undefined {
  return registry.get(kind);
}
```

- [ ] **Step 2: Write `seq`**

```ts
// apps/api/src/event/seq.ts
import { and, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { events } from '@tickets/db';

// max(seq)+1 for the stream, computed inside the caller's transaction. The
// unique(aggregate_type, aggregate_id, seq) index is the backstop if two txns race.
export async function nextSeq(
  tx: DbExecutor,
  aggregateType: string,
  aggregateId: number,
): Promise<number> {
  const rows = await tx
    .select({ max: sql<number>`coalesce(max(${events.seq}), 0)` })
    .from(events)
    .where(and(eq(events.aggregateType, aggregateType), eq(events.aggregateId, aggregateId)));
  return Number(rows[0]?.max ?? 0) + 1;
}
```

- [ ] **Step 3: Write the event writer**

```ts
// apps/api/src/event/write.ts
import * as v from 'valibot';
import type { DbExecutor } from '@tickets/db';
import { events, outbox } from '@tickets/db';
import type { CommandEnvelope } from '../command/envelope';
import { eventKind, type EventDef } from './registry';
import { nextSeq } from './seq';

export interface EmitContext {
  envelope: CommandEnvelope;
  aggregateId: number;
  projectId: number | null;
}

export async function writeEvent<S extends v.GenericSchema>(
  tx: DbExecutor,
  ctx: EmitContext,
  def: EventDef<S>,
  payload: v.InferOutput<S>,
): Promise<number> {
  if (eventKind(def.kind) !== (def as unknown as EventDef)) {
    throw new Error(`event kind "${def.kind}" is not registered — use defineEvent`);
  }
  const parsed = v.parse(def.payload, payload);
  const seq = await nextSeq(tx, def.aggregateType, ctx.aggregateId);
  const inserted = await tx
    .insert(events)
    .values({
      aggregateType: def.aggregateType,
      aggregateId: ctx.aggregateId,
      seq,
      kind: def.kind,
      version: def.version,
      payload: parsed as unknown,
      actorId: ctx.envelope.actorId,
      commandId: ctx.envelope.commandId,
      correlationId: ctx.envelope.correlationId ?? ctx.envelope.commandId,
      depth: 0,
      projectId: ctx.projectId,
    })
    .returning({ id: events.id });
  const eventId = inserted[0]?.id;
  if (eventId === undefined) throw new Error('event insert returned no id');
  await tx.insert(outbox).values({ eventId });
  return eventId;
}
```

- [ ] **Step 4: Write the failing test**

```ts
// apps/api/src/event/write.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import { events, outbox } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { defineEvent, type EventDef } from './registry';
import { writeEvent, type EmitContext } from './write';

beforeEach(resetDb);
afterAll(resetDb);

const probe = defineEvent({
  kind: 'test.probe',
  aggregateType: 'item',
  version: 1,
  payload: v.object({ n: v.number() }),
});

function ctx(actorId: number): EmitContext {
  return {
    envelope: { commandId: '11111111-1111-1111-1111-111111111111', actorId },
    aggregateId: 42,
    projectId: 7,
  };
}

it('writes an events row and a matching outbox row with seq starting at 1', async () => {
  const fx = await seedFixture();
  const id = await testDb.transaction((tx) => writeEvent(tx, ctx(fx.actorId), probe, { n: 5 }));
  const row = (await testDb.select().from(events).where(eq(events.id, id)))[0]!;
  expect(row.seq).toBe(1);
  expect(row.kind).toBe('test.probe');
  expect(row.projectId).toBe(7);
  expect(row.correlationId).toBe('11111111-1111-1111-1111-111111111111'); // defaults to commandId
  const ob = await testDb.select().from(outbox).where(eq(outbox.eventId, id));
  expect(ob).toHaveLength(1);
});

it('increments seq per (aggregateType, aggregateId)', async () => {
  const fx = await seedFixture();
  await testDb.transaction(async (tx) => {
    await writeEvent(tx, ctx(fx.actorId), probe, { n: 1 });
    await writeEvent(tx, ctx(fx.actorId), probe, { n: 2 });
  });
  const rows = await testDb
    .select()
    .from(events)
    .where(and(eq(events.aggregateType, 'item'), eq(events.aggregateId, 42)));
  expect(rows.map((r) => r.seq).sort()).toEqual([1, 2]);
});

it('rejects a payload that fails its schema', async () => {
  const fx = await seedFixture();
  await expect(
    testDb.transaction((tx) => writeEvent(tx, ctx(fx.actorId), probe, { n: 'nope' } as never)),
  ).rejects.toThrow();
});

it('rejects an event object that was never registered', async () => {
  const fx = await seedFixture();
  const rogue = { kind: 'rogue', aggregateType: 'item', version: 1, payload: v.object({}) } as EventDef;
  await expect(
    testDb.transaction((tx) => writeEvent(tx, ctx(fx.actorId), rogue, {})),
  ).rejects.toThrow(/not registered/);
});
```

- [ ] **Step 5: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/event/write.test.ts`
Expected: 4 passing.

```bash
git add apps/api/src/event/
git commit -m "feat(api): event registry, seq allocation, and the events+outbox writer"
```

---

### Task 3: Command envelope, registry, and `runCommand`

**Files:**
- Create: `apps/api/src/command/envelope.ts`
- Create: `apps/api/src/command/registry.ts`
- Create: `apps/api/src/command/run-command.ts`
- Create: `apps/api/src/command/run-command.test.ts`

**Interfaces:**
- Produces:
  - `CommandEnvelope = { commandId: string; actorId: number; correlationId?: string }`; `parseEnvelope(body: unknown): CommandEnvelope`.
  - `CommandContext = { envelope: CommandEnvelope; aggregateId: number; projectId: number | null; emit<S>(def: EventDef<S>, payload): Promise<void> }`.
  - `defineCommand<TInput, TResult>(def: { kind; input: v.GenericSchema; aggregate: (input) => { type: string; id?: number }; handler: (tx: DbExecutor, input: TInput, ctx: CommandContext) => Promise<TResult> }): CommandDef`.
  - `runCommand(db: Db, cmd: CommandDef, envelope: CommandEnvelope, input: unknown): Promise<TResult>`.

- [ ] **Step 1: Write the envelope**

```ts
// apps/api/src/command/envelope.ts
import * as v from 'valibot';
import { HttpError } from '../errors';

export interface CommandEnvelope {
  commandId: string;
  actorId: number;
  correlationId?: string;
}

// Non-strict: the same body also carries the command's own payload fields.
const envelopeSchema = v.object({
  commandId: v.pipe(v.string(), v.uuid()),
  actorId: v.pipe(v.number(), v.integer()),
  correlationId: v.optional(v.pipe(v.string(), v.uuid())),
});

export function parseEnvelope(body: unknown): CommandEnvelope {
  const result = v.safeParse(envelopeSchema, body);
  if (!result.success) {
    throw new HttpError(400, 'invalid command envelope: commandId (uuid) and actorId are required');
  }
  return result.output;
}
```

- [ ] **Step 2: Write the registry**

```ts
// apps/api/src/command/registry.ts
import type * as v from 'valibot';
import type { DbExecutor } from '@tickets/db';
import type { EventDef } from '../event/registry';
import type { CommandEnvelope } from './envelope';

export interface CommandContext {
  envelope: CommandEnvelope;
  aggregateId: number; // handler sets this for create commands, before emitting
  projectId: number | null; // handler sets this for item events
  emit<S extends v.GenericSchema>(def: EventDef<S>, payload: v.InferOutput<S>): Promise<void>;
}

export interface CommandDef<S extends v.GenericSchema = v.GenericSchema, TResult = unknown> {
  kind: string;
  input: S;
  aggregate: (input: v.InferOutput<S>) => { type: string; id?: number };
  handler: (tx: DbExecutor, input: v.InferOutput<S>, ctx: CommandContext) => Promise<TResult>;
}

const registry = new Map<string, CommandDef>();

export function defineCommand<S extends v.GenericSchema, TResult>(
  def: CommandDef<S, TResult>,
): CommandDef<S, TResult> {
  if (registry.has(def.kind)) {
    throw new Error(`command kind "${def.kind}" is already registered`);
  }
  registry.set(def.kind, def as unknown as CommandDef);
  return def;
}

export function commandKind(kind: string): CommandDef | undefined {
  return registry.get(kind);
}
```

- [ ] **Step 3: Write `runCommand`**

```ts
// apps/api/src/command/run-command.ts
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { commands } from '@tickets/db';
import { HttpError } from '../errors';
import { writeEvent } from '../event/write';
import type { CommandDef, CommandContext } from './registry';
import type { CommandEnvelope } from './envelope';

export async function runCommand<S extends v.GenericSchema, TResult>(
  db: Db,
  cmd: CommandDef<S, TResult>,
  envelope: CommandEnvelope,
  rawInput: unknown,
): Promise<TResult> {
  const input = v.parse(cmd.input, rawInput);
  const agg = cmd.aggregate(input);
  try {
    return await db.transaction(async (tx) => {
      // 1. ledger check — a replayed commandId returns the stored result verbatim
      const existing = await tx.select().from(commands).where(eq(commands.id, envelope.commandId));
      if (existing[0]) {
        return existing[0].result as TResult;
      }
      // 2. insert the ledger row (aggregateId 0 for creates; corrected at commit)
      await tx.insert(commands).values({
        id: envelope.commandId,
        aggregateType: agg.type,
        aggregateId: agg.id ?? 0,
        actorId: envelope.actorId,
      });
      // 3-4. run the handler; ctx.emit writes typed events + outbox
      const ctx: CommandContext = {
        envelope,
        aggregateId: agg.id ?? 0,
        projectId: null,
        emit: (def, payload) => writeEvent(tx, ctx, def, payload),
      };
      const result = await cmd.handler(tx, input, ctx);
      // 5. commit: store the result and the final aggregateId
      await tx
        .update(commands)
        .set({ result: result as unknown, aggregateId: ctx.aggregateId })
        .where(eq(commands.id, envelope.commandId));
      return result;
    });
  } catch (err) {
    // concurrent double-submit of the same commandId collides on the PK
    if (err instanceof Error && /commands_pkey|duplicate key/i.test(err.message)) {
      throw new HttpError(409, 'command already in flight — retry');
    }
    throw err;
  }
}
```

Note: `ctx.emit` closes over `ctx` so a handler that sets `ctx.aggregateId`/`ctx.projectId` before emitting is honored.

- [ ] **Step 4: Write the failing test**

```ts
// apps/api/src/command/run-command.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { commands, events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { defineEvent } from '../event/registry';
import { defineCommand } from './registry';
import { runCommand } from './run-command';

beforeEach(resetDb);
afterAll(resetDb);

const pinged = defineEvent({
  kind: 'probe.pinged',
  aggregateType: 'probe',
  version: 1,
  payload: v.object({ n: v.number() }),
});

const ping = defineCommand({
  kind: 'probe.ping',
  input: v.object({ n: v.number() }),
  aggregate: () => ({ type: 'probe', id: 1 }),
  async handler(_tx, input, ctx) {
    await ctx.emit(pinged, { n: input.n });
    return { ok: true, n: input.n };
  },
});

const env = (actorId: number) => ({ commandId: '22222222-2222-2222-2222-222222222222', actorId });

it('runs the handler, writes one ledger row and one event, returns the result', async () => {
  const fx = await seedFixture();
  const result = await runCommand(testDb, ping, env(fx.actorId), { n: 3 });
  expect(result).toEqual({ ok: true, n: 3 });
  expect(await testDb.select().from(commands)).toHaveLength(1);
  expect(await testDb.select().from(events).where(eq(events.kind, 'probe.pinged'))).toHaveLength(1);
});

it('is idempotent: a replayed commandId returns the stored result and does not re-run', async () => {
  const fx = await seedFixture();
  const first = await runCommand(testDb, ping, env(fx.actorId), { n: 3 });
  const second = await runCommand(testDb, ping, env(fx.actorId), { n: 99 }); // different input, same id
  expect(second).toEqual(first); // stored result, handler never ran again
  expect(await testDb.select().from(events).where(eq(events.kind, 'probe.pinged'))).toHaveLength(1);
});
```

- [ ] **Step 5: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/run-command.test.ts`
Expected: 2 passing.

```bash
git add apps/api/src/command/
git commit -m "feat(api): command registry, envelope, and the runCommand pipeline"
```

---

### Task 4: Scheme vocabulary loader

**Files:**
- Create: `apps/api/src/vocab/load-scheme-vocab.ts`
- Create: `apps/api/src/vocab/load-scheme-vocab.test.ts`

**Interfaces:**
- Consumes: the seeded software scheme (Task 1 fixture).
- Produces: `loadSchemeVocab(db: DbExecutor, selector: { key?: string; id?: number }): Promise<SchemeVocab>` and the type `SchemeVocab`. Key members used by later tasks:
  - `project`, `schemeId`, `usersById: Map<number, User>`, `views`
  - `typeByKey`, `typeById`
  - `fieldById`, `fieldByKey`, `optionById`
  - `fieldsByType: Map<number, Field[]>` (placed, position-sorted)
  - `fieldByTypeKey: Map<string, Field>` (`${typeId}:${key}` → placed field)
  - `placementByTypeField: Map<string, Placement>` (`${typeId}:${fieldId}`)
  - `optionsByFieldId: Map<number, Option[]>` (a field's option-set options)
  - `transitions: OptionTransition[]`
  - `linkTypeByTypeKey: Map<string, LinkType>`, `linkTypeTargets: Map<number, Set<number>>`
  - helpers `workflowField(typeId)`, `optionsForField(typeId, fieldId)`, `initialOption(typeId)`

- [ ] **Step 1: Write the loader**

```ts
// apps/api/src/vocab/load-scheme-vocab.ts
import { eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import {
  fields, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes, optionSets,
  optionTransitions, options, projects, users, views,
} from '@tickets/db';
import { HttpError } from '../errors';

export async function loadSchemeVocab(db: DbExecutor, selector: { key?: string; id?: number }) {
  const projectRows = selector.key
    ? await db.select().from(projects).where(eq(projects.key, selector.key))
    : await db.select().from(projects).where(eq(projects.id, selector.id ?? -1));
  const project = projectRows[0];
  if (!project) throw new HttpError(404, `unknown project "${selector.key ?? selector.id}"`);
  const schemeId = project.schemeId;

  const [typeRows, fieldRows, optionSetRows, viewRows, userRows] = await Promise.all([
    db.select().from(itemTypes).where(eq(itemTypes.schemeId, schemeId)),
    db.select().from(fields).where(eq(fields.schemeId, schemeId)),
    db.select().from(optionSets).where(eq(optionSets.schemeId, schemeId)),
    db.select().from(views).where(eq(views.projectId, project.id)),
    db.select().from(users),
  ]);
  const typeIds = typeRows.map((r) => r.id);
  const fieldIds = fieldRows.map((r) => r.id);
  const setIds = optionSetRows.map((r) => r.id);

  const [placementRows, optionRows, transitionRows, linkTypeRows] = await Promise.all([
    typeIds.length ? db.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds)) : [],
    setIds.length ? db.select().from(options).where(inArray(options.optionSetId, setIds)) : [],
    fieldIds.length ? db.select().from(optionTransitions).where(inArray(optionTransitions.fieldId, fieldIds)) : [],
    typeIds.length ? db.select().from(linkTypes).where(inArray(linkTypes.itemTypeId, typeIds)) : [],
  ]);
  const linkTypeIds = linkTypeRows.map((r) => r.id);
  const targetRows = linkTypeIds.length
    ? await db.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkTypeIds))
    : [];

  const fieldById = new Map(fieldRows.map((f) => [f.id, f]));
  const optionsBySetId = new Map<number, typeof optionRows>();
  for (const o of optionRows) {
    const bucket = optionsBySetId.get(o.optionSetId) ?? [];
    bucket.push(o);
    optionsBySetId.set(o.optionSetId, bucket);
  }
  const optionsByFieldId = new Map<number, typeof optionRows>();
  for (const f of fieldRows) {
    if (f.optionSetId != null) {
      const opts = (optionsBySetId.get(f.optionSetId) ?? []).slice().sort((a, b) => a.position - b.position);
      optionsByFieldId.set(f.id, opts);
    }
  }

  const fieldsByType = new Map<number, typeof fieldRows>();
  const fieldByTypeKey = new Map<string, (typeof fieldRows)[number]>();
  const placementByTypeField = new Map<string, (typeof placementRows)[number]>();
  const placementsSorted = placementRows.slice().sort((a, b) => a.position - b.position);
  for (const p of placementsSorted) {
    const field = fieldById.get(p.fieldId);
    if (!field) continue;
    const bucket = fieldsByType.get(p.itemTypeId) ?? [];
    bucket.push(field);
    fieldsByType.set(p.itemTypeId, bucket);
    fieldByTypeKey.set(`${p.itemTypeId}:${field.key}`, field);
    placementByTypeField.set(`${p.itemTypeId}:${p.fieldId}`, p);
  }

  const linkTypeByTypeKey = new Map(linkTypeRows.map((lt) => [`${lt.itemTypeId}:${lt.key}`, lt]));
  const linkTypeTargets = new Map<number, Set<number>>();
  for (const t of targetRows) {
    const set = linkTypeTargets.get(t.linkTypeId) ?? new Set<number>();
    set.add(t.targetTypeId);
    linkTypeTargets.set(t.linkTypeId, set);
  }

  const vocab = {
    project,
    schemeId,
    views: viewRows,
    usersById: new Map(userRows.map((u) => [u.id, u])),
    types: typeRows,
    typeByKey: new Map(typeRows.map((t) => [t.key, t])),
    typeById: new Map(typeRows.map((t) => [t.id, t])),
    fieldById,
    fieldByKey: new Map(fieldRows.map((f) => [f.key, f])),
    fieldsByType,
    fieldByTypeKey,
    placementByTypeField,
    optionById: new Map(optionRows.map((o) => [o.id, o])),
    optionsByFieldId,
    transitions: transitionRows,
    linkTypeByTypeKey,
    linkTypeTargets,
    // helper: the placed workflow field for a type (config.workflow === true)
    workflowField(typeId: number) {
      return (fieldsByType.get(typeId) ?? []).find(
        (f) => (f.config as { workflow?: boolean }).workflow === true,
      );
    },
    // helper: a field's options for a type, narrowed by the per-type allowlist if present
    optionsForField(typeId: number, fieldId: number) {
      const all = optionsByFieldId.get(fieldId) ?? [];
      const allow = (placementByTypeField.get(`${typeId}:${fieldId}`)?.configOverride as
        | { allowedOptionIds?: number[] }
        | null
        | undefined)?.allowedOptionIds;
      return allow ? all.filter((o) => allow.includes(o.id)) : all;
    },
    // helper: the default workflow option — lowest-position 'todo', else lowest position
    initialOption(typeId: number) {
      const wf = this.workflowField(typeId);
      if (!wf) return undefined;
      const opts = this.optionsForField(typeId, wf.id).filter((o) => !o.archivedAt);
      return opts.find((o) => o.kind === 'todo') ?? opts[0];
    },
  };
  return vocab;
}

export type SchemeVocab = Awaited<ReturnType<typeof loadSchemeVocab>>;
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/src/vocab/load-scheme-vocab.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { loadSchemeVocab } from './load-scheme-vocab';

beforeEach(resetDb);
afterAll(resetDb);

it('loads placed fields, options, and the workflow field for a seeded project', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  expect(vocab.project.id).toBe(fx.projectId);

  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id));
  expect(typeId).toBeDefined();

  const wf = vocab.workflowField(typeId!);
  expect(wf?.key).toBe('status');
  expect((wf!.config as { workflow?: boolean }).workflow).toBe(true);

  const statusOptions = vocab.optionsForField(typeId!, wf!.id);
  expect(statusOptions.length).toBeGreaterThan(0);
  expect(statusOptions.some((o) => o.kind === 'todo')).toBe(true);

  const initial = vocab.initialOption(typeId!);
  expect(initial?.kind).toBe('todo');

  expect(vocab.fieldByTypeKey.get(`${typeId}:status`)?.id).toBe(wf!.id);
});
```

- [ ] **Step 3: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/vocab/load-scheme-vocab.test.ts`
Expected: PASS.

```bash
git add apps/api/src/vocab/load-scheme-vocab.ts apps/api/src/vocab/load-scheme-vocab.test.ts
git commit -m "feat(api): scheme vocabulary loader on the new schema"
```

---

### Task 5: Value round-trip — build and render

**Files:**
- Create: `apps/api/src/values/build-value-rows.ts`
- Create: `apps/api/src/values/render-value.ts`
- Create: `apps/api/src/values/values.test.ts`

**Interfaces:**
- Consumes: `SchemeVocab` (Task 4).
- Produces:
  - `type ValueRow = { fieldId: number; valueText?: string; valueNumber?: string; valueDate?: string; valueBool?: boolean; valueJson?: unknown; optionId?: number; valueUserId?: number }`
  - `buildValueRows(vocab, typeId: number, fieldKey: string, value: unknown): ValueRow[]` — `null`/`undefined` clears (zero rows); an `option` field with `config.multiple` yields one row per option.
  - `renderValue(vocab, row): unknown` — options → `value` string, user → `{ id, name }`, scalars as themselves.

- [ ] **Step 1: Write `build-value-rows`**

```ts
// apps/api/src/values/build-value-rows.ts
import { HttpError } from '../errors';
import type { SchemeVocab } from '../vocab/load-scheme-vocab';

export interface ValueRow {
  fieldId: number;
  valueText?: string;
  valueNumber?: string;
  valueDate?: string;
  valueBool?: boolean;
  valueJson?: unknown;
  optionId?: number;
  valueUserId?: number;
}

export function buildValueRows(
  vocab: SchemeVocab,
  typeId: number,
  fieldKey: string,
  value: unknown,
): ValueRow[] {
  const field = vocab.fieldByTypeKey.get(`${typeId}:${fieldKey}`);
  if (!field || field.archivedAt) {
    throw new HttpError(400, `unknown field "${fieldKey}" for this item type`);
  }
  if (value === null || value === undefined) return [];

  switch (field.type) {
    case 'string': {
      if (typeof value !== 'string') throw new HttpError(400, `field "${fieldKey}" expects a string`);
      return [{ fieldId: field.id, valueText: value }];
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value))
        throw new HttpError(400, `field "${fieldKey}" expects a number`);
      return [{ fieldId: field.id, valueNumber: String(value) }];
    }
    case 'boolean': {
      if (typeof value !== 'boolean') throw new HttpError(400, `field "${fieldKey}" expects a boolean`);
      return [{ fieldId: field.id, valueBool: value }];
    }
    case 'date':
    case 'datetime': {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        throw new HttpError(400, `field "${fieldKey}" expects an ISO ${field.type} string`);
      return [{ fieldId: field.id, valueDate: value }];
    }
    case 'json': {
      return [{ fieldId: field.id, valueJson: value }];
    }
    case 'user': {
      if (typeof value !== 'number' || !Number.isInteger(value))
        throw new HttpError(400, `field "${fieldKey}" expects a user id`);
      return [{ fieldId: field.id, valueUserId: value }];
    }
    case 'option': {
      const multiple = (field.config as { multiple?: boolean }).multiple === true;
      const requested = multiple ? value : [value];
      if (!Array.isArray(requested) || requested.some((e) => typeof e !== 'string')) {
        throw new HttpError(
          400,
          multiple
            ? `field "${fieldKey}" expects an array of option value strings`
            : `field "${fieldKey}" expects an option value string`,
        );
      }
      const available = vocab.optionsForField(typeId, field.id);
      return (requested as string[]).map((optValue) => {
        const option = available.find((o) => o.value === optValue && !o.archivedAt);
        if (!option) throw new HttpError(400, `field "${fieldKey}" has no option "${optValue}"`);
        return { fieldId: field.id, optionId: option.id };
      });
    }
    default:
      throw new HttpError(400, `unsupported field type "${field.type}"`);
  }
}
```

- [ ] **Step 2: Write `render-value`**

```ts
// apps/api/src/values/render-value.ts
import type { itemValues } from '@tickets/db';
import type { SchemeVocab } from '../vocab/load-scheme-vocab';

type ValueRow = typeof itemValues.$inferSelect;

export function renderValue(vocab: SchemeVocab, row: ValueRow): unknown {
  if (row.optionId !== null) return vocab.optionById.get(row.optionId)?.value ?? null;
  if (row.valueUserId !== null) {
    const u = vocab.usersById.get(row.valueUserId);
    return u ? { id: u.id, name: u.name } : null;
  }
  if (row.valueText !== null) return row.valueText;
  if (row.valueNumber !== null) return Number(row.valueNumber);
  if (row.valueDate !== null) return row.valueDate;
  if (row.valueBool !== null) return row.valueBool;
  if (row.valueJson !== null) return row.valueJson;
  return null;
}
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/values/values.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { buildValueRows } from './build-value-rows';
import { renderValue } from './render-value';

beforeEach(resetDb);
afterAll(resetDb);

it('builds and renders each field type round-trip', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;

  const titleField = vocab.fieldByTypeKey.get(`${typeId}:title`)!;
  const titleRows = buildValueRows(vocab, typeId, 'title', 'Hello');
  expect(titleRows).toEqual([{ fieldId: titleField.id, valueText: 'Hello' }]);

  const statusRows = buildValueRows(vocab, typeId, 'status', 'todo');
  expect(statusRows).toHaveLength(1);
  expect(statusRows[0]!.optionId).toBeDefined();

  const rendered = renderValue(vocab, {
    id: 0, itemId: 0, fieldId: statusRows[0]!.fieldId,
    valueText: null, valueNumber: null, valueDate: null, valueBool: null,
    valueJson: null, optionId: statusRows[0]!.optionId!, valueUserId: null,
  });
  expect(rendered).toBe('todo');

  expect(buildValueRows(vocab, typeId, 'title', null)).toEqual([]);
});

it('rejects a wrong-typed value and an unknown option', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  expect(() => buildValueRows(vocab, typeId, 'title', 123)).toThrow(/expects a string/);
  expect(() => buildValueRows(vocab, typeId, 'status', 'nonsense')).toThrow(/no option/);
});
```

Confirm `title` is a string field the type actually places (check the fixture's `fieldIdByKey` / `softwareScheme`); substitute the real scalar-string field key if it differs.

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/values/values.test.ts`
Expected: PASS.

```bash
git add apps/api/src/values/
git commit -m "feat(api): value round-trip (build + render) on the new schema"
```

---

### Task 6: Item write helpers + item event kinds

**Files:**
- Create: `apps/api/src/command/item/events.ts` (item event definitions)
- Create: `apps/api/src/command/item/helpers.ts` (`nextItemNumber`, `lockItem`, `checkParent`, `checkTransition`, `transitionEdge`, `runTransitionGuard`)
- Create: `apps/api/src/command/item/helpers.test.ts`

**Interfaces:**
- Produces (events, all `aggregateType: 'item'`, `version: 1`):
  - `itemCreated` — `payload: v.object({ typeKey: v.string(), number: v.number(), parentId: v.nullable(v.number()), values: v.record(v.string(), v.unknown()) })`
  - `itemFieldChanged` — `payload: v.object({ fieldKey: v.string(), from: v.unknown(), to: v.unknown() })`
  - `itemReparented` — `payload: v.object({ from: v.nullable(v.number()), to: v.nullable(v.number()) })`
  - `itemArchived`, `itemRestored` — `payload: v.object({})`
  - `commentAdded` — `payload: v.object({ commentId: v.number(), body: v.string() })`
  - `itemLinked`, `itemUnlinked` — `payload: v.object({ linkTypeKey: v.string(), targetItemId: v.number() })`
- Produces (helpers):
  - `nextItemNumber(tx, projectId): Promise<number>`
  - `lockItem(tx, id, expectedUpdatedAt): Promise<Item>` — 404 if missing, 409 if stale
  - `checkParent(tx, vocab, { itemId: number | null; parentId: number; childTypeId: number }): Promise<void>`
  - `checkTransition(vocab, { fieldId; typeId; fromOptionId: number | null; toOptionId: number }): void`
  - `transitionEdge(vocab, sameArgs)` — the matching edge or undefined
  - `runTransitionGuard(tx, vocab, { itemId; typeId; edge }): Promise<void>`

- [ ] **Step 1: Write the event definitions**

```ts
// apps/api/src/command/item/events.ts
import * as v from 'valibot';
import { defineEvent } from '../../event/registry';

export const itemCreated = defineEvent({
  kind: 'item.created', aggregateType: 'item', version: 1,
  payload: v.object({
    typeKey: v.string(),
    number: v.number(),
    parentId: v.nullable(v.number()),
    values: v.record(v.string(), v.unknown()),
  }),
});
export const itemFieldChanged = defineEvent({
  kind: 'item.field_changed', aggregateType: 'item', version: 1,
  payload: v.object({ fieldKey: v.string(), from: v.unknown(), to: v.unknown() }),
});
export const itemReparented = defineEvent({
  kind: 'item.reparented', aggregateType: 'item', version: 1,
  payload: v.object({ from: v.nullable(v.number()), to: v.nullable(v.number()) }),
});
export const itemArchived = defineEvent({
  kind: 'item.archived', aggregateType: 'item', version: 1, payload: v.object({}),
});
export const itemRestored = defineEvent({
  kind: 'item.restored', aggregateType: 'item', version: 1, payload: v.object({}),
});
export const commentAdded = defineEvent({
  kind: 'comment.added', aggregateType: 'item', version: 1,
  payload: v.object({ commentId: v.number(), body: v.string() }),
});
export const itemLinked = defineEvent({
  kind: 'item.linked', aggregateType: 'item', version: 1,
  payload: v.object({ linkTypeKey: v.string(), targetItemId: v.number() }),
});
export const itemUnlinked = defineEvent({
  kind: 'item.unlinked', aggregateType: 'item', version: 1,
  payload: v.object({ linkTypeKey: v.string(), targetItemId: v.number() }),
});
```

- [ ] **Step 2: Write the helpers**

```ts
// apps/api/src/command/item/helpers.ts
import { and, count, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { comments, itemTypeChildTypes, itemValues, items } from '@tickets/db';
import { HttpError } from '../../errors';
import type { SchemeVocab } from '../../vocab/load-scheme-vocab';

// max+1 per project, serialized by locking the project row
export async function nextItemNumber(tx: DbExecutor, projectId: number): Promise<number> {
  await tx.execute(sql`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`);
  const rows = await tx
    .select({ max: sql<number>`coalesce(max(${items.number}), 0)` })
    .from(items)
    .where(eq(items.projectId, projectId));
  return Number(rows[0]?.max ?? 0) + 1;
}

// compare-and-set the optimistic-lock token; 404 vs 409 distinguished
export async function lockItem(tx: DbExecutor, id: number, expectedUpdatedAt: string) {
  const touched = await tx
    .update(items)
    .set({ updatedAt: sql`clock_timestamp()` })
    .where(and(eq(items.id, id), sql`${items.updatedAt}::text = ${expectedUpdatedAt}`))
    .returning();
  const item = touched[0];
  if (item) return item;
  const exists = await tx.select({ id: items.id }).from(items).where(eq(items.id, id));
  if (!exists[0]) throw new HttpError(404, 'item not found');
  throw new HttpError(409, 'item changed since you loaded it — refresh and retry');
}

export async function checkParent(
  tx: DbExecutor,
  vocab: SchemeVocab,
  input: { itemId: number | null; parentId: number; childTypeId: number },
): Promise<void> {
  const parentRows = await tx.select().from(items).where(eq(items.id, input.parentId));
  const parent = parentRows[0];
  if (!parent || parent.projectId !== vocab.project.id) {
    throw new HttpError(400, 'parent item not found in this project');
  }
  if (input.itemId !== null && input.itemId === input.parentId) {
    throw new HttpError(422, 'an item cannot be its own parent');
  }
  const parentType = vocab.typeById.get(parent.typeId);
  const childType = vocab.typeById.get(input.childTypeId);
  // Allowed parent→child pairs live in the item_type_child_types table on the
  // new schema (NOT itemTypes.config, which only holds {color}).
  const allowedRows = await tx
    .select({ childTypeId: itemTypeChildTypes.childTypeId })
    .from(itemTypeChildTypes)
    .where(eq(itemTypeChildTypes.parentTypeId, parent.typeId));
  const allowed = new Set(allowedRows.map((r) => r.childTypeId));
  if (!childType || !allowed.has(input.childTypeId)) {
    throw new HttpError(422, `a ${childType?.key ?? 'child'} cannot be nested under a ${parentType?.key ?? 'parent'}`);
  }
}

// Workflow-graph enforcement over option_transitions, per field. Zero edges = unrestricted.
export function checkTransition(
  vocab: SchemeVocab,
  input: { fieldId: number; typeId: number; fromOptionId: number | null; toOptionId: number },
): void {
  const edges = vocab.transitions.filter(
    (e) => e.fieldId === input.fieldId && (e.itemTypeId === null || e.itemTypeId === input.typeId),
  );
  if (edges.length === 0) return;
  if (input.fromOptionId === null) {
    const entry = edges.filter((e) => e.fromOptionId === null);
    if (entry.length === 0) return;
    if (!entry.some((e) => e.toOptionId === input.toOptionId)) {
      throw new HttpError(422, `"${vocab.optionById.get(input.toOptionId)?.value}" is not a valid starting option`);
    }
    return;
  }
  if (!edges.some((e) => e.fromOptionId === input.fromOptionId && e.toOptionId === input.toOptionId)) {
    const from = vocab.optionById.get(input.fromOptionId)?.value;
    const to = vocab.optionById.get(input.toOptionId)?.value;
    throw new HttpError(422, `transition ${from} → ${to} is not in the workflow graph`);
  }
}

export function transitionEdge(
  vocab: SchemeVocab,
  input: { fieldId: number; typeId: number; fromOptionId: number | null; toOptionId: number },
) {
  return vocab.transitions.find(
    (e) =>
      e.fieldId === input.fieldId &&
      (e.itemTypeId === null || e.itemTypeId === input.typeId) &&
      e.fromOptionId === input.fromOptionId &&
      e.toOptionId === input.toOptionId,
  );
}

type Guard = { requiresField?: string; requiresComment?: boolean };

// Consults edge.config.guard: requiresComment (>=1 comment) / requiresField (a value present).
export async function runTransitionGuard(
  tx: DbExecutor,
  vocab: SchemeVocab,
  input: { itemId: number; typeId: number; edge: { config: unknown } | undefined },
): Promise<void> {
  const guard = (input.edge?.config as { guard?: Guard } | undefined)?.guard;
  if (!guard) return;
  if (guard.requiresComment) {
    const c = await tx.select({ n: count() }).from(comments).where(eq(comments.itemId, input.itemId));
    if (Number(c[0]?.n ?? 0) < 1) {
      throw new HttpError(422, 'add a comment explaining the resolution before closing');
    }
  }
  if (guard.requiresField) {
    const field = vocab.fieldByTypeKey.get(`${input.typeId}:${guard.requiresField}`);
    if (field) {
      const rows = await tx
        .select()
        .from(itemValues)
        .where(and(eq(itemValues.itemId, input.itemId), eq(itemValues.fieldId, field.id)));
      if (rows.length === 0) throw new HttpError(422, `set "${guard.requiresField}" before this transition`);
    }
  }
}
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/item/helpers.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { checkTransition, nextItemNumber } from './helpers';

beforeEach(resetDb);
afterAll(resetDb);

it('allocates item numbers 1,2,3 within a project', async () => {
  const fx = await seedFixture();
  const a = await testDb.transaction((tx) => nextItemNumber(tx, fx.projectId));
  expect(a).toBe(1);
});

it('checkTransition is a no-op when the field has no edges', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  const wf = vocab.workflowField(typeId)!;
  const to = vocab.optionsForField(typeId, wf.id)[0]!.id;
  // seeded scheme defines no option_transitions → unrestricted
  expect(() => checkTransition(vocab, { fieldId: wf.id, typeId, fromOptionId: null, toOptionId: to })).not.toThrow();
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/item/helpers.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/item/events.ts apps/api/src/command/item/helpers.ts apps/api/src/command/item/helpers.test.ts
git commit -m "feat(api): item event kinds and write helpers (parent, transition, guard, lock)"
```

---

### Task 7: `item.create` command + route

**Files:**
- Create: `apps/api/src/command/item/create.ts`
- Create: `apps/api/src/routes/items.routes.ts`
- Create: `apps/api/src/command/item/create.test.ts`

**Interfaces:**
- Consumes: `runCommand` (T3), `loadSchemeVocab` (T4), `buildValueRows` (T5), item events + helpers (T6).
- Produces: `itemCreate` command (`kind: 'item.create'`); `registerItemsRoutes(app, { db })` (extended in T8/T9).

- [ ] **Step 1: Write the command**

```ts
// apps/api/src/command/item/create.ts
import * as v from 'valibot';
import { items, itemValues } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { buildValueRows } from '../../values/build-value-rows';
import { itemCreated } from './events';
import { checkParent, checkTransition, nextItemNumber } from './helpers';

export const itemCreateInput = v.object({
  projectKey: v.pipe(v.string(), v.minLength(1)),
  typeKey: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  values: v.record(v.string(), v.unknown()),
});

export const itemCreate = defineCommand({
  kind: 'item.create',
  input: itemCreateInput,
  aggregate: () => ({ type: 'item' }), // id known only after insert
  async handler(tx, input, ctx) {
    const vocab = await loadSchemeVocab(tx, { key: input.projectKey });
    const type = vocab.typeByKey.get(input.typeKey);
    if (!type || type.archivedAt) throw new HttpError(400, `unknown item type "${input.typeKey}"`);

    // required-field gate
    for (const field of vocab.fieldsByType.get(type.id) ?? []) {
      const placement = vocab.placementByTypeField.get(`${type.id}:${field.id}`);
      if (placement?.required && !field.archivedAt) {
        const val = input.values[field.key];
        if (val === undefined || val === null || val === '') {
          throw new HttpError(400, `field "${field.key}" is required for type "${type.key}"`);
        }
      }
    }

    // default the workflow field to the initial option when the caller didn't choose
    const values = { ...input.values };
    const wf = vocab.workflowField(type.id);
    if (wf && values[wf.key] === undefined) {
      const initial = vocab.initialOption(type.id);
      if (initial) values[wf.key] = initial.value;
    }

    if (input.parentId != null) {
      await checkParent(tx, vocab, { itemId: null, parentId: input.parentId, childTypeId: type.id });
    }

    const number = await nextItemNumber(tx, vocab.project.id);
    const inserted = await tx
      .insert(items)
      .values({
        projectId: vocab.project.id,
        typeId: type.id,
        parentId: input.parentId ?? null,
        number,
        createdBy: ctx.envelope.actorId,
      })
      .returning();
    const item = inserted[0];
    if (!item) throw new HttpError(500, 'item insert returned no row');

    ctx.aggregateId = item.id;
    ctx.projectId = vocab.project.id;

    for (const [fieldKey, value] of Object.entries(values)) {
      const rows = buildValueRows(vocab, type.id, fieldKey, value);
      // entry-edge check for the workflow field
      if (wf && fieldKey === wf.key && rows[0]?.optionId) {
        checkTransition(vocab, { fieldId: wf.id, typeId: type.id, fromOptionId: null, toOptionId: rows[0].optionId });
      }
      if (rows.length > 0) {
        await tx.insert(itemValues).values(rows.map((r) => ({ ...r, itemId: item.id })));
      }
    }

    await ctx.emit(itemCreated, {
      typeKey: type.key,
      number: item.number,
      parentId: item.parentId,
      values,
    });
    return { id: item.id, number: item.number, updatedAt: item.updatedAt };
  },
});
```

- [ ] **Step 2: Write the route**

```ts
// apps/api/src/routes/items.routes.ts
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';

export function registerItemsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/projects/:key/items', async (request, reply) => {
    const { key } = request.params as { key: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemCreate, envelope, { projectKey: key, ...(request.body as object) });
    reply.status(201).send(result);
  });
}
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/item/create.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemValues, items } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';

beforeEach(resetDb);
afterAll(resetDb);

const env = (actorId: number, id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') => ({ commandId: id, actorId });

it('creates an item with values, defaults the workflow field, and emits item.created', async () => {
  const fx = await seedFixture();
  const typeKey = 'task'; // a type the scheme defines with a status field — adjust to the seed
  const result = await runCommand(testDb, itemCreate, env(fx.actorId), {
    projectKey: fx.projectKey,
    typeKey,
    values: { title: 'First' },
  });
  expect(result.number).toBe(1);

  const itemRows = await testDb.select().from(items).where(eq(items.id, result.id));
  expect(itemRows).toHaveLength(1);

  const created = await testDb.select().from(events).where(eq(events.kind, 'item.created'));
  expect(created).toHaveLength(1);
  expect(created[0]!.projectId).toBe(fx.projectId); // item events carry project_id
  expect((created[0]!.payload as { values: Record<string, unknown> }).values.status).toBeDefined();

  const valueRows = await testDb.select().from(itemValues).where(eq(itemValues.itemId, result.id));
  expect(valueRows.length).toBeGreaterThan(0);
});

it('rejects a missing required field', async () => {
  const fx = await seedFixture();
  await expect(
    runCommand(testDb, itemCreate, env(fx.actorId, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), {
      projectKey: fx.projectKey,
      typeKey: 'task',
      values: {}, // no title
    }),
  ).rejects.toThrow(/required/);
});
```

Adjust `typeKey`/required field to the seeded software scheme (inspect `softwareScheme.types`). Pick a type that places a `title` string field and a workflow `status` field.

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/item/create.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/item/create.ts apps/api/src/routes/items.routes.ts apps/api/src/command/item/create.test.ts
git commit -m "feat(api): item.create command + POST /api/projects/:key/items"
```

---

### Task 8: `item.update` command + route

**Files:**
- Create: `apps/api/src/command/item/update.ts`
- Modify: `apps/api/src/routes/items.routes.ts` (add the PATCH route)
- Create: `apps/api/src/command/item/update.test.ts`

**Interfaces:**
- Consumes: T3–T6.
- Produces: `itemUpdate` command (`kind: 'item.update'`), `PATCH /api/items/:id`.

- [ ] **Step 1: Write the command**

```ts
// apps/api/src/command/item/update.ts
import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import { itemValues } from '@tickets/db';
import { items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { buildValueRows } from '../../values/build-value-rows';
import { renderValue } from '../../values/render-value';
import { itemArchived, itemFieldChanged, itemReparented, itemRestored } from './events';
import { checkParent, checkTransition, lockItem, runTransitionGuard, transitionEdge } from './helpers';

export const itemUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  expectedUpdatedAt: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  archived: v.optional(v.boolean()),
  values: v.optional(v.record(v.string(), v.unknown())),
});

export const itemUpdate = defineCommand({
  kind: 'item.update',
  input: itemUpdateInput,
  aggregate: (input) => ({ type: 'item', id: input.id }),
  async handler(tx, input, ctx) {
    const item = await lockItem(tx, input.id, input.expectedUpdatedAt);
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const typeId = item.typeId; // type is immutable
    ctx.projectId = item.projectId;

    if (input.parentId !== undefined && input.parentId !== item.parentId) {
      if (input.parentId !== null) {
        await checkParent(tx, vocab, { itemId: item.id, parentId: input.parentId, childTypeId: typeId });
      }
      await tx.update(items).set({ parentId: input.parentId }).where(eq(items.id, item.id));
      await ctx.emit(itemReparented, { from: item.parentId, to: input.parentId });
    }

    if (input.archived !== undefined) {
      const { sql } = await import('drizzle-orm');
      await tx.update(items).set({ archivedAt: input.archived ? sql`now()` : null }).where(eq(items.id, item.id));
      await ctx.emit(input.archived ? itemArchived : itemRestored, {});
    }

    const wf = vocab.workflowField(typeId);
    for (const [fieldKey, value] of Object.entries(input.values ?? {})) {
      const field = vocab.fieldByTypeKey.get(`${typeId}:${fieldKey}`);
      if (!field || field.archivedAt) throw new HttpError(400, `unknown field "${fieldKey}" for this item type`);

      const currentRows = await tx
        .select()
        .from(itemValues)
        .where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, field.id)));
      const from = currentRows.length === 0 ? null
        : currentRows.length === 1 ? renderValue(vocab, currentRows[0]!)
        : currentRows.map((r) => renderValue(vocab, r));

      const nextRows = buildValueRows(vocab, typeId, fieldKey, value);

      // workflow field: transition legality + guard
      if (wf && field.id === wf.id) {
        const toOptionId = nextRows[0]?.optionId;
        if (!toOptionId) throw new HttpError(400, 'status cannot be cleared');
        const fromOptionId = currentRows[0]?.optionId ?? null;
        if (fromOptionId !== toOptionId) {
          checkTransition(vocab, { fieldId: field.id, typeId, fromOptionId, toOptionId });
          const edge = transitionEdge(vocab, { fieldId: field.id, typeId, fromOptionId, toOptionId });
          await runTransitionGuard(tx, vocab, { itemId: item.id, typeId, edge });
        }
      }

      // replace semantics
      await tx.delete(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, field.id)));
      if (nextRows.length > 0) {
        await tx.insert(itemValues).values(nextRows.map((r) => ({ ...r, itemId: item.id })));
      }
      await ctx.emit(itemFieldChanged, { fieldKey, from, to: value ?? null });
    }

    const finalRows = await tx.select().from(items).where(eq(items.id, item.id));
    return { id: item.id, updatedAt: finalRows[0]?.updatedAt };
  },
});
```

Note: move the `import { sql }` to the top of the file (shown inline only to keep the diff local); the implementer should hoist it.

- [ ] **Step 2: Add the route**

```ts
// apps/api/src/routes/items.routes.ts — add inside registerItemsRoutes
import { itemUpdate } from '../command/item/update';
import { parseId } from '../utils/parse-id';

app.patch('/api/items/:id', async (request, reply) => {
  const id = parseId((request.params as { id: string }).id);
  const envelope = parseEnvelope(request.body);
  const result = await runCommand(db, itemUpdate, envelope, { id, ...(request.body as object) });
  reply.send(result);
});
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/item/update.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemUpdate } from './update';

beforeEach(resetDb);
afterAll(resetDb);

async function makeItem(actorId: number, projectKey: string) {
  return runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId }, {
    projectKey, typeKey: 'task', values: { title: 'X' },
  });
}

it('changes a field value and emits item.field_changed with fieldKey (never fieldId)', async () => {
  const fx = await seedFixture();
  const created = await makeItem(fx.actorId, fx.projectKey);
  const res = await runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    id: created.id, expectedUpdatedAt: created.updatedAt, values: { title: 'Y' },
  });
  expect(res.id).toBe(created.id);
  const changed = await testDb.select().from(events).where(eq(events.kind, 'item.field_changed'));
  expect(changed).toHaveLength(1);
  const payload = changed[0]!.payload as Record<string, unknown>;
  expect(payload.fieldKey).toBe('title');
  expect(payload).not.toHaveProperty('fieldId');
});

it('rejects a stale expectedUpdatedAt with 409', async () => {
  const fx = await seedFixture();
  const created = await makeItem(fx.actorId, fx.projectKey);
  await expect(
    runCommand(testDb, itemUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
      id: created.id, expectedUpdatedAt: '1999-01-01 00:00:00+00', values: { title: 'Z' },
    }),
  ).rejects.toMatchObject({ statusCode: 409 });
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/item/update.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/item/update.ts apps/api/src/routes/items.routes.ts apps/api/src/command/item/update.test.ts
git commit -m "feat(api): item.update command + PATCH /api/items/:id"
```

---

### Task 9: `item.comment`, `item.link`, `item.unlink` commands + routes

**Files:**
- Create: `apps/api/src/command/item/comment.ts`
- Create: `apps/api/src/command/item/link.ts`
- Modify: `apps/api/src/routes/items.routes.ts`; Create: `apps/api/src/routes/links.routes.ts`
- Create: `apps/api/src/command/item/comment.test.ts`, `apps/api/src/command/item/link.test.ts`

**Interfaces:**
- Produces: `itemComment` (`kind: 'item.comment'`), `itemLink` (`kind: 'item.link'`), `itemUnlink` (`kind: 'item.unlink'`).

- [ ] **Step 1: Write `item.comment`**

```ts
// apps/api/src/command/item/comment.ts
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { comments, items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { commentAdded } from './events';

export const itemCommentInput = v.object({
  itemId: v.pipe(v.number(), v.integer()),
  body: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
});

export const itemComment = defineCommand({
  kind: 'item.comment',
  input: itemCommentInput,
  aggregate: (input) => ({ type: 'item', id: input.itemId }),
  async handler(tx, input, ctx) {
    const itemRows = await tx.select().from(items).where(eq(items.id, input.itemId));
    const item = itemRows[0];
    if (!item) throw new HttpError(404, 'item not found');
    ctx.projectId = item.projectId;
    const inserted = await tx
      .insert(comments)
      .values({ itemId: input.itemId, authorId: ctx.envelope.actorId, parentId: input.parentId ?? null, body: input.body })
      .returning();
    const comment = inserted[0]!;
    await ctx.emit(commentAdded, { commentId: comment.id, body: input.body });
    return { id: comment.id };
  },
});
```

- [ ] **Step 2: Write `item.link` / `item.unlink`**

```ts
// apps/api/src/command/item/link.ts
import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import { itemLinks, items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemLinked, itemUnlinked } from './events';

export const itemLinkInput = v.object({
  sourceItemId: v.pipe(v.number(), v.integer()),
  targetItemId: v.pipe(v.number(), v.integer()),
  linkTypeKey: v.pipe(v.string(), v.minLength(1)),
});

export const itemLink = defineCommand({
  kind: 'item.link',
  input: itemLinkInput,
  aggregate: (input) => ({ type: 'item', id: input.sourceItemId }),
  async handler(tx, input, ctx) {
    if (input.sourceItemId === input.targetItemId) throw new HttpError(422, 'an item cannot link to itself');
    const rows = await tx.select().from(items).where(eq(items.id, input.sourceItemId));
    const source = rows[0];
    if (!source) throw new HttpError(404, 'source item not found');
    ctx.projectId = source.projectId;
    const vocab = await loadSchemeVocab(tx, { id: source.projectId });
    const linkType = vocab.linkTypeByTypeKey.get(`${source.typeId}:${input.linkTypeKey}`);
    if (!linkType) throw new HttpError(400, `unknown link type "${input.linkTypeKey}" for this item type`);
    const targetRows = await tx.select().from(items).where(eq(items.id, input.targetItemId));
    const target = targetRows[0];
    if (!target) throw new HttpError(404, 'target item not found');
    const allowedTargets = vocab.linkTypeTargets.get(linkType.id);
    if (allowedTargets && !allowedTargets.has(target.typeId)) {
      throw new HttpError(422, `"${input.linkTypeKey}" cannot target this item type`);
    }
    const inserted = await tx
      .insert(itemLinks)
      .values({ linkTypeId: linkType.id, sourceItemId: input.sourceItemId, targetItemId: input.targetItemId })
      .returning();
    await ctx.emit(itemLinked, { linkTypeKey: input.linkTypeKey, targetItemId: input.targetItemId });
    return { id: inserted[0]!.id };
  },
});

export const itemUnlinkInput = v.object({ id: v.pipe(v.number(), v.integer()) });

export const itemUnlink = defineCommand({
  kind: 'item.unlink',
  input: itemUnlinkInput,
  aggregate: () => ({ type: 'item' }),
  async handler(tx, input, ctx) {
    const rows = await tx.select().from(itemLinks).where(eq(itemLinks.id, input.id));
    const link = rows[0];
    if (!link) throw new HttpError(404, 'link not found');
    const source = (await tx.select().from(items).where(eq(items.id, link.sourceItemId)))[0]!;
    const vocab = await loadSchemeVocab(tx, { id: source.projectId });
    const linkTypeKey = [...vocab.linkTypeByTypeKey.entries()].find(([, lt]) => lt.id === link.linkTypeId)?.[1].key ?? '';
    ctx.aggregateId = link.sourceItemId;
    ctx.projectId = source.projectId;
    await tx.delete(itemLinks).where(eq(itemLinks.id, input.id));
    await ctx.emit(itemUnlinked, { linkTypeKey, targetItemId: link.targetItemId });
    return { id: input.id };
  },
});
```

- [ ] **Step 3: Write the routes**

```ts
// apps/api/src/routes/items.routes.ts — add the comment route
import { itemComment } from '../command/item/comment';

app.post('/api/items/:id/comments', async (request, reply) => {
  const id = parseId((request.params as { id: string }).id);
  const envelope = parseEnvelope(request.body);
  const result = await runCommand(db, itemComment, envelope, { itemId: id, ...(request.body as object) });
  reply.status(201).send(result);
});
```

```ts
// apps/api/src/routes/links.routes.ts
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { itemLink, itemUnlink } from '../command/item/link';
import { parseId } from '../utils/parse-id';

export function registerLinksRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.post('/api/links', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemLink, envelope, request.body);
    reply.status(201).send(result);
  });
  app.delete('/api/links/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemUnlink, envelope, { id });
    reply.send(result);
  });
}
```

- [ ] **Step 4: Write the failing tests**

```ts
// apps/api/src/command/item/comment.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { comments, events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemComment } from './comment';

beforeEach(resetDb);
afterAll(resetDb);

it('adds a comment and emits comment.added', async () => {
  const fx = await seedFixture();
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'X' },
  });
  const res = await runCommand(testDb, itemComment, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemId: item.id, body: 'hello',
  });
  expect((await testDb.select().from(comments).where(eq(comments.id, res.id)))).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'comment.added')))).toHaveLength(1);
});
```

```ts
// apps/api/src/command/item/link.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemLinks } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { itemCreate } from './create';
import { itemLink, itemUnlink } from './link';

beforeEach(resetDb);
afterAll(resetDb);

it('links two items and unlinks, emitting item.linked / item.unlinked on the source stream', async () => {
  const fx = await seedFixture();
  const a = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const b = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'B' },
  });
  const linkTypeKey = 'blocks'; // adjust to a link type the 'task' type owns in the seed
  const link = await runCommand(testDb, itemLink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceItemId: a.id, targetItemId: b.id, linkTypeKey,
  });
  expect((await testDb.select().from(itemLinks).where(eq(itemLinks.id, link.id)))).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'item.linked')))).toHaveLength(1);

  await runCommand(testDb, itemUnlink, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id: link.id });
  expect((await testDb.select().from(itemLinks).where(eq(itemLinks.id, link.id)))).toHaveLength(0);
  expect((await testDb.select().from(events).where(eq(events.kind, 'item.unlinked')))).toHaveLength(1);
});
```

Adjust `linkTypeKey` to a real link type the seeded `task` type owns (inspect `softwareScheme`). If the seed defines no link types with target restrictions, the target check is skipped.

- [ ] **Step 5: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/item/comment.test.ts src/command/item/link.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/item/comment.ts apps/api/src/command/item/link.ts apps/api/src/routes/items.routes.ts apps/api/src/routes/links.routes.ts apps/api/src/command/item/comment.test.ts apps/api/src/command/item/link.test.ts
git commit -m "feat(api): item.comment, item.link, item.unlink commands + routes"
```

---

### Task 10: Read path — assemble items, board, item events

**Files:**
- Create: `apps/api/src/read/assemble-items.ts`
- Create: `apps/api/src/read/board.ts`
- Modify: `apps/api/src/routes/items.routes.ts` (add `GET /api/items/:id/events`)
- Create: `apps/api/src/routes/board.routes.ts` (`GET /api/projects/:key/board`)
- Create: `apps/api/src/read/board.test.ts`

**Interfaces:**
- Consumes: `SchemeVocab` (T4), `renderValue` (T5).
- Produces: `assembleItems(db, vocab): Promise<AssembledItem[]>`; `buildBoard(db, key): Promise<Board>`.

- [ ] **Step 1: Write `assemble-items`**

```ts
// apps/api/src/read/assemble-items.ts
import { eq, inArray, or } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { comments, itemLinks, itemValues, items } from '@tickets/db';
import { renderValue } from '../values/render-value';
import type { SchemeVocab } from '../vocab/load-scheme-vocab';

export async function assembleItems(db: DbExecutor, vocab: SchemeVocab) {
  const itemRows = await db.select().from(items).where(eq(items.projectId, vocab.project.id));
  if (itemRows.length === 0) return [];
  const ids = itemRows.map((r) => r.id);

  const [valueRows, commentRows, linkRows] = await Promise.all([
    db.select().from(itemValues).where(inArray(itemValues.itemId, ids)),
    db.select().from(comments).where(inArray(comments.itemId, ids)),
    db.select().from(itemLinks).where(or(inArray(itemLinks.sourceItemId, ids), inArray(itemLinks.targetItemId, ids))),
  ]);

  const valuesByItem = new Map<number, Record<string, unknown>>();
  for (const row of valueRows) {
    const field = vocab.fieldById.get(row.fieldId);
    if (!field) continue;
    const bucket = valuesByItem.get(row.itemId) ?? {};
    const rendered = renderValue(vocab, row);
    const multiple = (field.config as { multiple?: boolean }).multiple === true;
    if (multiple) {
      const existing = (bucket[field.key] as unknown[] | undefined) ?? [];
      existing.push(rendered);
      bucket[field.key] = existing;
    } else {
      bucket[field.key] = rendered;
    }
    valuesByItem.set(row.itemId, bucket);
  }

  const commentsByItem = new Map<number, typeof commentRows>();
  for (const row of commentRows) {
    const bucket = commentsByItem.get(row.itemId) ?? [];
    bucket.push(row);
    commentsByItem.set(row.itemId, bucket);
  }
  const linksByItem = new Map<number, typeof linkRows>();
  for (const row of linkRows) {
    for (const itemId of [row.sourceItemId, row.targetItemId]) {
      const bucket = linksByItem.get(itemId) ?? [];
      if (!bucket.includes(row)) bucket.push(row);
      linksByItem.set(itemId, bucket);
    }
  }

  return itemRows.map((row) => ({
    id: row.id,
    number: row.number,
    typeId: row.typeId,
    parentId: row.parentId,
    createdBy: row.createdBy,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    values: valuesByItem.get(row.id) ?? {},
    comments: commentsByItem.get(row.id) ?? [],
    links: linksByItem.get(row.id) ?? [],
  }));
}

export type AssembledItem = Awaited<ReturnType<typeof assembleItems>>[number];
```

- [ ] **Step 2: Write `board`**

```ts
// apps/api/src/read/board.ts
import { inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { itemTypeFields, options } from '@tickets/db';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { assembleItems } from './assemble-items';

// New shape: no statuses[]/transitions[] arrays. Workflow columns and lifecycle
// rollups derive from options.kind + option_transitions.
export async function buildBoard(db: Db, key: string) {
  const vocab = await loadSchemeVocab(db, { key });
  const typeIds = vocab.types.map((t) => t.id);
  const [placements, allOptions] = await Promise.all([
    typeIds.length ? db.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds)) : [],
    db.select().from(options).where(inArray(options.optionSetId, [...new Set([...vocab.fieldById.values()].map((f) => f.optionSetId).filter((x): x is number => x != null))])),
  ]);
  const items = await assembleItems(db, vocab);
  return {
    project: vocab.project,
    types: vocab.types,
    fields: [...vocab.fieldById.values()],
    placements,
    options: allOptions,
    transitions: vocab.transitions,
    linkTypes: [...vocab.linkTypeByTypeKey.values()],
    views: vocab.views,
    users: [...vocab.usersById.values()],
    items,
  };
}

export type Board = Awaited<ReturnType<typeof buildBoard>>;
```

- [ ] **Step 3: Write the routes**

```ts
// apps/api/src/routes/board.routes.ts
import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { events, users } from '@tickets/db';
import { buildBoard } from '../read/board';
import { parseId } from '../utils/parse-id';

export function registerBoardRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.get('/api/projects/:key/board', async (request, reply) => {
    const { key } = request.params as { key: string };
    reply.send(await buildBoard(db, key));
  });

  // item event history (reads the events log; imported version:0 rows show as history)
  app.get('/api/items/:id/events', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const query = request.query as { skip?: string; take?: string };
    const skip = Math.max(0, Number(query.skip ?? 0) || 0);
    const take = Math.min(200, Math.max(1, Number(query.take ?? 50) || 50));
    const stream = and(eq(events.aggregateType, 'item'), eq(events.aggregateId, id));
    const [rows, total] = await Promise.all([
      db
        .select({
          id: events.id, seq: events.seq, kind: events.kind, payload: events.payload,
          actorId: events.actorId, actorName: users.name, at: events.at, version: events.version,
        })
        .from(events)
        .innerJoin(users, eq(users.id, events.actorId))
        .where(stream)
        .orderBy(desc(events.seq), desc(events.id))
        .offset(skip)
        .limit(take),
      db.select({ value: count() }).from(events).where(stream),
    ]);
    reply.send({ data: rows, meta: { skip, take, total: total[0]?.value ?? 0, sort: '-seq' } });
  });
}
```

- [ ] **Step 4: Write the failing test**

```ts
// apps/api/src/read/board.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';
import { buildBoard } from './board';

beforeEach(resetDb);
afterAll(resetDb);

it('assembles a board with items whose option values render as strings', async () => {
  const fx = await seedFixture();
  await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'Board me' },
  });
  const board = await buildBoard(testDb, fx.projectKey);
  expect(board.project.key).toBe(fx.projectKey);
  expect(board.items).toHaveLength(1);
  expect(board.items[0]!.values.title).toBe('Board me');
  expect(typeof board.items[0]!.values.status).toBe('string'); // option renders to its value
  expect(board.options.length).toBeGreaterThan(0);
});
```

- [ ] **Step 5: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/read/board.test.ts`
Expected: PASS.

```bash
git add apps/api/src/read/ apps/api/src/routes/board.routes.ts apps/api/src/routes/items.routes.ts
git commit -m "feat(api): read path — assemble items, board, item event history"
```

---

### Task 11: config event kinds + `field.create` / `field.update`

**Files:**
- Create: `apps/api/src/command/config/events.ts`
- Create: `apps/api/src/command/config/field.ts`
- Create: `apps/api/src/routes/vocabulary.routes.ts` (config routes; extended by T12–T14)
- Create: `apps/api/src/command/config/field.test.ts`

**Interfaces:**
- Produces config events (each `version: 1`): `fieldCreated`/`fieldPlaced`/`fieldUpdated` (`aggregateType: 'field'`), `optionCreated`/`optionUpdated` (`'option'`), `transitionCreated`/`transitionDeleted` (`'transition'`), `linkTypeCreated` (`'link_type'`), `schemeForked` (`'scheme'`), `projectCreated` (`'project'`), `userCreated` (`'user'`), `viewCreated`/`viewUpdated` (`'view'`).
- Produces commands `fieldCreate` (`kind: 'field.create'`), `fieldUpdate` (`kind: 'field.update'`).

- [ ] **Step 1: Write all config event definitions**

```ts
// apps/api/src/command/config/events.ts
import * as v from 'valibot';
import { defineEvent } from '../../event/registry';

const cfg = (kind: string, aggregateType: string, payload: v.GenericSchema) =>
  defineEvent({ kind, aggregateType, version: 1, payload });

export const fieldCreated = cfg('field.created', 'field',
  v.object({ schemeId: v.number(), key: v.string(), label: v.string(), type: v.string() }));
export const fieldPlaced = cfg('field.placed', 'field',
  v.object({ itemTypeId: v.number(), position: v.number(), required: v.boolean() }));
export const fieldUpdated = cfg('field.updated', 'field',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
export const optionCreated = cfg('option.created', 'option',
  v.object({ optionSetId: v.number(), value: v.string(), label: v.string(), kind: v.nullable(v.string()) }));
export const optionUpdated = cfg('option.updated', 'option',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
export const transitionCreated = cfg('transition.created', 'transition',
  v.object({ fieldId: v.number(), fromOptionId: v.nullable(v.number()), toOptionId: v.number(), itemTypeId: v.nullable(v.number()) }));
export const transitionDeleted = cfg('transition.deleted', 'transition', v.object({}));
export const linkTypeCreated = cfg('link_type.created', 'link_type',
  v.object({ itemTypeId: v.number(), key: v.string(), label: v.string() }));
export const schemeForked = cfg('scheme.forked', 'scheme',
  v.object({ sourceSchemeId: v.number(), key: v.string(), name: v.string() }));
export const projectCreated = cfg('project.created', 'project',
  v.object({ key: v.string(), name: v.string(), itemPrefix: v.string(), schemeId: v.number() }));
export const userCreated = cfg('user.created', 'user',
  v.object({ name: v.string(), kind: v.string() }));
export const viewCreated = cfg('view.created', 'view',
  v.object({ projectId: v.number(), name: v.string() }));
export const viewUpdated = cfg('view.updated', 'view',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
```

- [ ] **Step 2: Write `field.create` / `field.update`**

```ts
// apps/api/src/command/config/field.ts
import * as v from 'valibot';
import { count, eq } from 'drizzle-orm';
import { fields, itemTypeFields, itemTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { fieldCreated, fieldPlaced, fieldUpdated } from './events';

const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json'] as const;

export const fieldCreateInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  type: v.picklist(FIELD_TYPES),
  required: v.optional(v.boolean()),
  config: v.optional(v.record(v.string(), v.unknown())),
  optionSetId: v.optional(v.pipe(v.number(), v.integer())),
});

export const fieldCreate = defineCommand({
  kind: 'field.create',
  input: fieldCreateInput,
  aggregate: () => ({ type: 'field' }),
  async handler(tx, input, ctx) {
    const typeRows = await tx.select().from(itemTypes).where(eq(itemTypes.id, input.itemTypeId));
    const type = typeRows[0];
    if (!type) throw new HttpError(400, 'unknown item type');
    if (input.type === 'option' && input.optionSetId === undefined) {
      throw new HttpError(400, 'an option field needs an optionSetId');
    }
    // create the scheme-library field
    const inserted = await tx
      .insert(fields)
      .values({
        schemeId: type.schemeId,
        key: input.key,
        label: input.label,
        type: input.type,
        config: input.config ?? {},
        optionSetId: input.optionSetId ?? null,
      })
      .returning();
    const field = inserted[0]!;
    ctx.aggregateId = field.id;
    await ctx.emit(fieldCreated, { schemeId: type.schemeId, key: field.key, label: field.label, type: field.type });
    // place it on the type at the next position
    const position = (await tx.select({ n: count() }).from(itemTypeFields).where(eq(itemTypeFields.itemTypeId, type.id)))[0]?.n ?? 0;
    await tx.insert(itemTypeFields).values({
      itemTypeId: type.id, fieldId: field.id, position: Number(position), required: input.required ?? false,
    });
    await ctx.emit(fieldPlaced, { itemTypeId: type.id, position: Number(position), required: input.required ?? false });
    return { id: field.id };
  },
});

export const fieldUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.string()),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

export const fieldUpdate = defineCommand({
  kind: 'field.update',
  input: fieldUpdateInput,
  aggregate: (input) => ({ type: 'field', id: input.id }),
  async handler(tx, input, ctx) {
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (input.archived !== undefined) {
      const { sql } = await import('drizzle-orm');
      set.archivedAt = input.archived ? sql`now()` : null;
      changes.archived = input.archived;
    }
    if (Object.keys(set).length === 0) throw new HttpError(400, 'no field changes supplied');
    const updated = await tx.update(fields).set(set).where(eq(fields.id, input.id)).returning();
    if (!updated[0]) throw new HttpError(404, 'field not found');
    await ctx.emit(fieldUpdated, { changes });
    return { id: input.id };
  },
});
```

Implementer: hoist `import { sql } from 'drizzle-orm'` to the file top.

- [ ] **Step 3: Write the config routes (field endpoints)**

```ts
// apps/api/src/routes/vocabulary.routes.ts
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { fieldCreate, fieldUpdate } from '../command/config/field';
import { parseId } from '../utils/parse-id';

export function registerVocabularyRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/types/:typeId/fields', async (request, reply) => {
    const typeId = parseId((request.params as { typeId: string }).typeId);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldCreate, envelope, { itemTypeId: typeId, ...(request.body as object) });
    reply.status(201).send(result);
  });

  app.patch('/api/fields/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldUpdate, envelope, { id, ...(request.body as object) });
    reply.send(result);
  });
}
```

- [ ] **Step 4: Write the failing test**

```ts
// apps/api/src/command/config/field.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, fields, itemTypeFields } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { fieldCreate } from './field';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a scheme-library field, places it, and emits field.created + field.placed', async () => {
  const fx = await seedFixture();
  const typeId = fx.typeIdByKey.get('task')!;
  const res = await runCommand(testDb, fieldCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: typeId, key: 'story_points', label: 'Story Points', type: 'number',
  });
  expect((await testDb.select().from(fields).where(eq(fields.id, res.id)))).toHaveLength(1);
  expect((await testDb.select().from(itemTypeFields).where(eq(itemTypeFields.fieldId, res.id)))).toHaveLength(1);
  const kinds = (await testDb.select().from(events)).map((e) => e.kind);
  expect(kinds).toContain('field.created');
  expect(kinds).toContain('field.placed');
});
```

- [ ] **Step 5: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/config/field.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/config/events.ts apps/api/src/command/config/field.ts apps/api/src/routes/vocabulary.routes.ts apps/api/src/command/config/field.test.ts
git commit -m "feat(api): config event kinds + field.create/field.update"
```

---

### Task 12: `option.create` / `option.update`

**Files:**
- Create: `apps/api/src/command/config/option.ts`
- Modify: `apps/api/src/routes/vocabulary.routes.ts`
- Create: `apps/api/src/command/config/option.test.ts`

- [ ] **Step 1: Write the commands**

```ts
// apps/api/src/command/config/option.ts
import * as v from 'valibot';
import { count, eq } from 'drizzle-orm';
import { fields, options } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { optionCreated, optionUpdated } from './events';

const KINDS = ['todo', 'active', 'blocked', 'done', 'dropped'] as const;

// POST /api/fields/:id/options — add an option to the field's option set.
// A workflow status is exactly this: an option with a lifecycle `kind`.
export const optionCreateInput = v.object({
  fieldId: v.pipe(v.number(), v.integer()),
  value: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  kind: v.optional(v.nullable(v.picklist(KINDS))),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const optionCreate = defineCommand({
  kind: 'option.create',
  input: optionCreateInput,
  aggregate: () => ({ type: 'option' }),
  async handler(tx, input, ctx) {
    const fieldRows = await tx.select().from(fields).where(eq(fields.id, input.fieldId));
    const field = fieldRows[0];
    if (!field || field.optionSetId == null) throw new HttpError(400, 'field has no option set');
    const position = Number(
      (await tx.select({ n: count() }).from(options).where(eq(options.optionSetId, field.optionSetId)))[0]?.n ?? 0,
    );
    const inserted = await tx
      .insert(options)
      .values({
        optionSetId: field.optionSetId, value: input.value, label: input.label,
        position, kind: input.kind ?? null, config: input.config ?? {},
      })
      .returning();
    const option = inserted[0]!;
    ctx.aggregateId = option.id;
    await ctx.emit(optionCreated, {
      optionSetId: field.optionSetId, value: option.value, label: option.label, kind: option.kind,
    });
    return { id: option.id };
  },
});

export const optionUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.string()),
  kind: v.optional(v.nullable(v.picklist(KINDS))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

export const optionUpdate = defineCommand({
  kind: 'option.update',
  input: optionUpdateInput,
  aggregate: (input) => ({ type: 'option', id: input.id }),
  async handler(tx, input, ctx) {
    const set: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.kind !== undefined) { set.kind = input.kind; changes.kind = input.kind; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (input.archived !== undefined) {
      const { sql } = await import('drizzle-orm');
      set.archivedAt = input.archived ? sql`now()` : null;
      changes.archived = input.archived;
    }
    if (Object.keys(set).length === 0) throw new HttpError(400, 'no option changes supplied');
    const updated = await tx.update(options).set(set).where(eq(options.id, input.id)).returning();
    if (!updated[0]) throw new HttpError(404, 'option not found');
    await ctx.emit(optionUpdated, { changes });
    return { id: input.id };
  },
});
```

- [ ] **Step 2: Add the routes**

```ts
// apps/api/src/routes/vocabulary.routes.ts — add
import { optionCreate, optionUpdate } from '../command/config/option';

app.post('/api/fields/:id/options', async (request, reply) => {
  const fieldId = parseId((request.params as { id: string }).id);
  const envelope = parseEnvelope(request.body);
  const result = await runCommand(db, optionCreate, envelope, { fieldId, ...(request.body as object) });
  reply.status(201).send(result);
});

app.patch('/api/options/:id', async (request, reply) => {
  const id = parseId((request.params as { id: string }).id);
  const envelope = parseEnvelope(request.body);
  const result = await runCommand(db, optionUpdate, envelope, { id, ...(request.body as object) });
  reply.send(result);
});
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/config/option.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, options } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { optionCreate } from './option';

beforeEach(resetDb);
afterAll(resetDb);

it('adds a status option (an option with a kind) and emits option.created', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  const statusFieldId = vocab.workflowField(typeId)!.id;
  const res = await runCommand(testDb, optionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: statusFieldId, value: 'archived-status', label: 'Archived', kind: 'done',
  });
  const row = (await testDb.select().from(options).where(eq(options.id, res.id)))[0]!;
  expect(row.kind).toBe('done');
  expect((await testDb.select().from(events).where(eq(events.kind, 'option.created')))).toHaveLength(1);
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/config/option.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/config/option.ts apps/api/src/routes/vocabulary.routes.ts apps/api/src/command/config/option.test.ts
git commit -m "feat(api): option.create/option.update (statuses fold into options)"
```

---

### Task 13: `transition.create` / `transition.delete`

**Files:**
- Create: `apps/api/src/command/config/transition.ts`
- Modify: `apps/api/src/routes/vocabulary.routes.ts`
- Create: `apps/api/src/command/config/transition.test.ts`

- [ ] **Step 1: Write the commands**

```ts
// apps/api/src/command/config/transition.ts
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { optionTransitions } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { transitionCreated, transitionDeleted } from './events';

export const transitionCreateInput = v.object({
  fieldId: v.pipe(v.number(), v.integer()),
  fromOptionId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  toOptionId: v.pipe(v.number(), v.integer()),
  itemTypeId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const transitionCreate = defineCommand({
  kind: 'transition.create',
  input: transitionCreateInput,
  aggregate: () => ({ type: 'transition' }),
  async handler(tx, input, ctx) {
    const inserted = await tx
      .insert(optionTransitions)
      .values({
        fieldId: input.fieldId,
        fromOptionId: input.fromOptionId ?? null,
        toOptionId: input.toOptionId,
        itemTypeId: input.itemTypeId ?? null,
        config: input.config ?? {},
      })
      .returning();
    const row = inserted[0]!;
    ctx.aggregateId = row.id;
    await ctx.emit(transitionCreated, {
      fieldId: row.fieldId, fromOptionId: row.fromOptionId, toOptionId: row.toOptionId, itemTypeId: row.itemTypeId,
    });
    return { id: row.id };
  },
});

export const transitionDeleteInput = v.object({ id: v.pipe(v.number(), v.integer()) });

export const transitionDelete = defineCommand({
  kind: 'transition.delete',
  input: transitionDeleteInput,
  aggregate: (input) => ({ type: 'transition', id: input.id }),
  async handler(tx, input, ctx) {
    const deleted = await tx.delete(optionTransitions).where(eq(optionTransitions.id, input.id)).returning();
    if (!deleted[0]) throw new HttpError(404, 'transition not found');
    await ctx.emit(transitionDeleted, {});
    return { id: input.id };
  },
});
```

- [ ] **Step 2: Add the routes**

```ts
// apps/api/src/routes/vocabulary.routes.ts — add
import { transitionCreate, transitionDelete } from '../command/config/transition';

app.post('/api/fields/:id/transitions', async (request, reply) => {
  const fieldId = parseId((request.params as { id: string }).id);
  const envelope = parseEnvelope(request.body);
  const result = await runCommand(db, transitionCreate, envelope, { fieldId, ...(request.body as object) });
  reply.status(201).send(result);
});

app.delete('/api/transitions/:id', async (request, reply) => {
  const id = parseId((request.params as { id: string }).id);
  const envelope = parseEnvelope(request.body);
  const result = await runCommand(db, transitionDelete, envelope, { id });
  reply.send(result);
});
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/config/transition.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, optionTransitions } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { transitionCreate, transitionDelete } from './transition';

beforeEach(resetDb);
afterAll(resetDb);

it('creates and deletes an option transition, emitting the right events', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const typeId = [...vocab.typeById.keys()].find((id) => vocab.workflowField(id))!;
  const wf = vocab.workflowField(typeId)!;
  const opts = vocab.optionsForField(typeId, wf.id);
  const created = await runCommand(testDb, transitionCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    fieldId: wf.id, fromOptionId: opts[0]!.id, toOptionId: opts[1]!.id,
  });
  expect((await testDb.select().from(optionTransitions).where(eq(optionTransitions.id, created.id)))).toHaveLength(1);
  await runCommand(testDb, transitionDelete, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id: created.id });
  expect((await testDb.select().from(optionTransitions).where(eq(optionTransitions.id, created.id)))).toHaveLength(0);
  const kinds = (await testDb.select().from(events)).map((e) => e.kind);
  expect(kinds).toContain('transition.created');
  expect(kinds).toContain('transition.deleted');
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/config/transition.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/config/transition.ts apps/api/src/routes/vocabulary.routes.ts apps/api/src/command/config/transition.test.ts
git commit -m "feat(api): transition.create/transition.delete on option_transitions"
```

---

### Task 14: `linkType.create`

**Files:**
- Create: `apps/api/src/command/config/link-type.ts`
- Modify: `apps/api/src/routes/vocabulary.routes.ts`
- Create: `apps/api/src/command/config/link-type.test.ts`

- [ ] **Step 1: Write the command**

```ts
// apps/api/src/command/config/link-type.ts
import * as v from 'valibot';
import { count, eq } from 'drizzle-orm';
import { itemTypes, linkTypeTargetTypes, linkTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { linkTypeCreated } from './events';

export const linkTypeCreateInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  inverseLabel: v.pipe(v.string(), v.minLength(1)),
  directional: v.boolean(),
  targetTypeIds: v.optional(v.array(v.pipe(v.number(), v.integer()))),
});

export const linkTypeCreate = defineCommand({
  kind: 'linkType.create',
  input: linkTypeCreateInput,
  aggregate: () => ({ type: 'link_type' }),
  async handler(tx, input, ctx) {
    const type = (await tx.select().from(itemTypes).where(eq(itemTypes.id, input.itemTypeId)))[0];
    if (!type) throw new HttpError(400, 'unknown item type');
    const position = Number(
      (await tx.select({ n: count() }).from(linkTypes).where(eq(linkTypes.itemTypeId, input.itemTypeId)))[0]?.n ?? 0,
    );
    const inserted = await tx
      .insert(linkTypes)
      .values({
        itemTypeId: input.itemTypeId, key: input.key, label: input.label,
        inverseLabel: input.inverseLabel, directional: input.directional, position,
      })
      .returning();
    const linkType = inserted[0]!;
    ctx.aggregateId = linkType.id;
    if (input.targetTypeIds?.length) {
      await tx.insert(linkTypeTargetTypes).values(
        input.targetTypeIds.map((targetTypeId) => ({ linkTypeId: linkType.id, targetTypeId })),
      );
    }
    await ctx.emit(linkTypeCreated, { itemTypeId: input.itemTypeId, key: linkType.key, label: linkType.label });
    return { id: linkType.id };
  },
});
```

- [ ] **Step 2: Add the route**

```ts
// apps/api/src/routes/vocabulary.routes.ts — add
import { linkTypeCreate } from '../command/config/link-type';

app.post('/api/types/:typeId/link-types', async (request, reply) => {
  const typeId = parseId((request.params as { typeId: string }).typeId);
  const envelope = parseEnvelope(request.body);
  const result = await runCommand(db, linkTypeCreate, envelope, { itemTypeId: typeId, ...(request.body as object) });
  reply.status(201).send(result);
});
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/config/link-type.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, linkTypes } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { linkTypeCreate } from './link-type';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a link type and emits link_type.created', async () => {
  const fx = await seedFixture();
  const typeId = fx.typeIdByKey.get('task')!;
  const res = await runCommand(testDb, linkTypeCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: typeId, key: 'relates', label: 'Relates to', inverseLabel: 'Related by', directional: false,
  });
  expect((await testDb.select().from(linkTypes).where(eq(linkTypes.id, res.id)))).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'link_type.created')))).toHaveLength(1);
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/config/link-type.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/config/link-type.ts apps/api/src/routes/vocabulary.routes.ts apps/api/src/command/config/link-type.test.ts
git commit -m "feat(api): linkType.create"
```

---

### Task 15: `scheme.fork` (deep clone on the new schema)

**Files:**
- Create: `apps/api/src/command/config/scheme.ts` (the fork command; contains the new-schema deep clone)
- Create: `apps/api/src/routes/schemes.routes.ts`
- Create: `apps/api/src/command/config/scheme.test.ts`

**Interfaces:**
- Produces: `schemeFork` command (`kind: 'scheme.fork'`), `POST /api/schemes/:id/fork`.
- Clone order (new schema): scheme → item_types → option_sets → options → fields → item_type_fields → item_type_child_types → link_types → link_type_target_types → option_transitions. Each level remaps FKs through an id map.

- [ ] **Step 1: Write the fork command**

```ts
// apps/api/src/command/config/scheme.ts
import * as v from 'valibot';
import { eq, inArray } from 'drizzle-orm';
import {
  fields, itemTypeChildTypes, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes,
  optionSets, optionTransitions, options, schemes,
} from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { schemeForked } from './events';

export const schemeForkInput = v.object({
  sourceSchemeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
});

export const schemeFork = defineCommand({
  kind: 'scheme.fork',
  input: schemeForkInput,
  aggregate: () => ({ type: 'scheme' }),
  async handler(tx, input, ctx) {
    const src = (await tx.select().from(schemes).where(eq(schemes.id, input.sourceSchemeId)))[0];
    if (!src) throw new HttpError(400, 'source scheme not found');
    const dst = (await tx.insert(schemes).values({ key: input.key, name: input.name, config: src.config }).returning())[0]!;
    ctx.aggregateId = dst.id;

    // item_types
    const srcTypes = await tx.select().from(itemTypes).where(eq(itemTypes.schemeId, src.id));
    const typeMap = new Map<number, number>();
    for (const t of srcTypes) {
      const n = (await tx.insert(itemTypes).values({ schemeId: dst.id, key: t.key, label: t.label, position: t.position, config: t.config }).returning())[0]!;
      typeMap.set(t.id, n.id);
    }
    // option_sets → options
    const srcSets = await tx.select().from(optionSets).where(eq(optionSets.schemeId, src.id));
    const setMap = new Map<number, number>();
    for (const s of srcSets) {
      const n = (await tx.insert(optionSets).values({ schemeId: dst.id, key: s.key, name: s.name }).returning())[0]!;
      setMap.set(s.id, n.id);
    }
    const setIds = srcSets.map((s) => s.id);
    const srcOptions = setIds.length ? await tx.select().from(options).where(inArray(options.optionSetId, setIds)) : [];
    const optionMap = new Map<number, number>();
    for (const o of srcOptions) {
      const n = (await tx.insert(options).values({ optionSetId: setMap.get(o.optionSetId)!, value: o.value, label: o.label, position: o.position, kind: o.kind, config: o.config }).returning())[0]!;
      optionMap.set(o.id, n.id);
    }
    // fields (scheme-scoped) with remapped optionSetId
    const srcFields = await tx.select().from(fields).where(eq(fields.schemeId, src.id));
    const fieldMap = new Map<number, number>();
    for (const f of srcFields) {
      const n = (await tx.insert(fields).values({ schemeId: dst.id, key: f.key, label: f.label, type: f.type, system: f.system, config: f.config, optionSetId: f.optionSetId == null ? null : setMap.get(f.optionSetId)! }).returning())[0]!;
      fieldMap.set(f.id, n.id);
    }
    // item_type_fields placements
    const typeIds = srcTypes.map((t) => t.id);
    const srcPlacements = typeIds.length ? await tx.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds)) : [];
    if (srcPlacements.length) {
      await tx.insert(itemTypeFields).values(srcPlacements.map((p) => ({ itemTypeId: typeMap.get(p.itemTypeId)!, fieldId: fieldMap.get(p.fieldId)!, position: p.position, required: p.required, configOverride: p.configOverride })));
    }
    // item_type_child_types
    const srcChildren = typeIds.length ? await tx.select().from(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, typeIds)) : [];
    if (srcChildren.length) {
      await tx.insert(itemTypeChildTypes).values(srcChildren.map((c) => ({ parentTypeId: typeMap.get(c.parentTypeId)!, childTypeId: typeMap.get(c.childTypeId)! })));
    }
    // link_types → targets
    const srcLinks = typeIds.length ? await tx.select().from(linkTypes).where(inArray(linkTypes.itemTypeId, typeIds)) : [];
    const linkMap = new Map<number, number>();
    for (const l of srcLinks) {
      const n = (await tx.insert(linkTypes).values({ itemTypeId: typeMap.get(l.itemTypeId)!, key: l.key, label: l.label, inverseLabel: l.inverseLabel, directional: l.directional, position: l.position }).returning())[0]!;
      linkMap.set(l.id, n.id);
    }
    const linkIds = srcLinks.map((l) => l.id);
    const srcTargets = linkIds.length ? await tx.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkIds)) : [];
    if (srcTargets.length) {
      await tx.insert(linkTypeTargetTypes).values(srcTargets.map((r) => ({ linkTypeId: linkMap.get(r.linkTypeId)!, targetTypeId: typeMap.get(r.targetTypeId)! })));
    }
    // option_transitions (remap field, options, type)
    const fieldIds = srcFields.map((f) => f.id);
    const srcTransitions = fieldIds.length ? await tx.select().from(optionTransitions).where(inArray(optionTransitions.fieldId, fieldIds)) : [];
    if (srcTransitions.length) {
      await tx.insert(optionTransitions).values(srcTransitions.map((e) => ({ fieldId: fieldMap.get(e.fieldId)!, fromOptionId: e.fromOptionId == null ? null : optionMap.get(e.fromOptionId)!, toOptionId: optionMap.get(e.toOptionId)!, itemTypeId: e.itemTypeId == null ? null : typeMap.get(e.itemTypeId)!, config: e.config })));
    }

    await ctx.emit(schemeForked, { sourceSchemeId: src.id, key: dst.key, name: dst.name });
    return { schemeId: dst.id };
  },
});
```

Implementer: delete the unused `idMap` stub line — it is a leftover; the real remapping is the per-level `Map`s.

- [ ] **Step 2: Write the route**

```ts
// apps/api/src/routes/schemes.routes.ts
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { schemeFork } from '../command/config/scheme';
import { parseId } from '../utils/parse-id';

export function registerSchemesRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.post('/api/schemes/:id/fork', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, schemeFork, envelope, { sourceSchemeId: id, ...(request.body as object) });
    reply.status(201).send(result);
  });
}
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/config/scheme.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, fields, itemTypes, options } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { schemeFork } from './scheme';

beforeEach(resetDb);
afterAll(resetDb);

it('forks a scheme with all types, fields, and options copied under fresh ids', async () => {
  const fx = await seedFixture();
  const srcTypes = await testDb.select().from(itemTypes).where(eq(itemTypes.schemeId, fx.schemeId));
  const srcFields = await testDb.select().from(fields).where(eq(fields.schemeId, fx.schemeId));

  const res = await runCommand(testDb, schemeFork, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceSchemeId: fx.schemeId, key: 'software-fork', name: 'Software (fork)',
  });

  const dstTypes = await testDb.select().from(itemTypes).where(eq(itemTypes.schemeId, res.schemeId));
  const dstFields = await testDb.select().from(fields).where(eq(fields.schemeId, res.schemeId));
  expect(dstTypes).toHaveLength(srcTypes.length);
  expect(dstFields).toHaveLength(srcFields.length);
  // fresh ids
  expect(dstTypes.every((t) => !srcTypes.some((s) => s.id === t.id))).toBe(true);
  // option-typed fields keep a resolvable option set (fork remapped it)
  for (const f of dstFields.filter((f) => f.optionSetId != null)) {
    expect((await testDb.select().from(options).where(eq(options.optionSetId, f.optionSetId!)))).not.toHaveLength(0);
  }
  expect((await testDb.select().from(events).where(eq(events.kind, 'scheme.forked')))).toHaveLength(1);
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/config/scheme.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/config/scheme.ts apps/api/src/routes/schemes.routes.ts apps/api/src/command/config/scheme.test.ts
git commit -m "feat(api): scheme.fork — deep clone on the new schema"
```

---

### Task 16: `project.create`, `user.create`, `view.create`, `view.update`

**Files:**
- Create: `apps/api/src/command/config/project.ts`, `user.ts`, `view.ts`
- Create: `apps/api/src/routes/projects.routes.ts`, `apps/api/src/routes/users.routes.ts`, `apps/api/src/routes/views.routes.ts`
- Create: `apps/api/src/command/config/simple.test.ts`

- [ ] **Step 1: Write the commands**

```ts
// apps/api/src/command/config/project.ts
import * as v from 'valibot';
import { projects } from '@tickets/db';
import { defineCommand } from '../registry';
import { projectCreated } from './events';

export const projectCreateInput = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  itemPrefix: v.pipe(v.string(), v.minLength(1)),
  schemeId: v.pipe(v.number(), v.integer()),
});

export const projectCreate = defineCommand({
  kind: 'project.create',
  input: projectCreateInput,
  aggregate: () => ({ type: 'project' }),
  async handler(tx, input, ctx) {
    const inserted = await tx.insert(projects).values(input).returning();
    const project = inserted[0]!;
    ctx.aggregateId = project.id;
    await ctx.emit(projectCreated, { key: project.key, name: project.name, itemPrefix: project.itemPrefix, schemeId: project.schemeId });
    return { id: project.id };
  },
});
```

```ts
// apps/api/src/command/config/user.ts
import * as v from 'valibot';
import { users } from '@tickets/db';
import { defineCommand } from '../registry';
import { userCreated } from './events';

export const userCreateInput = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(['human', 'agent']),
  email: v.optional(v.nullable(v.string())),
});

export const userCreate = defineCommand({
  kind: 'user.create',
  input: userCreateInput,
  aggregate: () => ({ type: 'user' }),
  async handler(tx, input, ctx) {
    const inserted = await tx.insert(users).values({ name: input.name, kind: input.kind, email: input.email ?? null }).returning();
    const user = inserted[0]!;
    ctx.aggregateId = user.id;
    await ctx.emit(userCreated, { name: user.name, kind: user.kind });
    return { id: user.id };
  },
});
```

```ts
// apps/api/src/command/config/view.ts
import * as v from 'valibot';
import { count, eq } from 'drizzle-orm';
import { projects, views } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { viewCreated, viewUpdated } from './events';

export const viewCreateInput = v.object({
  projectKey: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const viewCreate = defineCommand({
  kind: 'view.create',
  input: viewCreateInput,
  aggregate: () => ({ type: 'view' }),
  async handler(tx, input, ctx) {
    const project = (await tx.select().from(projects).where(eq(projects.key, input.projectKey)))[0];
    if (!project) throw new HttpError(404, `unknown project "${input.projectKey}"`);
    const position = Number((await tx.select({ n: count() }).from(views).where(eq(views.projectId, project.id)))[0]?.n ?? 0);
    const inserted = await tx.insert(views).values({ projectId: project.id, name: input.name, position, config: input.config ?? {} }).returning();
    const view = inserted[0]!;
    ctx.aggregateId = view.id;
    await ctx.emit(viewCreated, { projectId: project.id, name: view.name });
    return { id: view.id };
  },
});

export const viewUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.optional(v.string()),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const viewUpdate = defineCommand({
  kind: 'view.update',
  input: viewUpdateInput,
  aggregate: (input) => ({ type: 'view', id: input.id }),
  async handler(tx, input, ctx) {
    const set: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};
    if (input.name !== undefined) { set.name = input.name; changes.name = input.name; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (Object.keys(set).length === 0) throw new HttpError(400, 'no view changes supplied');
    const updated = await tx.update(views).set(set).where(eq(views.id, input.id)).returning();
    if (!updated[0]) throw new HttpError(404, 'view not found');
    await ctx.emit(viewUpdated, { changes });
    return { id: input.id };
  },
});
```

- [ ] **Step 2: Write the routes**

```ts
// apps/api/src/routes/projects.routes.ts
import type { FastifyInstance } from 'fastify';
import { asc } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { projects } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { projectCreate } from '../command/config/project';

export function registerProjectsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.get('/api/projects', async (_request, reply) => {
    reply.send({ data: await db.select().from(projects).orderBy(asc(projects.id)) });
  });
  app.post('/api/projects', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, projectCreate, envelope, request.body);
    reply.status(201).send(result);
  });
}
```

```ts
// apps/api/src/routes/users.routes.ts
import type { FastifyInstance } from 'fastify';
import { asc } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { users } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { userCreate } from '../command/config/user';

export function registerUsersRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.get('/api/users', async (_request, reply) => {
    reply.send({ data: await db.select().from(users).orderBy(asc(users.id)) });
  });
  app.post('/api/users', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, userCreate, envelope, request.body);
    reply.status(201).send(result);
  });
}
```

```ts
// apps/api/src/routes/views.routes.ts
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { viewCreate, viewUpdate } from '../command/config/view';
import { parseId } from '../utils/parse-id';

export function registerViewsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.post('/api/projects/:key/views', async (request, reply) => {
    const { key } = request.params as { key: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, viewCreate, envelope, { projectKey: key, ...(request.body as object) });
    reply.status(201).send(result);
  });
  app.patch('/api/views/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, viewUpdate, envelope, { id, ...(request.body as object) });
    reply.send(result);
  });
}
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/command/config/simple.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, projects, users } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { projectCreate } from './project';
import { userCreate } from './user';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a project and a user, each emitting its typed event', async () => {
  const fx = await seedFixture();
  const p = await runCommand(testDb, projectCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    key: 'p2', name: 'Second', itemPrefix: 'P2', schemeId: fx.schemeId,
  });
  expect((await testDb.select().from(projects).where(eq(projects.id, p.id)))).toHaveLength(1);
  const u = await runCommand(testDb, userCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    name: 'agent-bot', kind: 'agent',
  });
  expect((await testDb.select().from(users).where(eq(users.id, u.id)))).toHaveLength(1);
  const kinds = (await testDb.select().from(events)).map((e) => e.kind);
  expect(kinds).toContain('project.created');
  expect(kinds).toContain('user.created');
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/command/config/simple.test.ts`
Expected: PASS.

```bash
git add apps/api/src/command/config/project.ts apps/api/src/command/config/user.ts apps/api/src/command/config/view.ts apps/api/src/routes/projects.routes.ts apps/api/src/routes/users.routes.ts apps/api/src/routes/views.routes.ts apps/api/src/command/config/simple.test.ts
git commit -m "feat(api): project.create, user.create, view.create/update"
```

---

### Task 17: Remaining reads — schema + export

**Files:**
- Modify/Create: `apps/api/src/routes/schema.routes.ts` (`GET /api/schema`), `apps/api/src/routes/board.routes.ts` (add `GET /api/projects/:key/export`)
- Create: `apps/api/src/read/export.ts`
- Create: `apps/api/src/read/export.test.ts`

**Interfaces:**
- `GET /api/schema` returns `describeSchema()` from `@tickets/db` (already exported) — a straight passthrough.
- `GET /api/projects/:key/export` returns the board plus a serialized form suitable for round-trip export.

- [ ] **Step 1: Write `GET /api/schema`**

```ts
// apps/api/src/routes/schema.routes.ts
import type { FastifyInstance } from 'fastify';
import { describeSchema } from '@tickets/db';

export function registerSchemaRoutes(app: FastifyInstance) {
  app.get('/api/schema', async (_request, reply) => {
    reply.send(describeSchema());
  });
}
```

- [ ] **Step 2: Write export**

```ts
// apps/api/src/read/export.ts
import type { Db } from '@tickets/db';
import { buildBoard } from './board';

// The board payload is already the full project snapshot; export wraps it with
// a version tag so a future importer can branch on shape.
export async function buildExport(db: Db, key: string) {
  const board = await buildBoard(db, key);
  return { version: 1, exportedProject: board };
}
```

```ts
// apps/api/src/routes/board.routes.ts — add inside registerBoardRoutes
import { buildExport } from '../read/export';

app.get('/api/projects/:key/export', async (request, reply) => {
  const { key } = request.params as { key: string };
  reply.send(await buildExport(db, key));
});
```

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/read/export.test.ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { buildExport } from './export';

beforeEach(resetDb);
afterAll(resetDb);

it('exports a project snapshot with a version tag', async () => {
  const fx = await seedFixture();
  const out = await buildExport(testDb, fx.projectKey);
  expect(out.version).toBe(1);
  expect(out.exportedProject.project.key).toBe(fx.projectKey);
});
```

- [ ] **Step 4: Run, verify green, commit**

Run: `POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test src/read/export.test.ts`
Expected: PASS.

```bash
git add apps/api/src/routes/schema.routes.ts apps/api/src/read/export.ts apps/api/src/routes/board.routes.ts apps/api/src/read/export.test.ts
git commit -m "feat(api): GET /api/schema and project export"
```

---

### Task 18: Wire the server, delete the dead code, add the guard test, and pass typecheck

**Files:**
- Modify: `apps/api/src/app.ts` (register all new route modules; drop the old ones)
- Modify: `apps/api/src/server.ts` if it references removed symbols
- Delete: `apps/api/src/events/write-event.ts`, `apps/api/src/tickets/*` (assemble-tickets, build-value-rows, render-value, resolve-status, check-transition, check-guard, check-parent, next-ticket-number), `apps/api/src/routes/tickets.routes.ts`, `apps/api/src/vocab/load-project-vocab.ts`, `apps/api/src/vocab/create-field.ts`, `apps/api/src/vocab/create-link-type.ts`, `apps/api/src/schemes/clone-scheme.ts`, `apps/api/src/boards/logical-fields.ts`, and any now-orphaned old route files (`comments.routes.ts`, `links.routes.ts` old versions, `vocabulary.routes.ts` old, `schema.routes.ts` old, `schemes.routes.ts` old, `views.routes.ts` old, `users.routes.ts` old, `projects.routes.ts` old) — replace, don't leave both.
- Create: `apps/api/src/command/no-raw-writes.test.ts` (static guard)
- Modify: any `*.test.ts` that imported the deleted helpers.

**Interfaces:**
- Consumes: every command/route module from T7–T17.

- [ ] **Step 1: Rewrite `app.ts` route registration**

Register exactly the new modules. Example shape (adapt to how `app.ts` builds the Fastify instance and passes `{ db }`):

```ts
// apps/api/src/app.ts — the registration block
import { registerItemsRoutes } from './routes/items.routes';
import { registerLinksRoutes } from './routes/links.routes';
import { registerBoardRoutes } from './routes/board.routes';
import { registerVocabularyRoutes } from './routes/vocabulary.routes';
import { registerSchemesRoutes } from './routes/schemes.routes';
import { registerProjectsRoutes } from './routes/projects.routes';
import { registerUsersRoutes } from './routes/users.routes';
import { registerViewsRoutes } from './routes/views.routes';
import { registerSchemaRoutes } from './routes/schema.routes';

// after the app + db are constructed:
registerProjectsRoutes(app, { db });
registerUsersRoutes(app, { db });
registerItemsRoutes(app, { db });
registerLinksRoutes(app, { db });
registerBoardRoutes(app, { db });
registerVocabularyRoutes(app, { db });
registerSchemesRoutes(app, { db });
registerViewsRoutes(app, { db });
registerSchemaRoutes(app);
```

Remove every `register*` call and import for the old `tickets`/`statuses`/`vocabulary`(old)/`schemes`(old) route modules.

- [ ] **Step 2: Delete the dead files**

```bash
git rm apps/api/src/events/write-event.ts \
  apps/api/src/tickets/assemble-tickets.ts apps/api/src/tickets/build-value-rows.ts \
  apps/api/src/tickets/render-value.ts apps/api/src/tickets/resolve-status.ts \
  apps/api/src/tickets/check-transition.ts apps/api/src/tickets/check-guard.ts \
  apps/api/src/tickets/check-parent.ts apps/api/src/tickets/next-ticket-number.ts \
  apps/api/src/routes/tickets.routes.ts apps/api/src/vocab/load-project-vocab.ts \
  apps/api/src/vocab/create-field.ts apps/api/src/vocab/create-link-type.ts \
  apps/api/src/schemes/clone-scheme.ts apps/api/src/boards/logical-fields.ts
```

Then delete or replace any remaining old route files still importing deleted symbols (grep first, Step 4).

- [ ] **Step 3: Write the static guard test**

```ts
// apps/api/src/command/no-raw-writes.test.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// No route may write events/commands/outbox directly — those go through runCommand/ctx.emit.
it('no route file inserts into events/commands/outbox directly', () => {
  const routesDir = join(import.meta.dirname, '..', 'routes');
  const offenders: string[] = [];
  for (const file of readdirSync(routesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const src = readFileSync(join(routesDir, file), 'utf8');
    if (/\.insert\(\s*(events|commands|outbox)\b/.test(src)) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 4: Find and fix every remaining old-symbol import**

```bash
cd apps/api && grep -rlE "ticketValues|ticketEvents|ticketTypes|ticketLinks|\bstatuses\b|statusTransitions|fieldOptions|ticketPrefix|load-project-vocab|assemble-tickets|write-event" src --include=*.ts
```

Expected after fixes: no matches. Update or delete each file the grep returns (old route files, old tests). Old per-endpoint tests (`schema.routes.test.ts`, `app.test.ts`) either move onto the new routes or are deleted if superseded by the per-command tests.

- [ ] **Step 5: Typecheck and full suite**

```bash
POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/db typecheck
POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api typecheck
POSTGRES_DATABASE=tickets_test pnpm --filter @tickets/api test
```

Expected: both typechecks clean; the api suite green. Root `pnpm typecheck` still fails on `apps/web`/`apps/mcp` — that is expected (SP4), not a regression.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): wire command routes, delete legacy ticket code, guard against raw event writes"
```

---

## Notes for the executor

- **Seed keys (pinned from `packages/db/src/seed/software-scheme.ts`, confirmed 2026-07-15):**
  - Types: `epic`, `task`, `bug`, `spike`, `subtask`. `task` allows child `subtask`; `epic` allows `task`/`bug`/`spike`.
  - Fields on every type include `title` (`string`, system), `status` (`option`, `config.workflow: true`), `priority` (`option`), `assignee` (`user`), `labels` (`option`, `config.multiple: true`), plus `pr` (`string`, used by the resolution guard).
  - Status options carry `kind`: `triage`/`backlog`/`todo` = `todo`, `in-progress`/`in-review`/`merged`/`deployed` = `active`, `blocked` = `blocked`, `done`/`fixed` = `done`, `cancelled`/`wont-fix` = `dropped`. `initialOption` returns the lowest-position `todo` (i.e. `triage`).
  - Link types owned by `task`: `blocks`, `relates-to`, `duplicates`. `blocks` targets `task`/`bug`/`epic`/`spike`/`subtask`, so `task → task` is valid.
  - Tests use these directly. If a test needs a *new* key (e.g. Task 11 creates `story_points`, Task 14 creates `relates`), any key not already in the scheme is fine.
- **`crypto.randomUUID()`** is available in the Node test runtime; use it for per-call `commandId`s except where a test deliberately replays a fixed id (idempotency tests).
- **`import { sql }` hoisting:** three handlers show `const { sql } = await import('drizzle-orm')` inline to keep the diff local — hoist each to a top-of-file `import { sql } from 'drizzle-orm'`.
- **Concurrency test (optional, high-value):** the spec asks for a racing-stream test. If time permits, add one that fires two `item.update`s on the same item with the same loaded `expectedUpdatedAt` and asserts exactly one wins (the other 409s). It is not required for the exit gate but is the strongest proof the optimistic lock holds.
