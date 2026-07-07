# Type-owned Fields & Links — Plan B: Read/Write Path + API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewire the API write path, the board/views read path, the per-type field/link CRUD routes with link guardrails, and the minimal web board code — so that with type-owned fields/links (Plan A) everything resolves by field **key** per ticket type and boards keep rendering.

**Architecture:** Values are written by resolving `(ticketType, fieldKey) → field id`. The board endpoint returns tickets whose `values` are already key-shaped (unchanged) plus a **deduped logical `fields` list** (one per key, options unioned across types) so the web's key-addressed columns and option lookups work with one arbitrary-collision hazard removed. View configs address columns/sort/filters by `fieldKey`. Link creation is guarded: the link type must be owned by the source ticket's type and the target's type must be allowed.

**Tech Stack:** Fastify + valibot API; React 19 + TanStack Query web; vitest ^4.1.10 (+ Fastify `app.inject()` probes).

## Global Constraints

- **Plan A must be merged first.** `loadProjectVocab` now exposes `fieldByTypeKey`, `fieldsByType`, `fieldKeys`, `linkTypesByType`, `linkTypeTargets`, and **no longer** exposes `fieldByKey`/`linkTypeByKey`/`typeFields`. This plan fixes every consumer of the removed maps.
- **Entry red list** (compile errors after Plan A, to be cleared here): `apps/api/src/tickets/build-value-rows.ts`, `apps/api/src/tickets/assemble-tickets.ts` (uses `fieldById` — still fine), `apps/api/src/views/validate-view-config.ts`, `apps/api/src/routes/vocabulary.routes.ts`, `apps/api/src/routes/links.routes.ts`, the board route.
- **Preflight is OFF in web.** Don't rely on Tailwind resets; touch only logic, not styling, in the web tasks.
- **Dev loop:** docker api must be up (`docker compose up -d`); run the dev web with `WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev`. Verify on **4620** (live source), not 4610.
- Checks per task: `pnpm typecheck` · `pnpm --filter @tickets/api test` · `pnpm --filter @tickets/web test`.
- Conventional commits scoped `feat(api): …` / `feat(web): …`; **one commit per task**.

## File Structure

- `apps/api/src/tickets/build-value-rows.ts` — resolve field by `(typeId, key)`; make `typeId` required.
- `apps/api/src/routes/tickets.routes.ts` — pass the ticket's `typeId` to `buildValueRows` on create & update (already done for status; confirm for all fields).
- `apps/api/src/views/validate-view-config.ts` — validate by `fieldKey` against `vocab.fieldKeys`.
- `apps/api/src/routes/views.routes.ts` — unchanged call, new validator semantics.
- `apps/api/src/boards/logical-fields.ts` — **new** helper: dedupe per-type fields by key + union options for the board payload.
- board route (find via `git grep -n "'/board'" apps/api/src`) — return `fields: buildLogicalFields(vocab)`.
- `apps/api/src/routes/vocabulary.routes.ts` — `POST /api/types/:typeId/fields` (per-type), `POST /api/types/:typeId/link-types` (per-type + targets); drop scheme-scoped `attach[]`.
- `apps/api/src/routes/links.routes.ts` — resolve link type by `(source.typeId, key)`; enforce owner + allowed target.
- Web: `apps/web/src/utils/view-config.ts`, `apps/web/src/utils/index-board.ts`, `apps/web/src/components/board/table-view.tsx`, `board-header.tsx`, `filter-chips.tsx`, `apps/web/src/utils/compare-tickets.ts`, `apps/web/src/utils/evaluate-filters.ts`.

---

### Task 1: Write path resolves fields per type

**Files:**
- Modify: `apps/api/src/tickets/build-value-rows.ts`, `apps/api/src/routes/tickets.routes.ts`
- Test: co-located test for `build-value-rows` (create if none).

**Interfaces:**
- Consumes: `vocab.fieldByTypeKey`. Produces: `buildValueRows(vocab, fieldKey, value, typeId)` with `typeId` **required** (throws 400 if the type has no such field).

- [ ] **Step 1: Write a failing test** — a Task-typed write to `priority` lands on Task's priority field id, not another type's:
```ts
test('resolves the field for the ticket type', () => {
  const rows = buildValueRows(vocab, 'priority', 'high', taskTypeId);
  expect(rows[0].fieldId).toBe(vocab.fieldByTypeKey.get(`${taskTypeId}:priority`)!.id);
});
test('rejects a field the type does not own', () => {
  expect(() => buildValueRows(vocab, 'severity', 'high', taskTypeId)).toThrow(/unknown field/);
});
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Change the resolver** at the top of `buildValueRows`:
```ts
export function buildValueRows(
  vocab: ProjectVocab,
  fieldKey: string,
  value: unknown,
  typeId: number,          // now required
): ValueRow[] {
  const field = vocab.fieldByTypeKey.get(`${typeId}:${fieldKey}`);
  if (!field || field.archivedAt) {
    throw new HttpError(400, `unknown field "${fieldKey}" for this ticket type`);
  }
  // …unchanged body; the `status` branch already has typeId in scope…
```
Remove the now-redundant `typeId === undefined` guard in the `status` branch.

- [ ] **Step 4: Update `tickets.routes.ts`** — ensure both create and update pass the ticket's `typeId` to every `buildValueRows` call. On create it's the new ticket's `type.id`; on update, load the ticket row first and pass `ticket.typeId`. Grep: `git grep -n buildValueRows apps/api/src`.

- [ ] **Step 5: Run api tests — pass.** `pnpm --filter @tickets/api test build-value-rows tickets`

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/tickets/build-value-rows.ts apps/api/src/tickets/build-value-rows.test.ts apps/api/src/routes/tickets.routes.ts
git commit -m "feat(api): resolve written field values per ticket type"
```

---

### Task 2: Views validate by field key

**Files:**
- Modify: `apps/api/src/views/validate-view-config.ts`

**Interfaces:**
- Consumes `vocab.fieldKeys` (logical keys). A `{source:'field', fieldKey}` column/sort and any `fieldKey` under filters must resolve to a known key.

- [ ] **Step 1: Write a failing test** — a config referencing an unknown `fieldKey` throws; a known one passes:
```ts
test('accepts known field keys and rejects unknown', () => {
  const vocab = fakeVocab({ fieldKeys: ['priority', 'status'] });
  expect(() => validateViewConfig(vocab, { columns: [{ source:'field', fieldKey:'priority' }] })).not.toThrow();
  expect(() => validateViewConfig(vocab, { columns: [{ source:'field', fieldKey:'nope' }] })).toThrow(/unknown/);
});
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Rewrite the validator** — switch the valibot field schema from `fieldId: number` to `fieldKey: string`, and the walk from `key === 'fieldId'` to `key === 'fieldKey'` checking membership in a `Set(vocab.fieldKeys.map(f => f.key))`:
```ts
const fieldColumnSchema = v.looseObject({ source: v.literal('field'), fieldKey: v.pipe(v.string(), v.minLength(1)), width: v.optional(v.number()), hidden: v.optional(v.boolean()) });
const fieldSortSchema   = v.looseObject({ source: v.literal('field'), fieldKey: v.pipe(v.string(), v.minLength(1)), dir: v.picklist(['asc','desc']) });
// …
export function validateViewConfig(vocab: ProjectVocab, config: Record<string, unknown>): void {
  parseBody(viewConfigSchema, config);
  const known = new Set(vocab.fieldKeys.map((f) => f.key));
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'fieldKey' && typeof value === 'string') {
        if (!known.has(value)) throw new HttpError(400, `unknown field key "${value}"`);
      } else walk(value);
    }
  };
  walk(config);
}
```

- [ ] **Step 4: Run — passes.** `pnpm --filter @tickets/api test validate-view-config`

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/views/validate-view-config.ts apps/api/src/views/validate-view-config.test.ts
git commit -m "feat(api): validate view configs by field key"
```

---

### Task 3: Board returns a logical field list

**Files:**
- Create: `apps/api/src/boards/logical-fields.ts`, `logical-fields.test.ts`
- Modify: the board route.

**Interfaces:**
- Produces `buildLogicalFields(vocab) → Field[]` — one entry per distinct field key, `id` = the smallest per-type field id for that key (stable), `options` = union of options across all types owning that key (dedupe by `value`, first wins, keep order). Shape matches the web's `Field` type (`apps/web/src/api/types.ts`).

- [ ] **Step 1: Write a failing test** — two types own `priority` with overlapping options → one logical field, unioned options:
```ts
test('unions options across types for a shared key', () => {
  const out = buildLogicalFields(vocab);
  const prio = out.filter((f) => f.key === 'priority');
  expect(prio.length).toBe(1);
  expect(prio[0].options.map((o) => o.value)).toEqual(['urgent','high','medium','low','trivial']);
});
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Implement `buildLogicalFields`** — iterate `vocab.fields` grouped by key; for each key pick the min-id row as the representative (carry `key,label,type,system`), and union `vocab.optionsByFieldId` across every field row with that key, deduping by `value`. Return sorted by the representative id. (Mirror `apps/web/src/components/all-tickets/shared-fields.ts` union logic.)

- [ ] **Step 4: Wire into the board route.** Find it: `git grep -n "board" apps/api/src/routes`. Replace the `fields:` payload it currently builds from scheme fields with `buildLogicalFields(vocab)`. Leave `assembleTickets` untouched (its `values` are already key-shaped).

- [ ] **Step 5: Run — passes**, plus an `inject` probe of `GET /api/projects/:key/board` asserting `fields` has one `priority` entry with unioned options.

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/boards apps/api/src/routes
git commit -m "feat(api): board returns a deduped logical field list"
```

---

### Task 4: Per-type field & link CRUD routes

**Files:**
- Modify: `apps/api/src/routes/vocabulary.routes.ts`

**Interfaces:**
- `POST /api/types/:typeId/fields` `{ key, label, type, required?, config? }` → creates a field owned by the type at the next position. `POST /api/types/:typeId/link-types` `{ key, label, inverseLabel, directional, targetTypeKeys[] }` → creates a link type owned by the type + `link_type_target_types` rows. `createStatus` is already per-type. `attach[]` is removed from field creation.

- [ ] **Step 1: Write `inject` tests** — create a field on the Task type; assert it is owned by that type and appears in `fieldsByType`. Create a link type with targets; assert `link_type_target_types` rows exist.

- [ ] **Step 2: Run — fails** (route missing / old scheme-scoped shape).

- [ ] **Step 3: Replace `createField`** with a per-type handler keyed on `:typeId`:
```ts
const createFieldSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  type: v.picklist(['text','number','date','boolean','json','select','multi_select','status']),
  required: v.optional(v.boolean()),
  config: v.optional(v.record(v.string(), v.unknown())),
});
const createField = async (request, reply) => {
  const typeId = parseId((request.params as { typeId: string }).typeId);
  const body = parseBody(createFieldSchema, request.body);
  const position = (await db.select({ v: count() }).from(fields).where(eq(fields.ticketTypeId, typeId)))[0]?.v ?? 0;
  const [row] = await db.insert(fields).values({
    ticketTypeId: typeId, key: body.key, label: body.label, type: body.type,
    required: body.required ?? false, position, config: body.config ?? {},
  }).returning();
  reply.status(201).send(row);
};
```

- [ ] **Step 4: Replace `createLinkType`** with a per-type handler that also writes targets:
```ts
const createLinkTypeSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)), label: v.pipe(v.string(), v.minLength(1)),
  inverseLabel: v.pipe(v.string(), v.minLength(1)), directional: v.boolean(),
  targetTypeKeys: v.array(v.pipe(v.string(), v.minLength(1))),
});
const createLinkType = async (request, reply) => {
  const typeId = parseId((request.params as { typeId: string }).typeId);
  const body = parseBody(createLinkTypeSchema, request.body);
  // resolve target type ids within the same scheme via a vocab load on the owning type's project… or by scheme
  const created = await db.transaction(async (tx) => {
    const position = (await tx.select({ v: count() }).from(linkTypes).where(eq(linkTypes.ticketTypeId, typeId)))[0]?.v ?? 0;
    const [lt] = await tx.insert(linkTypes).values({
      ticketTypeId: typeId, key: body.key, label: body.label,
      inverseLabel: body.inverseLabel, directional: body.directional, position,
    }).returning();
    const targetIds = await resolveTargetTypeIds(tx, typeId, body.targetTypeKeys); // same scheme
    if (targetIds.length) await tx.insert(linkTypeTargetTypes).values(targetIds.map((t) => ({ linkTypeId: lt!.id, targetTypeId: t })));
    return lt;
  });
  reply.status(201).send(created);
};
```
Add a small `resolveTargetTypeIds` that loads the owning type's scheme types and maps keys→ids (reject unknown). Update route registration: `app.post('/api/types/:typeId/fields', createField)`, `app.post('/api/types/:typeId/link-types', createLinkType)`. Drop `POST /api/projects/:key/fields` and the old `POST /api/projects/:key/link-types`. Keep status/option/patch routes.

- [ ] **Step 5: Run — passes.** `pnpm --filter @tickets/api test vocabulary`

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/routes/vocabulary.routes.ts
git commit -m "feat(api): per-type field & link-type creation with targets"
```

---

### Task 5: Guarded link creation

**Files:**
- Modify: `apps/api/src/routes/links.routes.ts`

**Interfaces:**
- Consumes `vocab.linkTypesByType`, `vocab.linkTypeTargets`, and the source/target tickets' `typeId`. Rejects when the chosen link key is not owned by the source type or the target type is not allowed.

- [ ] **Step 1: Write `inject` tests** — a Task→Bug `blocks` link when Bug is an allowed target succeeds; the same when Bug is not allowed → 422; a link key the source type doesn't own → 400.

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Rewrite the resolution block** in `createLink` (source/target ticket rows must now also select `typeId`):
```ts
const endpoints = await db.select({ id: tickets.id, projectId: tickets.projectId, typeId: tickets.typeId })
  .from(tickets).where(eq(tickets.id, body.sourceTicketId));
// …same for target…
const vocab = await loadProjectVocab(db, { id: source.projectId });
const owned = vocab.linkTypesByType.get(source.typeId) ?? [];
const linkType = owned.find((l) => l.key === body.linkTypeKey && !l.archivedAt);
if (!linkType) throw new HttpError(400, `type does not own link "${body.linkTypeKey}"`);
const allowed = vocab.linkTypeTargets.get(linkType.id) ?? new Set<number>();
if (!allowed.has(target.typeId)) throw new HttpError(422, `"${body.linkTypeKey}" cannot target this ticket type`);
// …duplicate check, cycle check, insert unchanged (linkType.id)…
```

- [ ] **Step 4: Run — passes.** `pnpm --filter @tickets/api test links`

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/routes/links.routes.ts
git commit -m "feat(api): guard link creation by owner type + allowed targets"
```

---

### Task 6: Web board addresses columns/sort/filters by key

**Files:**
- Modify: `apps/web/src/utils/view-config.ts`, `apps/web/src/utils/index-board.ts`, `apps/web/src/components/board/table-view.tsx`, `apps/web/src/components/board/board-header.tsx`, `apps/web/src/components/board/filter-chips.tsx`, `apps/web/src/utils/compare-tickets.ts`, `apps/web/src/utils/evaluate-filters.ts`

**Interfaces:**
- View config field variant becomes `{ source:'field', fieldKey: string, width?, hidden? }`; `ViewSort.fieldKey`; `FilterRule.fieldKey`. Cells/sort/filters resolve via `indexes.fieldByKey.get(key)`. `normalizeViewConfig` gains a **back-compat** path: a legacy `fieldId` is translated to `fieldKey` using `board.fields` (so pre-migration dev configs still load).

- [ ] **Step 1: Write failing web tests** — `normalizeViewConfig` maps a legacy `{source:'field', fieldId:35}` to `{source:'field', fieldKey:'priority'}` given a board; a config already using `fieldKey` round-trips unchanged. (vitest under `apps/web/src/utils`.)

- [ ] **Step 2: Run — fails.** `pnpm --filter @tickets/web test view-config`

- [ ] **Step 3: Change the types + normalization** in `view-config.ts`:
  - `ViewColumn` field variant: `{ source:'field'; fieldKey: string; width?: number; hidden?: boolean }`.
  - `ViewSort`: `fieldKey?: string`.
  - `FilterRule`: `fieldKey: string`.
  - `normalizeViewConfig(raw, board)` now takes the board (or an id→key map). For any column/sort/rule carrying a numeric `fieldId`, resolve `board.fields.find(f => f.id === fieldId)?.key` → `fieldKey` and drop `fieldId`. Default column set writes `{ source:'field', fieldKey: field.key }`.

- [ ] **Step 4: Update `index-board.ts`** — `fieldByKey` is the primary index now. Since `board.fields` is the **logical** list (one per key, from Task 3), `fieldByKey` no longer collides. Keep `fieldById` for the legacy-normalize path only. `optionsByFieldId` stays keyed by the logical field id.

- [ ] **Step 5: Update the consumers** to resolve by key:
  - `table-view.tsx`: `:34`, `:301` → `indexes.fieldByKey.get(column.fieldKey)`; `:256`/`:272` sort compares/writes `fieldKey`.
  - `board-header.tsx:22` → `indexes.fieldByKey.get(column.fieldKey)?.label ?? column.fieldKey`.
  - `compare-tickets.ts:24` → `indexes.fieldByKey.get(sort.fieldKey)`.
  - `filter-chips.tsx`: field dropdown value becomes `field.key`; `onAdd` writes `{ fieldKey: selectedField.key, … }`; chip/label lookups via `fieldByKey`.
  - `evaluate-filters.ts:43` → `indexes.fieldByKey.get(rule.fieldKey)`.
  - (No change to `kanban-view.tsx`, `kpi-strip.tsx`, or `all-tickets/*` — already key-based.)

- [ ] **Step 6: Run web tests + typecheck.** `pnpm --filter @tickets/web test && pnpm --filter @tickets/web exec tsc --noEmit`
Expected: green.

- [ ] **Step 7: Commit**
```bash
git add apps/web/src
git commit -m "feat(web): address board columns/sort/filters by field key"
```

---

### Task 7: Integration verify on the dev stack

**Files:** none (verification only).

- [ ] **Step 1: Fresh dev DB end-to-end** — seed a scheme + project (Plan A path), create one ticket per type via the API (`inject` or curl), set `priority`/`assignee`, and add a guarded link. Confirm 201s and correct rejections (disallowed target → 422).

- [ ] **Step 2: Run the dev web** — `docker compose up -d` then `WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev`; open http://localhost:4620, pick a project board, confirm columns render (Title/Priority/Assignee/Status), sorting by Priority works, and adding a filter on a field works.

- [ ] **Step 3: Full checks** — `pnpm typecheck && pnpm --filter @tickets/api test && pnpm --filter @tickets/web test && pnpm build`. Expected: green.

- [ ] **Step 4: Commit** any test-only additions, then hand off to **Plan C** for the live-data migration + promotion.
```bash
git commit -am "test: type-owned read/write integration coverage" || true
```

## Self-Review (author checklist)

- Spec coverage: write path (§3) → Task 1; view validation (§2) → Task 2; board resolution (§2) → Tasks 3+6; per-type CRUD (§3) → Task 4; link guardrails (§3) → Task 5; web board-read (scope decision) → Task 6.
- Type consistency: `fieldByTypeKey`/`fieldsByType`/`fieldKeys`/`linkTypesByType`/`linkTypeTargets` (Plan A) consumed with the same names; web `fieldKey` shape matches API `buildLogicalFields`.
- Deferred (not in this plan): settings/schema-management UI (`types-settings`, `fields-settings`, `use-vocab-fields`, `detail-fields`, `new-ticket-dialog`, `ticket-detail`, `api/types.ts TypeField`). Boards render without them.
- Ordering: web (Task 6) depends on the logical board payload (Task 3) and legacy-config back-compat so it works both before and after Plan C's data migration.
