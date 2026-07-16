# SP4a Phase 2 — Schema-Management Admin (API + UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the API command/event core with the missing schema-config commands (types, placements, link-type edits, option-set auto-create) and build a tabbed `/settings` admin UI in the web app that writes through the command envelope.

**Architecture:** New `apps/api` config commands follow the existing `defineCommand`/`defineEvent`/`runCommand` pattern (`command/config/*`), self-register on import, and get routes in `routes/vocabulary.routes.ts`. The `apps/web` admin reads vocab from the board query and writes via new `apiMutate` hooks. Both sides are **additive** — no existing behaviour changes — so the package stays green per task.

**Tech Stack:** TypeScript, Fastify, Drizzle + postgres-js, valibot, vitest (api: node+tickets_test; web: jsdom+mocked fetch), React 19, TanStack Router/Query, Tailwind v4.

## Global Constraints

- **Additive only.** New commands/events/routes and new web screens/hooks. Do not change existing command behaviour or existing screens. `@tickets/api` and `@tickets/web` typecheck + test (+ web build) stay GREEN every task — root `pnpm typecheck` stays 5/5.
- **Tests:** API against `tickets_test` (harness forces `POSTGRES_DATABASE=tickets_test`; `fileParallelism:false`); web with mocked `fetch`. NEVER touch `tickets` / `tickets_dev` / `tickets_platform`.
- **Every mutation carries the envelope** `{commandId, actorId}` — API commands run through `runCommand`; web hooks go through `apiMutate` (injects `commandId: crypto.randomUUID()` + `actorId` from `useCurrentUser().userId`, guarding `userId === null`).
- **Archive, not delete, for referenced entities** (types, fields, options, link types → set/clear `archivedAt` via an `archived` flag). **Hard-delete/replace** for graph/join rows (transitions, `item_type_child_types`, `link_type_target_types`; the *-Set commands delete-all-then-insert in one txn).
- **Config commands self-register** when their module is imported by `routes/vocabulary.routes.ts`; adding a command = create the module + import it + add the route.
- Conventional commits scoped by app (`feat(api):`, `feat(web):`). One commit per task.
- Config command test pattern: `seedFixture()` → `runCommand(testDb, cmd, {commandId: crypto.randomUUID(), actorId: fx.actorId}, input)` → assert rows + emitted `events.kind`. See `apps/api/src/command/config/field.test.ts`.

---

### Task 1: New config event definitions

**Files:**
- Modify: `apps/api/src/command/config/events.ts`

**Interfaces:**
- Produces (imported by later command tasks): `typeCreated`, `typeUpdated`, `typeChildTypesSet`, `fieldUnplaced`, `placementUpdated`, `linkTypeUpdated`, `linkTypeTargetTypesSet` (all `EventDef`s via the file's `cfg` helper). `fieldPlaced` already exists (reused by `field.place`).

- [ ] **Step 1: Append the new events**

At the end of `apps/api/src/command/config/events.ts` (which already exports `cfg`), add:

```ts
export const typeCreated = cfg('type.created', 'type',
  v.object({ schemeId: v.number(), key: v.string(), label: v.string() }));
export const typeUpdated = cfg('type.updated', 'type',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
export const typeChildTypesSet = cfg('type.child_types_set', 'type',
  v.object({ childTypeIds: v.array(v.number()) }));
export const fieldUnplaced = cfg('field.unplaced', 'field',
  v.object({ itemTypeId: v.number() }));
export const placementUpdated = cfg('placement.updated', 'field',
  v.object({ itemTypeId: v.number(), changes: v.record(v.string(), v.unknown()) }));
export const linkTypeUpdated = cfg('link_type.updated', 'link_type',
  v.object({ changes: v.record(v.string(), v.unknown()) }));
export const linkTypeTargetTypesSet = cfg('link_type.target_types_set', 'link_type',
  v.object({ targetTypeIds: v.array(v.number()) }));
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tickets/api typecheck`
Expected: clean (events are registered lazily; duplicate-kind registration only triggers when imported — no collision here).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/command/config/events.ts
git commit -m "feat(api): config events for type/placement/link-type admin commands"
```

---

### Task 2: `type.create` + `type.update` commands

**Files:**
- Create: `apps/api/src/command/config/type.ts`
- Create: `apps/api/src/command/config/type.test.ts`
- Modify: `apps/api/src/routes/vocabulary.routes.ts`

**Interfaces:**
- Consumes: `typeCreated`, `typeUpdated` (Task 1).
- Produces: `typeCreate` (`POST /api/types`), `typeUpdate` (`PATCH /api/types/:id`).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/command/config/type.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, itemTypes } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { typeCreate, typeUpdate } from './type';

beforeEach(resetDb);
afterAll(resetDb);

it('creates a type at the next position and emits type.created', async () => {
  const fx = await seedFixture();
  const res = await runCommand(testDb, typeCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    schemeId: fx.schemeId, key: 'chore', label: 'Chore', config: { color: '#888' },
  });
  const row = (await testDb.select().from(itemTypes).where(eq(itemTypes.id, res.id)))[0]!;
  expect(row.key).toBe('chore');
  expect((row.config as { color?: string }).color).toBe('#888');
  expect((await testDb.select().from(events).where(eq(events.kind, 'type.created')))).toHaveLength(1);
});

it('updates a type label and archives/unarchives it', async () => {
  const fx = await seedFixture();
  const id = fx.typeIdByKey.get('bug')!;
  await runCommand(testDb, typeUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id, label: 'Defect', archived: true });
  let row = (await testDb.select().from(itemTypes).where(eq(itemTypes.id, id)))[0]!;
  expect(row.label).toBe('Defect');
  expect(row.archivedAt).not.toBeNull();
  await runCommand(testDb, typeUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id, archived: false });
  row = (await testDb.select().from(itemTypes).where(eq(itemTypes.id, id)))[0]!;
  expect(row.archivedAt).toBeNull();
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/api test -- config/type.test`
Expected: FAIL — `./type` does not exist.

- [ ] **Step 3: Implement `type.ts`**

Create `apps/api/src/command/config/type.ts`:

```ts
import * as v from 'valibot';
import { count, eq, sql } from 'drizzle-orm';
import { itemTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { typeCreated, typeUpdated } from './events';

export const typeCreateInput = v.object({
  schemeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const typeCreate = defineCommand({
  kind: 'type.create',
  input: typeCreateInput,
  aggregate: () => ({ type: 'type' }),
  async handler(tx, input, ctx) {
    const position = Number(
      (await tx.select({ n: count() }).from(itemTypes).where(eq(itemTypes.schemeId, input.schemeId)))[0]?.n ?? 0,
    );
    const inserted = await tx
      .insert(itemTypes)
      .values({ schemeId: input.schemeId, key: input.key, label: input.label, position, config: input.config ?? {} })
      .returning();
    const row = inserted[0]!;
    ctx.aggregateId = row.id;
    await ctx.emit(typeCreated, { schemeId: row.schemeId, key: row.key, label: row.label });
    return { id: row.id };
  },
});

export const typeUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.pipe(v.string(), v.minLength(1))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

export const typeUpdate = defineCommand({
  kind: 'type.update',
  input: typeUpdateInput,
  aggregate: (input) => ({ type: 'type', id: input.id }),
  async handler(tx, input, ctx) {
    const existing = (await tx.select().from(itemTypes).where(eq(itemTypes.id, input.id)))[0];
    if (!existing) throw new HttpError(404, 'type not found');
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (input.archived !== undefined) { set.archivedAt = input.archived ? sql`now()` : null; changes.archived = input.archived; }
    if (Object.keys(set).length > 0) await tx.update(itemTypes).set(set).where(eq(itemTypes.id, input.id));
    ctx.aggregateId = input.id;
    await ctx.emit(typeUpdated, { changes });
    return { id: input.id };
  },
});
```

- [ ] **Step 4: Add the routes**

In `apps/api/src/routes/vocabulary.routes.ts`, import `{ typeCreate, typeUpdate } from '../command/config/type'` and register (inside `registerVocabularyRoutes`):

```ts
  app.post('/api/types', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, typeCreate, envelope, request.body);
    reply.status(201).send(result);
  });
  app.patch('/api/types/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, typeUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @tickets/api test -- config/type.test && pnpm --filter @tickets/api typecheck`
Expected: PASS (2/2); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/command/config/type.ts apps/api/src/command/config/type.test.ts apps/api/src/routes/vocabulary.routes.ts
git commit -m "feat(api): type.create + type.update config commands"
```

---

### Task 3: `type.setChildTypes` command

**Files:**
- Modify: `apps/api/src/command/config/type.ts` (add the command)
- Modify: `apps/api/src/command/config/type.test.ts` (add a case)
- Modify: `apps/api/src/routes/vocabulary.routes.ts`

**Interfaces:**
- Consumes: `typeChildTypesSet` (Task 1).
- Produces: `typeSetChildTypes` (`PUT /api/types/:id/child-types`), which REPLACES the `item_type_child_types` rows for a parent type.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/command/config/type.test.ts` (add `itemTypeChildTypes` to the `@tickets/db` import and `typeSetChildTypes` to the `./type` import):

```ts
it('replaces child types (not append/wipe-others) and emits type.child_types_set', async () => {
  const fx = await seedFixture();
  const epic = fx.typeIdByKey.get('epic')!;
  const task = fx.typeIdByKey.get('task')!;
  const bug = fx.typeIdByKey.get('bug')!;
  const spike = fx.typeIdByKey.get('spike')!;
  // epic seeds allow task/bug/spike; replace with just [task]
  await runCommand(testDb, typeSetChildTypes, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { typeId: epic, childTypeIds: [task] });
  const rows = await testDb.select().from(itemTypeChildTypes).where(eq(itemTypeChildTypes.parentTypeId, epic));
  expect(rows.map((r) => r.childTypeId).sort()).toEqual([task]);
  // task's own child rows (subtask) are untouched
  const taskChildren = await testDb.select().from(itemTypeChildTypes).where(eq(itemTypeChildTypes.parentTypeId, task));
  expect(taskChildren.length).toBeGreaterThan(0);
  expect((await testDb.select().from(events).where(eq(events.kind, 'type.child_types_set')))).toHaveLength(1);
  void bug; void spike;
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/api test -- config/type.test`
Expected: FAIL — `typeSetChildTypes` not exported.

- [ ] **Step 3: Implement the command**

Append to `apps/api/src/command/config/type.ts` (add `itemTypeChildTypes` to the `@tickets/db` import, `typeChildTypesSet` to the events import, `and`/`inArray` to drizzle imports):

```ts
export const typeSetChildTypesInput = v.object({
  typeId: v.pipe(v.number(), v.integer()),
  childTypeIds: v.array(v.pipe(v.number(), v.integer())),
});

export const typeSetChildTypes = defineCommand({
  kind: 'type.setChildTypes',
  input: typeSetChildTypesInput,
  aggregate: (input) => ({ type: 'type', id: input.typeId }),
  async handler(tx, input, ctx) {
    const parent = (await tx.select().from(itemTypes).where(eq(itemTypes.id, input.typeId)))[0];
    if (!parent) throw new HttpError(404, 'type not found');
    // replace: delete all child rows for this parent, then insert the new set
    await tx.delete(itemTypeChildTypes).where(eq(itemTypeChildTypes.parentTypeId, input.typeId));
    if (input.childTypeIds.length > 0) {
      await tx.insert(itemTypeChildTypes).values(
        input.childTypeIds.map((childTypeId) => ({ parentTypeId: input.typeId, childTypeId })),
      );
    }
    ctx.aggregateId = input.typeId;
    await ctx.emit(typeChildTypesSet, { childTypeIds: input.childTypeIds });
    return { typeId: input.typeId };
  },
});
```

- [ ] **Step 4: Add the route**

In `vocabulary.routes.ts`, add `typeSetChildTypes` to the `../command/config/type` import and register:

```ts
  app.put('/api/types/:id/child-types', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, typeSetChildTypes, envelope, { ...(request.body as object), typeId: id });
    reply.send(result);
  });
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @tickets/api test -- config/type.test && pnpm --filter @tickets/api typecheck`
Expected: PASS (3/3).

```bash
git add apps/api/src/command/config/type.ts apps/api/src/command/config/type.test.ts apps/api/src/routes/vocabulary.routes.ts
git commit -m "feat(api): type.setChildTypes (replace nesting rules)"
```

---

### Task 4: `field.place` + `field.unplace` commands

**Files:**
- Create: `apps/api/src/command/config/placement.ts`
- Create: `apps/api/src/command/config/placement.test.ts`
- Modify: `apps/api/src/routes/vocabulary.routes.ts`

**Interfaces:**
- Consumes: `fieldPlaced` (existing), `fieldUnplaced` (Task 1).
- Produces: `fieldPlace` (`POST /api/types/:typeId/fields/:fieldId/placement`), `fieldUnplace` (`DELETE …/placement`). (Placing an EXISTING library field on a type; `field.create` still does create-and-place-on-one-type.)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/command/config/placement.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { events, itemTypeFields } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { fieldPlace, fieldUnplace } from './placement';

beforeEach(resetDb);
afterAll(resetDb);

it('places an existing library field on a type and rejects a duplicate', async () => {
  const fx = await seedFixture();
  const bug = fx.typeIdByKey.get('bug')!;
  const estimate = fx.fieldIdByKey.get('estimate')!; // library field not placed on bug in the seed
  await runCommand(testDb, fieldPlace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: bug, fieldId: estimate, required: false });
  const rows = await testDb.select().from(itemTypeFields).where(and(eq(itemTypeFields.itemTypeId, bug), eq(itemTypeFields.fieldId, estimate)));
  expect(rows).toHaveLength(1);
  expect((await testDb.select().from(events).where(eq(events.kind, 'field.placed')))).toHaveLength(1);
  await expect(
    runCommand(testDb, fieldPlace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: bug, fieldId: estimate }),
  ).rejects.toMatchObject({ statusCode: 422 });
});

it('unplaces a field from a type (leaving the library field intact) and emits field.unplaced', async () => {
  const fx = await seedFixture();
  const task = fx.typeIdByKey.get('task')!;
  const estimate = fx.fieldIdByKey.get('estimate')!; // seed places estimate on task
  await runCommand(testDb, fieldUnplace, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { itemTypeId: task, fieldId: estimate });
  const rows = await testDb.select().from(itemTypeFields).where(and(eq(itemTypeFields.itemTypeId, task), eq(itemTypeFields.fieldId, estimate)));
  expect(rows).toHaveLength(0);
  expect((await testDb.select().from(events).where(eq(events.kind, 'field.unplaced')))).toHaveLength(1);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/api test -- config/placement.test`
Expected: FAIL — `./placement` missing.

- [ ] **Step 3: Implement `placement.ts`**

Create `apps/api/src/command/config/placement.ts`:

```ts
import * as v from 'valibot';
import { and, count, eq } from 'drizzle-orm';
import { fields, itemTypeFields, itemTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { fieldPlaced, fieldUnplaced } from './events';

export const fieldPlaceInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  fieldId: v.pipe(v.number(), v.integer()),
  position: v.optional(v.pipe(v.number(), v.integer())),
  required: v.optional(v.boolean()),
  configOverride: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
});

export const fieldPlace = defineCommand({
  kind: 'field.place',
  input: fieldPlaceInput,
  aggregate: (input) => ({ type: 'field', id: input.fieldId }),
  async handler(tx, input, ctx) {
    if (!(await tx.select().from(itemTypes).where(eq(itemTypes.id, input.itemTypeId)))[0]) throw new HttpError(400, 'unknown item type');
    if (!(await tx.select().from(fields).where(eq(fields.id, input.fieldId)))[0]) throw new HttpError(400, 'unknown field');
    const existing = await tx.select().from(itemTypeFields)
      .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId)));
    if (existing[0]) throw new HttpError(422, 'field already placed on this type');
    const position = input.position ?? Number(
      (await tx.select({ n: count() }).from(itemTypeFields).where(eq(itemTypeFields.itemTypeId, input.itemTypeId)))[0]?.n ?? 0,
    );
    await tx.insert(itemTypeFields).values({
      itemTypeId: input.itemTypeId, fieldId: input.fieldId, position,
      required: input.required ?? false, configOverride: input.configOverride ?? null,
    });
    ctx.aggregateId = input.fieldId;
    await ctx.emit(fieldPlaced, { itemTypeId: input.itemTypeId, position, required: input.required ?? false });
    return { itemTypeId: input.itemTypeId, fieldId: input.fieldId };
  },
});

export const fieldUnplaceInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  fieldId: v.pipe(v.number(), v.integer()),
});

export const fieldUnplace = defineCommand({
  kind: 'field.unplace',
  input: fieldUnplaceInput,
  aggregate: (input) => ({ type: 'field', id: input.fieldId }),
  async handler(tx, input, ctx) {
    const deleted = await tx.delete(itemTypeFields)
      .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, 'placement not found');
    ctx.aggregateId = input.fieldId;
    await ctx.emit(fieldUnplaced, { itemTypeId: input.itemTypeId });
    return { itemTypeId: input.itemTypeId, fieldId: input.fieldId };
  },
});
```

- [ ] **Step 4: Add the routes**

In `vocabulary.routes.ts`, import `{ fieldPlace, fieldUnplace } from '../command/config/placement'` and register:

```ts
  app.post('/api/types/:typeId/fields/:fieldId/placement', async (request, reply) => {
    const p = request.params as { typeId: string; fieldId: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldPlace, envelope, { ...(request.body as object), itemTypeId: parseId(p.typeId), fieldId: parseId(p.fieldId) });
    reply.status(201).send(result);
  });
  app.delete('/api/types/:typeId/fields/:fieldId/placement', async (request, reply) => {
    const p = request.params as { typeId: string; fieldId: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldUnplace, envelope, { itemTypeId: parseId(p.typeId), fieldId: parseId(p.fieldId) });
    reply.send(result);
  });
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @tickets/api test -- config/placement.test && pnpm --filter @tickets/api typecheck`
Expected: PASS (2/2).

```bash
git add apps/api/src/command/config/placement.ts apps/api/src/command/config/placement.test.ts apps/api/src/routes/vocabulary.routes.ts
git commit -m "feat(api): field.place + field.unplace (place existing library fields)"
```

---

### Task 5: `placement.update` command

**Files:**
- Modify: `apps/api/src/command/config/placement.ts` (add the command)
- Modify: `apps/api/src/command/config/placement.test.ts` (add a case)
- Modify: `apps/api/src/routes/vocabulary.routes.ts`

**Interfaces:**
- Consumes: `placementUpdated` (Task 1).
- Produces: `placementUpdate` (`PATCH /api/types/:typeId/fields/:fieldId/placement`). Updates `required`/`position` and `configOverride.allowedOptionIds`.

- [ ] **Step 1: Write the failing test**

Append to `placement.test.ts` (import `placementUpdate`):

```ts
it('updates required + the per-type option allowlist', async () => {
  const fx = await seedFixture();
  const task = fx.typeIdByKey.get('task')!;
  const priority = fx.fieldIdByKey.get('priority')!; // placed on task in the seed
  const urgent = fx.optionIdByKey.get('priority:urgent')!;
  const high = fx.optionIdByKey.get('priority:high')!;
  await runCommand(testDb, placementUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: task, fieldId: priority, required: true, allowedOptionIds: [urgent, high],
  });
  const row = (await testDb.select().from(itemTypeFields).where(and(eq(itemTypeFields.itemTypeId, task), eq(itemTypeFields.fieldId, priority))))[0]!;
  expect(row.required).toBe(true);
  expect((row.configOverride as { allowedOptionIds?: number[] }).allowedOptionIds!.sort()).toEqual([urgent, high].sort());
  expect((await testDb.select().from(events).where(eq(events.kind, 'placement.updated')))).toHaveLength(1);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/api test -- config/placement.test`
Expected: FAIL — `placementUpdate` not exported.

- [ ] **Step 3: Implement**

Append to `placement.ts` (add `placementUpdated` to the events import):

```ts
export const placementUpdateInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  fieldId: v.pipe(v.number(), v.integer()),
  required: v.optional(v.boolean()),
  position: v.optional(v.pipe(v.number(), v.integer())),
  allowedOptionIds: v.optional(v.array(v.pipe(v.number(), v.integer()))),
});

export const placementUpdate = defineCommand({
  kind: 'placement.update',
  input: placementUpdateInput,
  aggregate: (input) => ({ type: 'field', id: input.fieldId }),
  async handler(tx, input, ctx) {
    const existing = (await tx.select().from(itemTypeFields)
      .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId))))[0];
    if (!existing) throw new HttpError(404, 'placement not found');
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.required !== undefined) { set.required = input.required; changes.required = input.required; }
    if (input.position !== undefined) { set.position = input.position; changes.position = input.position; }
    if (input.allowedOptionIds !== undefined) {
      const co = { ...((existing.configOverride as Record<string, unknown> | null) ?? {}), allowedOptionIds: input.allowedOptionIds };
      set.configOverride = co; changes.allowedOptionIds = input.allowedOptionIds;
    }
    if (Object.keys(set).length > 0) {
      await tx.update(itemTypeFields).set(set)
        .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId)));
    }
    ctx.aggregateId = input.fieldId;
    await ctx.emit(placementUpdated, { itemTypeId: input.itemTypeId, changes });
    return { itemTypeId: input.itemTypeId, fieldId: input.fieldId };
  },
});
```

- [ ] **Step 4: Add the route**

In `vocabulary.routes.ts`, add `placementUpdate` to the placement import and register:

```ts
  app.patch('/api/types/:typeId/fields/:fieldId/placement', async (request, reply) => {
    const p = request.params as { typeId: string; fieldId: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, placementUpdate, envelope, { ...(request.body as object), itemTypeId: parseId(p.typeId), fieldId: parseId(p.fieldId) });
    reply.send(result);
  });
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @tickets/api test -- config/placement.test && pnpm --filter @tickets/api typecheck`

```bash
git add apps/api/src/command/config/placement.ts apps/api/src/command/config/placement.test.ts apps/api/src/routes/vocabulary.routes.ts
git commit -m "feat(api): placement.update (required/position/option allowlist)"
```

---

### Task 6: `field.create` auto-creates an option set

**Files:**
- Modify: `apps/api/src/command/config/field.ts`
- Modify: `apps/api/src/command/config/field.test.ts` (add a case)

**Interfaces:**
- Produces: `field.create` extended — when `type === 'option'` and no `optionSetId`, create a fresh `option_sets` row (scheme-scoped, key derived from the field key) and use it; the `field.created` event payload gains `optionSetId`. Existing behaviour (given `optionSetId`, or non-option types) unchanged.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/command/config/field.test.ts` (add `fields`, `optionSets` to imports if missing):

```ts
it('auto-creates an option set for a new option field with no optionSetId', async () => {
  const fx = await seedFixture();
  const task = fx.typeIdByKey.get('task')!;
  const res = await runCommand(testDb, fieldCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    itemTypeId: task, key: 'risk', label: 'Risk', type: 'option',
  });
  const field = (await testDb.select().from(fields).where(eq(fields.id, res.id)))[0]!;
  expect(field.optionSetId).not.toBeNull();
  const set = (await testDb.select().from(optionSets).where(eq(optionSets.id, field.optionSetId!)))[0]!;
  expect(set.schemeId).toBe(fx.schemeId);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/api test -- config/field.test`
Expected: FAIL — an option field without `optionSetId` currently throws `an option field needs an optionSetId` (see `field.ts`).

- [ ] **Step 3: Implement**

In `apps/api/src/command/config/field.ts`, add `optionSets` to the `@tickets/db` import. Replace the existing guard:

```ts
    if (input.type === 'option' && input.optionSetId === undefined) {
      throw new HttpError(400, 'an option field needs an optionSetId');
    }
```

with auto-creation, computing a resolved `optionSetId` before the `fields` insert:

```ts
    let optionSetId = input.optionSetId ?? null;
    if (input.type === 'option' && optionSetId === null) {
      // derive a unique key per scheme from the field key
      const created = await tx.insert(optionSets)
        .values({ schemeId: type.schemeId, key: `${input.key}-set`, name: input.label })
        .returning();
      optionSetId = created[0]!.id;
    }
```

Use `optionSetId` in the `fields` insert `.values({ ..., optionSetId })` (replacing `optionSetId: input.optionSetId ?? null`). Add `optionSetId` to the `fieldCreated` emit payload:

```ts
    await ctx.emit(fieldCreated, { schemeId: type.schemeId, key: field.key, label: field.label, type: field.type });
```

Extend the `fieldCreated` event in `events.ts` to include `optionSetId: v.nullable(v.number())` and pass `optionSetId: field.optionSetId` in the emit. (Add the field to the existing `fieldCreated` `v.object({...})`.)

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @tickets/api test -- config/field.test && pnpm --filter @tickets/api typecheck`
Expected: PASS (existing field tests + the new case).

```bash
git add apps/api/src/command/config/field.ts apps/api/src/command/config/field.test.ts apps/api/src/command/config/events.ts
git commit -m "feat(api): field.create auto-creates an option set for new option fields"
```

---

### Task 7: `linkType.update` + `linkType.setTargetTypes`

**Files:**
- Modify: `apps/api/src/command/config/link-type.ts` (add the two commands)
- Create: `apps/api/src/command/config/link-type.test.ts`
- Modify: `apps/api/src/routes/vocabulary.routes.ts`

**Interfaces:**
- Consumes: `linkTypeUpdated`, `linkTypeTargetTypesSet` (Task 1).
- Produces: `linkTypeUpdate` (`PATCH /api/link-types/:id`), `linkTypeSetTargetTypes` (`PUT /api/link-types/:id/target-types`).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/command/config/link-type.test.ts`:

```ts
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, linkTypeTargetTypes, linkTypes } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { runCommand } from '../run-command';
import { linkTypeSetTargetTypes, linkTypeUpdate } from './link-type';

beforeEach(resetDb);
afterAll(resetDb);

it('updates a link type label + archives it', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const blocks = [...vocab.linkTypeByTypeKey.values()].find((lt) => lt.key === 'blocks')!;
  await runCommand(testDb, linkTypeUpdate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { id: blocks.id, label: 'Blocks (hard)', archived: true });
  const row = (await testDb.select().from(linkTypes).where(eq(linkTypes.id, blocks.id)))[0]!;
  expect(row.label).toBe('Blocks (hard)');
  expect(row.archivedAt).not.toBeNull();
  expect((await testDb.select().from(events).where(eq(events.kind, 'link_type.updated')))).toHaveLength(1);
});

it('replaces target types', async () => {
  const fx = await seedFixture();
  const vocab = await loadSchemeVocab(testDb, { key: fx.projectKey });
  const blocks = [...vocab.linkTypeByTypeKey.values()].find((lt) => lt.key === 'blocks')!;
  const task = fx.typeIdByKey.get('task')!;
  await runCommand(testDb, linkTypeSetTargetTypes, { commandId: crypto.randomUUID(), actorId: fx.actorId }, { linkTypeId: blocks.id, targetTypeIds: [task] });
  const rows = await testDb.select().from(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, blocks.id));
  expect(rows.map((r) => r.targetTypeId)).toEqual([task]);
  expect((await testDb.select().from(events).where(eq(events.kind, 'link_type.target_types_set')))).toHaveLength(1);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/api test -- config/link-type.test`
Expected: FAIL — commands not exported.

- [ ] **Step 3: Implement**

Append to `apps/api/src/command/config/link-type.ts` (add `sql` to drizzle imports; add `linkTypeUpdated, linkTypeTargetTypesSet` to the events import):

```ts
export const linkTypeUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.pipe(v.string(), v.minLength(1))),
  inverseLabel: v.optional(v.pipe(v.string(), v.minLength(1))),
  directional: v.optional(v.boolean()),
  archived: v.optional(v.boolean()),
});

export const linkTypeUpdate = defineCommand({
  kind: 'linkType.update',
  input: linkTypeUpdateInput,
  aggregate: (input) => ({ type: 'link_type', id: input.id }),
  async handler(tx, input, ctx) {
    if (!(await tx.select().from(linkTypes).where(eq(linkTypes.id, input.id)))[0]) throw new HttpError(404, 'link type not found');
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.inverseLabel !== undefined) { set.inverseLabel = input.inverseLabel; changes.inverseLabel = input.inverseLabel; }
    if (input.directional !== undefined) { set.directional = input.directional; changes.directional = input.directional; }
    if (input.archived !== undefined) { set.archivedAt = input.archived ? sql`now()` : null; changes.archived = input.archived; }
    if (Object.keys(set).length > 0) await tx.update(linkTypes).set(set).where(eq(linkTypes.id, input.id));
    ctx.aggregateId = input.id;
    await ctx.emit(linkTypeUpdated, { changes });
    return { id: input.id };
  },
});

export const linkTypeSetTargetTypesInput = v.object({
  linkTypeId: v.pipe(v.number(), v.integer()),
  targetTypeIds: v.array(v.pipe(v.number(), v.integer())),
});

export const linkTypeSetTargetTypes = defineCommand({
  kind: 'linkType.setTargetTypes',
  input: linkTypeSetTargetTypesInput,
  aggregate: (input) => ({ type: 'link_type', id: input.linkTypeId }),
  async handler(tx, input, ctx) {
    if (!(await tx.select().from(linkTypes).where(eq(linkTypes.id, input.linkTypeId)))[0]) throw new HttpError(404, 'link type not found');
    await tx.delete(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, input.linkTypeId));
    if (input.targetTypeIds.length > 0) {
      await tx.insert(linkTypeTargetTypes).values(input.targetTypeIds.map((targetTypeId) => ({ linkTypeId: input.linkTypeId, targetTypeId })));
    }
    ctx.aggregateId = input.linkTypeId;
    await ctx.emit(linkTypeTargetTypesSet, { targetTypeIds: input.targetTypeIds });
    return { linkTypeId: input.linkTypeId };
  },
});
```

- [ ] **Step 4: Add the routes**

In `vocabulary.routes.ts`, add `linkTypeUpdate, linkTypeSetTargetTypes` to the `../command/config/link-type` import and register:

```ts
  app.patch('/api/link-types/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, linkTypeUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });
  app.put('/api/link-types/:id/target-types', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, linkTypeSetTargetTypes, envelope, { ...(request.body as object), linkTypeId: id });
    reply.send(result);
  });
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @tickets/api test -- config/link-type.test && pnpm --filter @tickets/api typecheck`

```bash
git add apps/api/src/command/config/link-type.ts apps/api/src/command/config/link-type.test.ts apps/api/src/routes/vocabulary.routes.ts
git commit -m "feat(api): linkType.update + linkType.setTargetTypes"
```

---

### Task 8: Web — client `ItemType.position` + admin command hooks

**Files:**
- Modify: `apps/web/src/api/types.ts` (add `position` to `ItemType`; add admin input/result types)
- Create: `apps/web/src/api/use-admin.ts` (all admin mutation hooks)
- Create: `apps/web/src/api/use-admin.test.ts`

**Interfaces:**
- Consumes: `apiMutate`, `useCurrentUser`.
- Produces the hooks the admin tabs use: `useCreateType`, `useUpdateType`, `useSetChildTypes`, `useCreateField`, `usePlaceField`, `useUnplaceField`, `useUpdatePlacement`, `useCreateOption`, `useUpdateOption`, `useCreateTransition`, `useDeleteTransition`, `useCreateLinkType`, `useUpdateLinkType`, `useSetTargetTypes`, `useForkScheme`. Each takes an input object incl. `actorId` and returns a react-query mutation; each invalidates `['board']` on success.

- [ ] **Step 1: Add `position` to `ItemType`**

In `apps/web/src/api/types.ts`, add `position: number;` to `interface ItemType`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/api/use-admin.test.ts` — mount one representative hook and assert the route + envelope body (destructure the random `commandId`):

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useSetChildTypes } from './use-admin';

afterEach(() => vi.unstubAllGlobals());
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test('useSetChildTypes PUTs the envelope body to /api/types/:id/child-types', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useSetChildTypes(), { wrapper: wrap });
  await result.current.mutateAsync({ typeId: 1, actorId: 7, childTypeIds: [2, 3] });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/child-types');
  expect(init.method).toBe('PUT');
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(body.actorId).toBe(7);
  expect(String(body.commandId)).toMatch(UUID);
  expect(body.childTypeIds).toEqual([2, 3]);
});
```

- [ ] **Step 3: Run to confirm it fails**

Run: `pnpm --filter @tickets/web test -- use-admin.test`
Expected: FAIL — `./use-admin` missing.

- [ ] **Step 4: Implement `use-admin.ts`**

Create `apps/web/src/api/use-admin.ts`. Each hook follows this shape (using `apiMutate` from `./client`); write all listed hooks. Example set (mirror for the rest — the route + method + body per §4.6 of the spec):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';

function useConfigMutation<TInput extends { actorId: number }>(
  fn: (input: TInput) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); } });
}

export function useCreateType() {
  return useConfigMutation((i: { actorId: number; schemeId: number; key: string; label: string; config?: { color?: string } }) => {
    const { actorId, ...body } = i;
    return apiMutate('/api/types', { method: 'POST', actorId, body });
  });
}
export function useUpdateType() {
  return useConfigMutation((i: { actorId: number; id: number; label?: string; config?: Record<string, unknown>; archived?: boolean }) => {
    const { actorId, id, ...body } = i;
    return apiMutate(`/api/types/${id}`, { method: 'PATCH', actorId, body });
  });
}
export function useSetChildTypes() {
  return useConfigMutation((i: { actorId: number; typeId: number; childTypeIds: number[] }) => {
    const { actorId, typeId, ...body } = i;
    return apiMutate(`/api/types/${typeId}/child-types`, { method: 'PUT', actorId, body });
  });
}
export function useCreateField() {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; key: string; label: string; type: string; config?: Record<string, unknown>; optionSetId?: number; required?: boolean }) => {
    const { actorId, itemTypeId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/fields`, { method: 'POST', actorId, body });
  });
}
export function usePlaceField() {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; fieldId: number; required?: boolean; position?: number; configOverride?: Record<string, unknown> | null }) => {
    const { actorId, itemTypeId, fieldId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/fields/${fieldId}/placement`, { method: 'POST', actorId, body });
  });
}
export function useUnplaceField() {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; fieldId: number }) =>
    apiMutate(`/api/types/${i.itemTypeId}/fields/${i.fieldId}/placement`, { method: 'DELETE', actorId: i.actorId }));
}
export function useUpdatePlacement() {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; fieldId: number; required?: boolean; position?: number; allowedOptionIds?: number[] }) => {
    const { actorId, itemTypeId, fieldId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/fields/${fieldId}/placement`, { method: 'PATCH', actorId, body });
  });
}
export function useCreateOption() {
  return useConfigMutation((i: { actorId: number; fieldId: number; value: string; label: string; kind?: string; config?: Record<string, unknown> }) => {
    const { actorId, fieldId, ...body } = i;
    return apiMutate(`/api/fields/${fieldId}/options`, { method: 'POST', actorId, body });
  });
}
export function useUpdateOption() {
  return useConfigMutation((i: { actorId: number; id: number; label?: string; config?: Record<string, unknown>; archived?: boolean }) => {
    const { actorId, id, ...body } = i;
    return apiMutate(`/api/options/${id}`, { method: 'PATCH', actorId, body });
  });
}
export function useCreateTransition() {
  return useConfigMutation((i: { actorId: number; fieldId: number; fromOptionId?: number | null; toOptionId: number; itemTypeId?: number | null; config?: Record<string, unknown> }) => {
    const { actorId, fieldId, ...body } = i;
    return apiMutate(`/api/fields/${fieldId}/transitions`, { method: 'POST', actorId, body });
  });
}
export function useDeleteTransition() {
  return useConfigMutation((i: { actorId: number; id: number }) =>
    apiMutate(`/api/transitions/${i.id}`, { method: 'DELETE', actorId: i.actorId }));
}
export function useCreateLinkType() {
  return useConfigMutation((i: { actorId: number; itemTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; targetTypeIds?: number[] }) => {
    const { actorId, itemTypeId, ...body } = i;
    return apiMutate(`/api/types/${itemTypeId}/link-types`, { method: 'POST', actorId, body });
  });
}
export function useUpdateLinkType() {
  return useConfigMutation((i: { actorId: number; id: number; label?: string; inverseLabel?: string; directional?: boolean; archived?: boolean }) => {
    const { actorId, id, ...body } = i;
    return apiMutate(`/api/link-types/${id}`, { method: 'PATCH', actorId, body });
  });
}
export function useSetTargetTypes() {
  return useConfigMutation((i: { actorId: number; linkTypeId: number; targetTypeIds: number[] }) => {
    const { actorId, linkTypeId, ...body } = i;
    return apiMutate(`/api/link-types/${linkTypeId}/target-types`, { method: 'PUT', actorId, body });
  });
}
export function useForkScheme() {
  return useConfigMutation((i: { actorId: number; sourceSchemeId: number; key: string; name: string }) => {
    const { actorId, sourceSchemeId, ...body } = i;
    return apiMutate(`/api/schemes/${sourceSchemeId}/fork`, { method: 'POST', actorId, body });
  });
}
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @tickets/web test -- use-admin.test && pnpm --filter @tickets/web typecheck`
Expected: PASS.

```bash
git add apps/web/src/api/types.ts apps/web/src/api/use-admin.ts apps/web/src/api/use-admin.test.ts
git commit -m "feat(web): admin command hooks + ItemType.position"
```

---

### Task 9: Web — restore `/settings` route + tabbed shell

**Files:**
- Create: `apps/web/src/routes/settings-route.tsx`
- Create: `apps/web/src/components/settings/settings-screen.tsx`
- Modify: `apps/web/src/router.ts` (register the route)
- Modify: `apps/web/src/components/shell/app-shell.tsx` (re-add the settings nav gear)
- Test: `apps/web/src/components/settings/settings-screen.test.tsx`

**Interfaces:**
- Consumes: `useBoard`, `indexBoard`.
- Produces: `SettingsScreen` — a tabbed shell (Types · Fields · Workflow · Links) + the shared-scheme banner. Tabs are rendered by later tasks; this task ships the shell with a tab switcher and the four (initially placeholder) panels wired to the board data.

- [ ] **Step 1: Write the failing test**

Create `settings-screen.test.tsx` asserting the four tab buttons render and the scheme banner shows the scheme name. Use a minimal new-shape board factory (reuse the one from `new-item-dialog.test.tsx`). Assert `getByRole('tab', { name: /Types/ })` etc. (Read the git-preserved old `settings-screen.tsx` at `dab1e97` for the tab-shell layout to reuse — but wire it to the new board shape.)

- [ ] **Step 2–4: Build the shell**

Recover the old settings-screen layout for reference: `git show dab1e97:apps/web/src/components/settings/settings-screen.tsx`. Rebuild `SettingsScreen({ projectKey })`: fetch `useBoard(projectKey)`, `indexBoard`, render the scheme banner ("Editing the shared *<scheme name>* — affects all projects" + a "Fork for this project" button that is wired in Task 14) and a tab switcher with four panels. Each panel renders its tab component (`TypesTab`, `FieldsTab`, `WorkflowTab`, `LinksTab`) — create thin placeholder components now (each rendering its heading), filled in by Tasks 10–13. Register the route in `router.ts` (path `/projects/$projectKey/settings` or the app's settings path — match the old route's path from `git show dab1e97:apps/web/src/routes/settings-route.tsx`), and re-add the gear `Link` to `app-shell.tsx` (recover from `git show dab1e97:apps/web/src/components/shell/app-shell.tsx`).

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @tickets/web test -- settings-screen && pnpm --filter @tickets/web typecheck`

```bash
git add apps/web/src/routes/settings-route.tsx apps/web/src/components/settings/ apps/web/src/router.ts apps/web/src/components/shell/app-shell.tsx
git commit -m "feat(web): restore /settings route + tabbed admin shell"
```

---

### Task 10: Web — Types tab

**Files:**
- Create/replace: `apps/web/src/components/settings/types-tab.tsx`
- Test: `apps/web/src/components/settings/types-tab.test.tsx`

**Interfaces:**
- Consumes: board `types` + `useProjectVocab`-style indexes, `useCreateType`, `useUpdateType`, `useSetChildTypes`, `useCurrentUser`.
- Produces: `TypesTab({ board, indexes, projectKey })`.

- [ ] Build the Types tab per the prototype: a list of types (colour dot, label, key) with create (name/colour → `useCreateType({ schemeId: board.project.schemeId, ... })`), edit label/colour + archive (`useUpdateType`), and an allowed-child-types chip editor (`useSetChildTypes`). Archived types show muted with an "unarchive" action. **Test:** creating a type fires `useCreateType` with the envelope (mock fetch, assert `POST /api/types`, uuid commandId); toggling a child-type chip fires `useSetChildTypes` with the updated `childTypeIds`. Reference: `git show dab1e97:apps/web/src/components/settings/types-settings.tsx`. Gate: `pnpm --filter @tickets/web test -- types-tab`. Commit `feat(web): schema admin — Types tab`.

---

### Task 11: Web — Fields tab (placement editor)

**Files:**
- Create/replace: `apps/web/src/components/settings/fields-tab.tsx`
- Test: `apps/web/src/components/settings/fields-tab.test.tsx`

**Interfaces:**
- Consumes: board `fields`/`placements`/`options`, `useCreateField`, `usePlaceField`, `useUnplaceField`, `useUpdatePlacement`, `useUpdateField` (existing `field.update` via a hook — add a `useUpdateField` to `use-admin.ts` if missing: `PATCH /api/fields/:id`).
- Produces: `FieldsTab({ board, indexes, projectKey })`.

- [ ] Build the per-type placement editor per the prototype: pick a type → table of its placements (field name, type, required toggle, option allowlist, reorder), with **place an existing library field** (`usePlaceField`), **unplace** (`useUnplaceField`), **create a new field** (`useCreateField` — option fields auto-create their set), and per-placement **required** + **allowlist** edits (`useUpdatePlacement`). Archived library fields excluded from the "place" picker. **Test:** placing a field fires `usePlaceField` (`POST …/placement`, envelope); toggling required fires `useUpdatePlacement`; setting an allowlist fires `useUpdatePlacement` with `allowedOptionIds`. Reference: `git show dab1e97:apps/web/src/components/settings/fields-settings.tsx`. Gate: `pnpm --filter @tickets/web test -- fields-tab`. Commit `feat(web): schema admin — Fields/placements tab`.

---

### Task 12: Web — Workflow tab (options + transitions)

**Files:**
- Create/replace: `apps/web/src/components/settings/workflow-tab.tsx`
- Test: `apps/web/src/components/settings/workflow-tab.test.tsx`

**Interfaces:**
- Consumes: board `options`/`transitions`, `indexes.workflowField`, `useCreateOption`, `useUpdateOption`, `useCreateTransition`, `useDeleteTransition`.
- Produces: `WorkflowTab({ board, indexes, projectKey })`.

- [ ] Build per the prototype: pick a type → the workflow field's options (list with kind badge + colour; add via `useCreateOption` with a `kind` picker; edit label/kind/colour + archive via `useUpdateOption`) and the transition graph (list of from→to edges with delete via `useDeleteTransition`; add edge via `useCreateTransition` with from/to option pickers + optional guard). Kind values: `todo|active|blocked|done|dropped`. **Test:** adding an option fires `useCreateOption` (envelope); adding an edge fires `useCreateTransition` with `{fieldId, fromOptionId, toOptionId, itemTypeId}`; deleting fires `useDeleteTransition`. Reference: `git show dab1e97:apps/web/src/components/settings/workflow-settings.tsx`. Gate: `pnpm --filter @tickets/web test -- workflow-tab`. Commit `feat(web): schema admin — Workflow tab`.

---

### Task 13: Web — Links tab

**Files:**
- Create/replace: `apps/web/src/components/settings/links-tab.tsx`
- Test: `apps/web/src/components/settings/links-tab.test.tsx`

**Interfaces:**
- Consumes: board `linkTypes` + `types`, `useCreateLinkType`, `useUpdateLinkType`, `useSetTargetTypes`.
- Produces: `LinksTab({ board, indexes, projectKey })`.

- [ ] Build per the prototype: list link types (label, inverse label, directional/symmetric, target-type chips), create (`useCreateLinkType`), edit label/inverse/directional + archive (`useUpdateLinkType`), and a target-type chip editor (`useSetTargetTypes`). **Test:** creating a link type fires `useCreateLinkType` (envelope); toggling a target chip fires `useSetTargetTypes` with the updated `targetTypeIds`. Reference: `git show dab1e97:apps/web/src/components/settings/link-types-settings.tsx`. Gate: `pnpm --filter @tickets/web test -- links-tab`. Commit `feat(web): schema admin — Links tab`.

---

### Task 14: Web — scheme-fork banner action

**Files:**
- Modify: `apps/web/src/components/settings/settings-screen.tsx`
- Modify: `apps/api/src/command/config/scheme.ts` + a new `project.update` command (to repoint the project's `schemeId` after fork) + route, OR confirm `scheme.fork` already repoints the project.

**Interfaces:**
- Consumes: `useForkScheme`, `useCurrentUser`.

- [ ] **Step 1:** Read `git show HEAD:apps/api/src/command/config/scheme.ts` to determine whether `scheme.fork` already reassigns the invoking project to the new scheme. If it does NOT, add a minimal `project.update` command `{ id, schemeId }` (PATCH `/api/projects/:id`) emitting a `project.updated` event, and have the banner call fork then repoint. If `scheme.fork` DOES repoint, wire the banner button directly to `useForkScheme({ sourceSchemeId: board.project.schemeId, key, name })`.
- [ ] **Step 2:** Wire the "Fork for this project" button in the banner: on click, confirm, call the hook(s), and on success invalidate `['board']` so the admin now edits the forked scheme. **Test:** clicking Fork fires `useForkScheme` (envelope, `POST /api/schemes/:id/fork`). Gate: `pnpm --filter @tickets/web test -- settings-screen && pnpm --filter @tickets/api test -- config` (if the api command was added). Commit `feat(web): fork-scheme-for-project action`.

---

### Task 15: Full gate + docs

**Files:**
- Modify: `docs/database.md` or a config-admin note (optional) documenting the new commands.

- [ ] **Step 1:** `pnpm --filter @tickets/api typecheck && pnpm --filter @tickets/api test` → all green (new config command suites + existing 94→N).
- [ ] **Step 2:** `pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/web build` → all green.
- [ ] **Step 3:** `pnpm typecheck` (root) → 5/5.
- [ ] **Step 4:** Commit any doc note: `docs(api): note the SP4a-P2 schema-admin config commands`.

---

## Self-Review

**1. Spec coverage.** §4.1 types → Tasks 2–3. §4.2 placements → Tasks 4–5. §4.3 option-set auto-create → Task 6. §4.4 link types → Task 7. §5 admin UI: hooks → Task 8; shell → Task 9; tabs → Tasks 10–13; fork banner → Task 14. §6 additive gate → each task's per-package run + Task 15. §7 testing → each API task's `tickets_test` round-trip + corruption probes (setChildTypes/setTargetTypes replace-not-append tests; archive-preserves-values implicit); web component tests per tab. Events (§Task 1) precede all command tasks.

**2. Placeholder scan.** API tasks (1–7) carry complete code. Web hook task (8) carries complete code. Web UI tasks (9–14) are component builds specified by: the approved prototype, the exact hooks + routes they call, the git-preserved old screen to reference (`git show dab1e97:…`), and concrete test assertions (which hook fires, which route/envelope). This is a deliberate build-spec, not a vague placeholder — each names its files, its hooks, its test. The one genuinely open item (Task 14: does `scheme.fork` repoint the project?) is written as a read-then-branch step with both branches specified.

**3. Type consistency.** Event names (Task 1) are consumed verbatim in Tasks 2–7. Command names (`typeCreate`/`typeUpdate`/`typeSetChildTypes`/`fieldPlace`/`fieldUnplace`/`placementUpdate`/`linkTypeUpdate`/`linkTypeSetTargetTypes`) are defined in their tasks and referenced by the route registrations and the web hooks (Task 8) via their HTTP routes. Web hook names (Task 8) are consumed by Tasks 10–14. `ItemType.position` (Task 8) is additive.

**Cross-task note for the executor:** run in order — Task 1 (events) unblocks 2–7; Task 8 (hooks) unblocks 10–14; Task 9 (shell) unblocks 10–13. The package stays GREEN every task (additive) — a red typecheck is a real failure here, unlike Phase 1.
