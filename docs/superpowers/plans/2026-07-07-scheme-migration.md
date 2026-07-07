# Scheme Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the four existing projects (TASK/APP/GW/TIX) off their per-project inline config and onto one shared **Software** scheme — remapping every ticket's type/status/field/option ids — then drop the now-unused `project_id` config columns and tighten the new columns to `NOT NULL`.

**Architecture:** A single idempotent, transactional migration script builds (or finds) the Software scheme, binds each project, then rewrites `tickets.type_id` and `ticket_values` (`status_id`, `field_id`, `option_id`) via key-based maps. The `epic` field becomes hierarchy (Epic tickets + re-parenting); `area` becomes the `component` select. Only after data is remapped and verified do we delete old config rows and run the tightening DDL migration.

**Tech Stack:** Drizzle ORM, tsx, vitest (pure mapping only), pnpm.

## Global Constraints

- **Depends on Plans 1 & 2** (schemes table, type-owned statuses, transitions, scheme-scoped vocab).
- **Back up first:** `pg_dump` the DB (or snapshot the docker volume) before Task 5's destructive steps.
- **Postgres running:** `docker compose up -d`.
- **Idempotent + transactional:** the script skips a project already bound (`projects.scheme_id` set) and runs each project in its own transaction.
- **No ticket is ever deleted or renumbered.** Old ticket ids/numbers/descriptions are preserved (migrated tickets keep old IDs in description headings).
- **Verify by measurement:** row counts and orphan checks before/after; one pure mapping function is unit-tested. Commit after each task.
- **Conventional commits:** `feat(db): …`, `chore(db): …`.

---

## File Structure

- `packages/db/src/migrate-to-scheme/status-map.ts` — **Create.** Pure old-status-key → new-status-key mapping (+ test).
- `packages/db/src/migrate-to-scheme/status-map.test.ts` — **Create.**
- `packages/db/src/migrate-to-scheme/run.ts` — **Create.** The idempotent migration script.
- `packages/db/src/migrate-to-scheme/verify.ts` — **Create.** Post-migration orphan/count checks.
- `packages/db/src/schema/*.ts` — **Modify (Task 5).** Drop `project_id` from config tables; `NOT NULL` on `scheme_id`/`ticket_type_id`; swap statuses unique constraint.
- `packages/db/drizzle/NNNN_*.sql` — **Generated (Task 5).**

---

## Task 1: Confirm the live vocabulary (measurement, no code)

The remap tables must match what the four projects actually use. Read the ground truth first.

- [ ] **Step 1: List distinct statuses, types, fields, and `area` values in use**

Run:
```bash
pnpm --filter @tickets/db exec tsx -e "import{createDbClient}from './src/client';import{statuses,ticketTypes,fields}from './src/schema';const{db,sql}=createDbClient({max:1});console.log('statuses',(await db.select().from(statuses)).map(s=>s.key));console.log('types',(await db.select().from(ticketTypes)).map(t=>t.key));console.log('fields',(await db.select().from(fields)).map(f=>f.key));await sql.end();"
```
Expected: statuses ≈ `open, investigating, investigated, brainstorming, designing, in-progress, review, blocked, fixed, dropped` (×4 projects); types `task, subtask`; fields `title, description, status, severity, epic, area` (+ `assignee` if the assignee backfill ran).

- [ ] **Step 2: Record any status/field key NOT covered by the map in Task 2.** If a key appears that the map below doesn't handle, add it to the map before proceeding. This step is the guard against a silent mis-map.

---

## Task 2: Pure status mapping

**Files:** Create `status-map.ts` (+ test).

**Interfaces:** `mapOldStatusKey(oldKey: string, newTypeKey: string): string` — returns a status key that exists on the target type in the Software scheme.

- [ ] **Step 1: Failing test** — `packages/db/src/migrate-to-scheme/status-map.test.ts`:

```ts
import { expect, test } from 'vitest';
import { mapOldStatusKey } from './status-map';

test('activity phases collapse to in-progress', () => {
  for (const k of ['investigating', 'brainstorming', 'designing', 'in-progress']) {
    expect(mapOldStatusKey(k, 'task')).toBe('in-progress');
  }
});
test('review maps to in-review', () => {
  expect(mapOldStatusKey('review', 'task')).toBe('in-review');
});
test('open/investigated become the type entry', () => {
  expect(mapOldStatusKey('open', 'task')).toBe('backlog');
  expect(mapOldStatusKey('open', 'subtask')).toBe('todo'); // subtask has no backlog
});
test('fixed maps to the type done terminal', () => {
  expect(mapOldStatusKey('fixed', 'task')).toBe('done');
  expect(mapOldStatusKey('fixed', 'bug')).toBe('fixed');
});
test('dropped maps to the type drop terminal', () => {
  expect(mapOldStatusKey('dropped', 'task')).toBe('cancelled');
  expect(mapOldStatusKey('dropped', 'bug')).toBe('wont-fix');
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `status-map.ts`**

```ts
// Old project-wide status key + target type key → a status key that exists on
// that type in the Software scheme.
export function mapOldStatusKey(oldKey: string, newTypeKey: string): string {
  const hasBacklog = newTypeKey === 'epic' || newTypeKey === 'task' || newTypeKey === 'bug';
  const entry = newTypeKey === 'bug' ? 'triage' : hasBacklog ? 'backlog' : 'todo';
  const doneKey = newTypeKey === 'bug' ? 'fixed' : 'done';
  const dropKey = newTypeKey === 'bug' ? 'wont-fix' : 'cancelled';
  switch (oldKey) {
    case 'open':
    case 'investigated':
      return entry;
    case 'investigating':
    case 'brainstorming':
    case 'designing':
    case 'in-progress':
      return 'in-progress';
    case 'review':
      return 'in-review';
    case 'blocked':
      return 'blocked';
    case 'fixed':
      return doneKey;
    case 'dropped':
      return dropKey;
    default:
      return entry; // safe fallback; Task 1 Step 2 ensures no surprises
  }
}
```

- [ ] **Step 4: Run — expect PASS. Commit.**

```bash
git add packages/db/src/migrate-to-scheme/status-map.ts packages/db/src/migrate-to-scheme/status-map.test.ts
git commit -m "feat(db): pure old→new status key mapping"
```

---

## Task 3: The migration script (non-destructive remap)

**Files:** Create `packages/db/src/migrate-to-scheme/run.ts`.

**Interfaces:** `migrateProjectToScheme(db, projectId, schemeMaps)` binds one project and remaps its tickets. `schemeMaps` = the Software scheme's `typeIdByKey`, `statusIdByTypeKey`, `fieldIdByKey`, and per-field option maps.

- [ ] **Step 1: Write the script**

`run.ts` (ensures the scheme, then loops the four projects). Core remap per project, in one transaction:

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { createDbClient } from '../client';
import { fieldOptions, fields, projects, schemes, statuses, ticketValues, tickets, ticketTypes } from '../schema';
import { seedScheme } from '../seed/seed-scheme';
import { SOFTWARE_SCHEME } from '../seed/software-scheme';
import { mapOldStatusKey } from './status-map';

const { db, sql } = createDbClient({ max: 1 });

// 1. ensure the Software scheme + load its id maps
const [existing] = await db.select().from(schemes).where(eq(schemes.key, SOFTWARE_SCHEME.key));
let schemeId: number;
if (existing) {
  schemeId = existing.id;
} else {
  schemeId = (await seedScheme(db, SOFTWARE_SCHEME)).schemeId;
}
const newTypes = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, schemeId));
const newTypeIdByKey = new Map(newTypes.map((t) => [t.key, t.id]));
const newStatuses = await db.select().from(statuses).where(inArray(statuses.ticketTypeId, newTypes.map((t) => t.id)));
const newStatusId = (typeKey: string, statusKey: string) => {
  const typeId = newTypeIdByKey.get(typeKey)!;
  return newStatuses.find((s) => s.ticketTypeId === typeId && s.key === statusKey)!.id;
};
const newFields = await db.select().from(fields).where(eq(fields.schemeId, schemeId));
const newFieldIdByKey = new Map(newFields.map((f) => [f.key, f.id]));
const newSeverity = newFields.find((f) => f.key === 'severity')!;
const newSeverityOptions = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, newSeverity.id));

// 2. migrate each existing (unbound) project
const allProjects = await db.select().from(projects);
for (const project of allProjects) {
  if (project.schemeId != null || project.id === schemeId) continue; // idempotent skip
  await db.transaction(async (tx) => {
    const oldTypes = await tx.select().from(ticketTypes).where(eq(ticketTypes.projectId, project.id));
    const oldTypeKeyById = new Map(oldTypes.map((t) => [t.id, t.key]));
    const oldStatuses = await tx.select().from(statuses).where(eq(statuses.projectId, project.id));
    const oldStatusKeyById = new Map(oldStatuses.map((s) => [s.id, s.key]));
    const oldFields = await tx.select().from(fields).where(eq(fields.projectId, project.id));
    const oldFieldKeyById = new Map(oldFields.map((f) => [f.id, f.key]));

    const projTickets = await tx.select().from(tickets).where(eq(tickets.projectId, project.id));
    for (const ticket of projTickets) {
      const newTypeKey = oldTypeKeyById.get(ticket.typeId) ?? 'task';
      // 2a. type
      await tx.update(tickets).set({ typeId: newTypeIdByKey.get(newTypeKey)! }).where(eq(tickets.id, ticket.id));
      // 2b. values
      const vals = await tx.select().from(ticketValues).where(eq(ticketValues.ticketId, ticket.id));
      for (const val of vals) {
        const oldFieldKey = oldFieldKeyById.get(val.fieldId);
        if (!oldFieldKey) continue;
        if (oldFieldKey === 'epic' || oldFieldKey === 'area') continue; // handled in Task 4
        const newFieldId = newFieldIdByKey.get(oldFieldKey);
        if (newFieldId === undefined) { await tx.delete(ticketValues).where(eq(ticketValues.id, val.id)); continue; }
        if (val.statusId != null) {
          const oldKey = oldStatusKeyById.get(val.statusId) ?? 'open';
          await tx.update(ticketValues).set({ fieldId: newFieldId, statusId: newStatusId(newTypeKey, mapOldStatusKey(oldKey, newTypeKey)) }).where(eq(ticketValues.id, val.id));
        } else if (val.optionId != null && oldFieldKey === 'severity') {
          const oldOpt = (await tx.select().from(fieldOptions).where(eq(fieldOptions.id, val.optionId)))[0];
          const newOpt = newSeverityOptions.find((o) => o.value === oldOpt?.value) ?? newSeverityOptions.find((o) => o.value === 'medium')!;
          await tx.update(ticketValues).set({ fieldId: newFieldId, optionId: newOpt.id }).where(eq(ticketValues.id, val.id));
        } else {
          await tx.update(ticketValues).set({ fieldId: newFieldId }).where(eq(ticketValues.id, val.id));
        }
      }
    }
    await tx.update(projects).set({ schemeId }).where(eq(projects.id, project.id));
  });
  console.log(`migrated project ${project.key}`);
}
await sql.end();
```

- [ ] **Step 2: Dry-run against one project first**

Temporarily narrow the loop to `project.key === 'TIX'` (smallest). Run: `pnpm --filter @tickets/db exec tsx src/migrate-to-scheme/run.ts`. Then run the verify script (Task 6) scoped to TIX. Confirm zero orphans, then restore the full loop.

- [ ] **Step 3: Commit the script** (do not run it fully yet — Tasks 4 & 6 complete the picture).

```bash
git add packages/db/src/migrate-to-scheme/run.ts
git commit -m "feat(db): scheme migration remap script (types, statuses, fields, options)"
```

---

## Task 4: Epic field → hierarchy, area → component

**Files:** Modify `packages/db/src/migrate-to-scheme/run.ts`.

**Interfaces:** within each project transaction, before deleting old config: create one Epic ticket per distinct `epic` value and re-parent its members; create `component` options from distinct `area` strings and copy values.

- [ ] **Step 1: Epic values → Epic tickets + parenting**

Inside the project transaction (after value remap, before binding), add: collect `(ticketId, epicValue)` from old `epic` field values; for each distinct `epicValue`, insert an Epic ticket (`typeId` = Epic, next number via `nextTicketNumber`, `createdBy` = the claude user id, title = the epic value) and set every member ticket's `parentId` to it. Guard: members that are `subtask` cannot parent to an Epic (type rules) — re-parent only `task`/`bug`/`spike`; leave subtasks under their existing task parent. Then delete the old `epic` `ticket_values` rows.

- [ ] **Step 2: Area values → component options + values**

Collect distinct `area` strings; for each not already a `component` option, insert a `field_options` row on the scheme's `component` field (value = slugified area, label = area). Rewrite each old `area` value row to `{ fieldId: component field id, optionId: matching option id }`. (Component is scheme-owned, so the option is added once and shared.)

- [ ] **Step 3: Measurement** — after a TIX dry-run: every former-epic member has a `parentId`; no `ticket_values` reference the old `epic`/`area` field ids; `component` options include the former areas.

- [ ] **Step 4: Commit.**

```bash
git add packages/db/src/migrate-to-scheme/run.ts
git commit -m "feat(db): migrate epic field to hierarchy and area to component"
```

---

## Task 5: Run the full migration + verify

**Files:** Create `packages/db/src/migrate-to-scheme/verify.ts`.

- [ ] **Step 1: Write the verifier** — `verify.ts` asserts, across all bound projects: (a) every `tickets.type_id` points to a Software-scheme type; (b) every `ticket_values.status_id` points to a status owned by that ticket's type; (c) no `ticket_values.field_id` points to an archived/old field; (d) counts of tickets are unchanged vs a pre-migration snapshot.

```ts
import { eq, inArray } from 'drizzle-orm';
import { createDbClient } from '../client';
import { fields, schemes, statuses, ticketValues, tickets, ticketTypes } from '../schema';

const { db, sql } = createDbClient({ max: 1 });
const [software] = await db.select().from(schemes).where(eq(schemes.key, 'software'));
const schemeTypes = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, software!.id));
const typeIds = new Set(schemeTypes.map((t) => t.id));
const schemeStatuses = await db.select().from(statuses).where(inArray(statuses.ticketTypeId, schemeTypes.map((t) => t.id)));
const statusTypeById = new Map(schemeStatuses.map((s) => [s.id, s.ticketTypeId]));
const schemeFieldIds = new Set((await db.select().from(fields).where(eq(fields.schemeId, software!.id))).map((f) => f.id));

const allTickets = await db.select().from(tickets);
let badType = 0, badStatus = 0, badField = 0;
for (const t of allTickets) {
  if (!typeIds.has(t.typeId)) badType++;
  const vals = await db.select().from(ticketValues).where(eq(ticketValues.ticketId, t.id));
  for (const v of vals) {
    if (!schemeFieldIds.has(v.fieldId)) badField++;
    if (v.statusId != null && statusTypeById.get(v.statusId) !== t.typeId) badStatus++;
  }
}
console.log({ tickets: allTickets.length, badType, badStatus, badField });
await sql.end();
```

- [ ] **Step 2: Snapshot counts, back up, then migrate**

```bash
pnpm --filter @tickets/db exec tsx -e "import{createDbClient}from './src/client';import{tickets}from './src/schema';const{db,sql}=createDbClient({max:1});console.log('tickets',(await db.select().from(tickets)).length);await sql.end();"
# back up
docker compose exec -T db pg_dump -U postgres tickets > backup-pre-scheme.sql
# migrate
pnpm --filter @tickets/db exec tsx src/migrate-to-scheme/run.ts
```
Expected: `migrated project TASK/APP/GW/TIX` (each once).

- [ ] **Step 3: Verify — expect all-zero bad counts**

Run: `pnpm --filter @tickets/db exec tsx src/migrate-to-scheme/verify.ts`
Expected: `{ tickets: <same as snapshot>, badType: 0, badStatus: 0, badField: 0 }`. If any non-zero, restore from `backup-pre-scheme.sql`, fix the map/script, retry.

- [ ] **Step 4: Board smoke test**

Hit `GET /api/projects/TASK/board` and confirm tickets render with the new statuses/types and correct priority/assignee columns. Confirm an epic-derived parent shows its children.

- [ ] **Step 5: Commit the verifier.**

```bash
git add packages/db/src/migrate-to-scheme/verify.ts
git commit -m "feat(db): scheme migration verifier"
```

---

## Task 6: Delete old config + tighten the schema

**Files:** Modify `packages/db/src/migrate-to-scheme/run.ts` (final cleanup pass) and the schema files; generated migration.

- [ ] **Step 1: Delete orphaned old config rows**

Add a final, separate script step (or a `--cleanup` branch) that, for every project now bound to the scheme, deletes its old project-scoped `ticket_type_fields`, `field_options` (of old fields), `fields`, `statuses`, `status_transitions` (of old statuses), `ticket_types`, and `link_types` — **only** rows whose `project_id` is set and whose ids are no longer referenced by any `ticket`/`ticket_values`. Run the verifier again afterward (still all-zero).

- [ ] **Step 2: Tighten columns in the schema files**

Now that no rows rely on them: in `ticket-types.ts`, `fields.ts`, `link-types.ts` remove the `projectId` column entirely and add `.notNull()` to `schemeId`; in `statuses.ts` remove `projectId`, add `.notNull()` to `ticketTypeId`, and change the unique constraint from `statuses_project_key` on `(projectId, key)` to `(ticketTypeId, key)`; in `projects.ts` add `.notNull()` to `schemeId`.

- [ ] **Step 3: Generate + review + apply**

Run: `pnpm db:generate`
Expected: a migration dropping four `project_id` columns, adding `NOT NULL`s, and swapping the statuses unique index. **Review carefully** — confirm no `DROP TABLE`, only the intended `ALTER`s.
Run: `pnpm db:migrate` → `migrations applied`.

- [ ] **Step 4: Update `loadProjectVocab` — remove the `project_id` fallback**

The fallback branches added in Plan 1 Task 6 (and the vocab-mutation fallbacks in Plan 2 Task 6) are now dead — every project is scheme-bound. Delete the `project_id` fallback branches so the code reads only by scheme. Run `pnpm typecheck`.

- [ ] **Step 5: Full verification**

Run: `pnpm typecheck && pnpm build && pnpm test`
Expected: all PASS. Re-run `verify.ts` → still all-zero. Board smoke test on all four projects.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/ apps/api/src/vocab/load-project-vocab.ts apps/api/src/routes/vocabulary.routes.ts packages/db/drizzle/
git commit -m "chore(db): drop legacy project-scoped config columns; require scheme binding"
```

---

## Self-review notes (author)

- **Spec coverage (Migration section):** create Software scheme ✓; bind 4 projects ✓ (Task 3); remap status by kind+intent ✓ (Tasks 2-3); type map task/subtask ✓ (Task 3); epic→hierarchy ✓ + area→component ✓ (Task 4); re-point field/option ids ✓ (Task 3); delete old inline config + tighten schema ✓ (Task 6).
- **Placeholder scan:** the two English-described steps (Task 4 Epic/area, Task 6 delete) are procedural on purpose (they depend on live data shapes surfaced in Task 1); every code-bearing step shows full code + expected output. Task 1 forces confirmation of the live vocabulary so the maps can't silently miss a key.
- **Type consistency:** `mapOldStatusKey(oldKey, newTypeKey)` signature matches its test and its call in `run.ts`; `newStatusId(typeKey, statusKey)` resolves within a type, matching the type-owned model from Plan 1/2.
- **Safety:** non-destructive remap (Tasks 3-5) is fully verified before any deletion or DDL tightening (Task 6); a `pg_dump` backup precedes the destructive run; the script is idempotent (skips bound projects) and per-project transactional.
- **Cross-plan invariant:** after this plan, `scheme_id`/`ticket_type_id` are `NOT NULL` and the `project_id` config columns are gone — closing out the "nullable during transition" decision from Plan 1.
