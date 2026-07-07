# Scheme Workflow Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scheme's per-type workflows real and safe: resolve statuses per type (they are now type-owned and share keys), enforce type-aware hierarchy, seed + enforce the transition graph with two guards, scheme-scope the vocab-mutation routes, and add a `cloneScheme` fork.

**Architecture:** Builds directly on Plan 1 (the `schemes` table, type-owned `statuses`, `loadProjectVocab` reading by scheme). Pure decision logic (status resolution, hierarchy rules, transition expansion, guards, clone remap) is extracted into small functions and unit-tested with vitest; DDL/seed effects are verified by measurement. `checkTransition` already enforces graph membership — this plan seeds the edges and adds guards.

**Tech Stack:** Drizzle ORM, Fastify + valibot, vitest (new), tsx, pnpm + turbo.

## Global Constraints

- **Depends on Plan 1 being merged** (schemes table, `ticket_type_id` on statuses, scheme-scoped vocab load).
- **Postgres running:** `docker compose up -d`.
- **Status keys are ambiguous across types** — never resolve a status by bare key; always resolve within a `typeId`.
- **The five kinds are fixed**; `merged`/`deployed` are `active`. Guards live in `status_transitions.config`, never new columns.
- **Hybrid verification:** vitest unit tests for pure logic; `pnpm db:generate/migrate/seed` + curl + `pnpm typecheck`/`build` for the rest. Commit after each task.
- **Conventional commits:** `feat(api|db): …`, `test(api|db): …`.

---

## File Structure

- `apps/api/vitest.config.ts` — **Create.** vitest for `@tickets/api`.
- `packages/db/vitest.config.ts` — **Create.** vitest for `@tickets/db`.
- `apps/api/package.json`, `packages/db/package.json`, `package.json`, `turbo.json` — **Modify.** `test` scripts + pipeline + vitest devDep.
- `apps/api/src/vocab/load-project-vocab.ts` — **Modify.** Add `statusByTypeKey`, `initialStatusByTypeId`.
- `apps/api/src/tickets/resolve-status.ts` — **Create.** Pure `resolveStatus` / `initialStatusFor`.
- `apps/api/src/tickets/resolve-status.test.ts` — **Create.** Unit tests.
- `apps/api/src/tickets/build-value-rows.ts` — **Modify.** Take `typeId`; resolve status per type.
- `apps/api/src/routes/tickets.routes.ts` — **Modify.** Pass `typeId`; per-type initial status; guard calls.
- `apps/api/src/tickets/check-parent.ts` — **Modify.** Type-aware rules.
- `apps/api/src/tickets/check-parent.test.ts` — **Create.** Unit tests.
- `packages/db/src/seed/scheme-types.ts` — **Modify.** `allowedChildTypes` on `TypeDef`; transitions types.
- `packages/db/src/seed/software-scheme.ts` — **Modify.** `allowedChildTypes` per type.
- `packages/db/src/seed/build-transitions.ts` — **Create.** Pure edge expansion.
- `packages/db/src/seed/build-transitions.test.ts` — **Create.** Unit tests.
- `packages/db/src/seed/seed-scheme.ts` — **Modify.** Insert transitions + `allowedChildTypes` into type config.
- `apps/api/src/tickets/check-guard.ts` — **Create.** Pure guard check.
- `apps/api/src/tickets/check-guard.test.ts` — **Create.** Unit tests.
- `apps/api/src/routes/vocabulary.routes.ts` — **Modify.** Scheme-scope field/status/link/transition creation.
- `apps/api/src/schemes/clone-scheme.ts` — **Create.** `cloneScheme` service + pure `remapClonedRows`.
- `apps/api/src/schemes/clone-scheme.test.ts` — **Create.** Unit test for remap.
- `apps/api/src/routes/schemes.routes.ts` — **Create.** `POST /api/schemes/:id/fork`.
- `apps/api/src/app.ts` — **Modify.** Register schemes routes.

---

## Task 1: vitest harness (api + db)

**Files:** Create `apps/api/vitest.config.ts`, `packages/db/vitest.config.ts`; Modify the two `package.json`s, root `package.json`, `turbo.json`.

**Interfaces:** Produces `pnpm --filter @tickets/api test` and `pnpm --filter @tickets/db test` running vitest, plus `pnpm test` (turbo) fanning out. Mirrors `apps/web/vitest.config.ts`.

- [ ] **Step 1: Read the web vitest config for the house style**

Run: open `apps/web/vitest.config.ts`. Copy its `test` block shape (environment, globals) minus any DOM/jsdom bits — api/db tests are node.

- [ ] **Step 2: Create `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 3: Create `packages/db/vitest.config.ts`** — identical content.

- [ ] **Step 4: Add devDep + script to both packages**

In `apps/api/package.json` and `packages/db/package.json`, add to `scripts`: `"test": "vitest run"`, and to `devDependencies`: `"vitest": "^3.2.0"` (match the version already in `apps/web`; check its package.json and use the same).

- [ ] **Step 5: Wire root + turbo**

In root `package.json` scripts add: `"test": "turbo test"`. In `turbo.json` add a `test` task (mirror the existing `typecheck` task's shape, `"dependsOn": ["^build"]` if that is the local convention, else `{}`).

- [ ] **Step 6: Prove the harness with a trivial test**

Create `apps/api/src/smoke.test.ts`:

```ts
import { expect, test } from 'vitest';
test('vitest runs', () => expect(1 + 1).toBe(2));
```

Run: `pnpm --filter @tickets/api install` (to link vitest) then `pnpm --filter @tickets/api test`
Expected: 1 passed. Delete `smoke.test.ts` after.

- [ ] **Step 7: Commit**

```bash
git add apps/api/vitest.config.ts packages/db/vitest.config.ts apps/api/package.json packages/db/package.json package.json turbo.json pnpm-lock.yaml
git commit -m "test(api,db): add vitest harness"
```

---

## Task 2: Type-aware status resolution

**Files:** Modify `load-project-vocab.ts`, `build-value-rows.ts`, `tickets.routes.ts`; Create `resolve-status.ts` (+ test).

**Interfaces:**
- Produces on `ProjectVocab`: `statusByTypeKey: Map<string, StatusRow>` keyed `` `${typeId}:${statusKey}` ``, and `initialStatusByTypeId: Map<number, StatusRow>`.
- Produces `resolveStatus(vocab, typeId, key): StatusRow` (throws 400 if none) and `initialStatusFor(vocab, typeId): StatusRow | undefined`.
- `buildValueRows(vocab, fieldKey, value, typeId?)` — `typeId` is required when the field is a `status`.

- [ ] **Step 1: Write the failing unit test**

Create `apps/api/src/tickets/resolve-status.test.ts`:

```ts
import { expect, test } from 'vitest';
import { initialStatusFor, resolveStatus } from './resolve-status';

const vocab = {
  statusByTypeKey: new Map([
    ['1:in-progress', { id: 11, key: 'in-progress' }],
    ['2:in-progress', { id: 22, key: 'in-progress' }],
    ['2:triage', { id: 20, key: 'triage' }],
  ]),
  initialStatusByTypeId: new Map([[2, { id: 20, key: 'triage' }]]),
} as any;

test('resolves the same key to different ids per type', () => {
  expect(resolveStatus(vocab, 1, 'in-progress').id).toBe(11);
  expect(resolveStatus(vocab, 2, 'in-progress').id).toBe(22);
});

test('unknown status throws', () => {
  expect(() => resolveStatus(vocab, 1, 'nope')).toThrow();
});

test('initial status is per type', () => {
  expect(initialStatusFor(vocab, 2)?.key).toBe('triage');
});
```

- [ ] **Step 2: Run it — expect FAIL** (`resolve-status` not found).
Run: `pnpm --filter @tickets/api test resolve-status`

- [ ] **Step 3: Implement `resolve-status.ts`**

```ts
import { HttpError } from '../errors';
import type { ProjectVocab } from '../vocab/load-project-vocab';

export function resolveStatus(vocab: ProjectVocab, typeId: number, key: string) {
  const status = vocab.statusByTypeKey.get(`${typeId}:${key}`);
  if (!status || status.archivedAt) {
    throw new HttpError(400, `unknown status "${key}" for this ticket type`);
  }
  return status;
}

export function initialStatusFor(vocab: ProjectVocab, typeId: number) {
  return vocab.initialStatusByTypeId.get(typeId);
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Add the maps to `load-project-vocab.ts`**

In the returned object, add:

```ts
    statusByTypeKey: new Map(
      statusRows
        .filter((row) => row.ticketTypeId != null)
        .map((row) => [`${row.ticketTypeId}:${row.key}`, row]),
    ),
    initialStatusByTypeId: new Map(
      statusRows
        .filter((row) => row.ticketTypeId != null && (row.config as { initial?: boolean }).initial === true)
        .map((row) => [row.ticketTypeId as number, row]),
    ),
```

Leave the existing `statusByKey`/`statusById` in place (other readers still use `statusById`; `statusByKey` becomes best-effort and is no longer used on the write path after this task).

- [ ] **Step 6: Make `buildValueRows` resolve status per type**

In `build-value-rows.ts`, change the signature and the status branch:

```ts
export function buildValueRows(vocab: ProjectVocab, fieldKey: string, value: unknown, typeId?: number): ValueRow[] {
```

Replace the `status` branch (lines 72-81) with:

```ts
  if (field.type === 'status') {
    if (typeof value !== 'string') {
      throw new HttpError(400, `field "${fieldKey}" expects a status key`);
    }
    if (typeId === undefined) {
      throw new HttpError(500, 'status resolution requires a ticket type');
    }
    const status = resolveStatus(vocab, typeId, value);
    return [{ fieldId: field.id, statusId: status.id }];
  }
```

Add `import { resolveStatus } from './resolve-status';` at the top.

- [ ] **Step 7: Thread `typeId` through the routes**

In `tickets.routes.ts`:
- create path (line 115): `const rows = buildValueRows(vocab, fieldKey, value, type.id);`
- create default-status block (lines 80-88): replace the cross-type `vocab.statuses.find(...initial)` with `const initial = initialStatusFor(vocab, type.id);` and set `values[statusField.key] = initial.key`.
- patch path (line 199): `const nextRows = buildValueRows(vocab, fieldKey, value, typeId);`

Add `import { initialStatusFor } from '../tickets/resolve-status';`.

- [ ] **Step 8: Measurement — create + move a Bug**

Seed a project (Plan 1), then:
```bash
curl -s -X POST localhost:4600/api/projects/demo/tickets -H 'content-type: application/json' \
  -d '{"actorId":1,"typeKey":"bug","values":{"title":"boom"}}'
```
Expected: 201; the created Bug's status defaults to `triage` (Bug's initial), not `backlog`. Confirm via `GET /api/tickets/:id` or the board. Then PATCH its status to `in-progress` and expect 200 (resolves to the Bug's `in-progress`, id distinct from Task's).

- [ ] **Step 9: typecheck + test + commit**

Run: `pnpm typecheck && pnpm --filter @tickets/api test`
```bash
git add apps/api/src/tickets/resolve-status.ts apps/api/src/tickets/resolve-status.test.ts apps/api/src/vocab/load-project-vocab.ts apps/api/src/tickets/build-value-rows.ts apps/api/src/routes/tickets.routes.ts
git commit -m "feat(api): resolve statuses per ticket type"
```

---

## Task 3: Type-aware hierarchy

**Files:** Modify `scheme-types.ts`, `software-scheme.ts`, `seed-scheme.ts`, `check-parent.ts`, `tickets.routes.ts`; Create `check-parent.test.ts`.

**Interfaces:**
- `TypeDef` gains `allowedChildTypes?: string[]`.
- `ticket_types.config.allowedChildTypes: string[]` seeded.
- `checkParent(db, { ticketId, parentId, childTypeKey, vocab })` — throws 422 when `childTypeKey` is not in the parent type's `allowedChildTypes`.

- [ ] **Step 1: Declare allowed children**

In `software-scheme.ts` add to each `TypeDef`: epic → `allowedChildTypes: ['task', 'bug', 'spike']`; task/bug/spike → `['subtask']`; subtask → `[]`. Add `allowedChildTypes?: string[]` to `TypeDef` in `scheme-types.ts`.

- [ ] **Step 2: Seed it into type config**

In `seed-scheme.ts`, change the `ticketTypes` insert `config` to `{ color: t.color, allowedChildTypes: t.allowedChildTypes ?? [] }`.

- [ ] **Step 3: Write the failing unit test**

Create `apps/api/src/tickets/check-parent.test.ts` (pure part only — the rule check, given a resolved parent type):

```ts
import { expect, test } from 'vitest';
import { assertChildAllowed } from './check-parent';

test('epic allows task', () => {
  expect(() => assertChildAllowed('epic', ['task', 'bug', 'spike'], 'task')).not.toThrow();
});
test('subtask allows nothing', () => {
  expect(() => assertChildAllowed('subtask', [], 'subtask')).toThrow();
});
test('task under task is rejected', () => {
  expect(() => assertChildAllowed('task', ['subtask'], 'task')).toThrow();
});
```

- [ ] **Step 4: Run — expect FAIL.**

- [ ] **Step 5: Rewrite `check-parent.ts`**

```ts
import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { tickets } from '@tickets/db';
import { HttpError } from '../errors';
import type { ProjectVocab } from '../vocab/load-project-vocab';

// pure rule — exported for unit tests
export function assertChildAllowed(parentTypeKey: string, allowed: string[], childTypeKey: string): void {
  if (!allowed.includes(childTypeKey)) {
    throw new HttpError(422, `a ${childTypeKey} cannot be nested under a ${parentTypeKey}`);
  }
}

export async function checkParent(
  db: DbExecutor,
  input: { ticketId: number | null; parentId: number; childTypeKey: string; vocab: ProjectVocab },
): Promise<void> {
  const parentRows = await db.select().from(tickets).where(eq(tickets.id, input.parentId));
  const parent = parentRows[0];
  if (!parent || parent.projectId !== input.vocab.project.id) {
    throw new HttpError(400, 'parent ticket not found in this project');
  }
  if (input.ticketId !== null && input.ticketId === input.parentId) {
    throw new HttpError(422, 'a ticket cannot be its own parent');
  }
  const parentType = input.vocab.typeById.get(parent.typeId);
  const allowed = ((parentType?.config as { allowedChildTypes?: string[] })?.allowedChildTypes) ?? [];
  assertChildAllowed(parentType?.key ?? 'unknown', allowed, input.childTypeKey);
}
```

The type rules form a DAG (Epic→Task/Bug/Spike→Subtask; Subtask→∅), so they inherently cap depth at 3 and prevent cycles — no separate depth/`already has children` checks are needed.

- [ ] **Step 6: Update the two call sites in `tickets.routes.ts`**

- create (line 91): `await checkParent(db, { ticketId: null, parentId: body.parentId, childTypeKey: type.key, vocab });`
- patch (line 168): `await checkParent(tx, { ticketId: id, parentId: body.parentId, childTypeKey: vocab.typeById.get(typeId)!.key, vocab });`

- [ ] **Step 7: Run tests + measurement**

Run: `pnpm --filter @tickets/api test check-parent` → PASS.
Measurement: attempt to create a `subtask` under an `epic` (parentId = an epic ticket) → expect 422; create a `task` under an `epic` → expect 201; create a `subtask` under a `task` → 201.

- [ ] **Step 8: Regenerate seed data (type config now carries allowedChildTypes)**

Re-run `pnpm db:seed demo2 Demo2 DEMO2` against a fresh scheme (or reseed) and confirm `ticket_types.config` includes `allowedChildTypes` via a quick select.

- [ ] **Step 9: typecheck + commit**

```bash
git add apps/api/src/tickets/check-parent.ts apps/api/src/tickets/check-parent.test.ts apps/api/src/routes/tickets.routes.ts packages/db/src/seed/scheme-types.ts packages/db/src/seed/software-scheme.ts packages/db/src/seed/seed-scheme.ts
git commit -m "feat(api): type-aware ticket hierarchy"
```

---

## Task 4: Seed the transition graph

**Files:** Create `build-transitions.ts` (+ test); Modify `seed-scheme.ts`, `scheme-types.ts`.

**Interfaces:**
- `TransitionDef = { fromKey: string | null; toKey: string; config?: { guard?: { requiresField?: string; requiresComment?: boolean } } }`.
- `buildTransitions(type: TypeDef): TransitionDef[]` — expands entry, forward, kickback, block, drop, reopen edges and attaches guards (`→merged` ⇒ `requiresField: 'pr'`; target kind `dropped` or key `fixed` ⇒ `requiresComment: true`).

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/seed/build-transitions.test.ts`:

```ts
import { expect, test } from 'vitest';
import { buildTransitions } from './build-transitions';
import { SOFTWARE_SCHEME } from './software-scheme';

const task = SOFTWARE_SCHEME.types.find((t) => t.key === 'task')!;
const bug = SOFTWARE_SCHEME.types.find((t) => t.key === 'bug')!;
const edges = buildTransitions(task);

test('has one entry edge to the initial status', () => {
  const entries = edges.filter((e) => e.fromKey === null);
  expect(entries).toHaveLength(1);
  expect(entries[0]!.toKey).toBe('backlog');
});

test('forward path connects backlog→todo→in-progress', () => {
  expect(edges.some((e) => e.fromKey === 'backlog' && e.toKey === 'todo')).toBe(true);
  expect(edges.some((e) => e.fromKey === 'todo' && e.toKey === 'in-progress')).toBe(true);
});

test('→merged carries the PR guard', () => {
  const merged = edges.find((e) => e.toKey === 'merged' && e.fromKey === 'in-review');
  expect(merged?.config?.guard?.requiresField).toBe('pr');
});

test('bug →fixed and →wont-fix require a comment', () => {
  const be = buildTransitions(bug);
  expect(be.find((e) => e.toKey === 'fixed')?.config?.guard?.requiresComment).toBe(true);
  expect(be.find((e) => e.toKey === 'wont-fix')?.config?.guard?.requiresComment).toBe(true);
});

test('every non-terminal status can block and reach a drop', () => {
  expect(edges.some((e) => e.fromKey === 'in-progress' && e.toKey === 'blocked')).toBe(true);
  expect(edges.some((e) => e.fromKey === 'in-progress' && e.toKey === 'cancelled')).toBe(true);
});

test('done reopens to in-progress', () => {
  expect(edges.some((e) => e.fromKey === 'done' && e.toKey === 'in-progress')).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `build-transitions.ts`**

```ts
import type { TransitionDef, TypeDef } from './scheme-types';

export function buildTransitions(type: TypeDef): TransitionDef[] {
  const statuses = type.statuses;
  const byKind = (k: string) => statuses.filter((s) => s.kind === k);
  const flow = statuses.filter((s) => s.kind === 'todo' || s.kind === 'active' || s.kind === 'done');
  const activeStatuses = byKind('active');
  const firstActive = activeStatuses[0];
  const blocked = byKind('blocked')[0];
  const drops = byKind('dropped');
  const dones = byKind('done');
  const initial = statuses.find((s) => s.initial) ?? flow[0];

  const edges: TransitionDef[] = [];
  const guardFor = (toKey: string, toKind: string): TransitionDef['config'] => {
    if (toKey === 'merged') return { guard: { requiresField: 'pr' } };
    if (toKind === 'dropped' || toKey === 'fixed') return { guard: { requiresComment: true } };
    return undefined;
  };
  const push = (fromKey: string | null, to: { key: string; kind: string }) =>
    edges.push({ fromKey, toKey: to.key, ...(guardFor(to.key, to.kind) ? { config: guardFor(to.key, to.kind)! } : {}) });

  // entry
  if (initial) push(null, initial);
  // forward
  for (let i = 0; i < flow.length - 1; i++) push(flow[i]!.key, flow[i + 1]!);
  // kickback: any active (after the first) back to the first active
  if (firstActive) for (const a of activeStatuses.slice(1)) push(a.key, firstActive);
  // block / unblock across non-done flow statuses
  if (blocked) {
    for (const f of flow.filter((s) => s.kind !== 'done')) {
      push(f.key, blocked);
      push(blocked.key, f);
    }
  }
  // drop from every non-terminal (todo/active/blocked)
  const nonTerminal = statuses.filter((s) => s.kind === 'todo' || s.kind === 'active' || s.kind === 'blocked');
  for (const n of nonTerminal) for (const d of drops) push(n.key, d);
  // reopen
  if (firstActive) for (const d of dones) push(d.key, firstActive);
  if (initial) for (const d of drops) push(d.key, initial);

  return edges;
}
```

Add `TransitionDef` to `scheme-types.ts`:
```ts
export type TransitionDef = { fromKey: string | null; toKey: string; config?: { guard?: { requiresField?: string; requiresComment?: boolean } } };
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Insert transitions in `seed-scheme.ts`**

After each type's statuses are inserted (inside the type loop, once `byStatusKey` is complete), add:

```ts
      const { buildTransitions } = await import('./build-transitions');
      const edgeDefs = buildTransitions(t);
      if (edgeDefs.length > 0) {
        await tx.insert(statusTransitions).values(
          edgeDefs.map((e) => ({
            fromStatusId: e.fromKey === null ? null : byStatusKey[e.fromKey]!,
            toStatusId: byStatusKey[e.toKey]!,
            ticketTypeId: typeRow.id,
            config: e.config ?? {},
          })),
        );
      }
```

Add `statusTransitions` to the schema import at the top of `seed-scheme.ts`. (Prefer a top-level `import { buildTransitions } from './build-transitions';` over the inline `await import`.)

- [ ] **Step 6: Measurement — edges exist and guards land**

Reseed a scheme, then:
```bash
pnpm --filter @tickets/db exec tsx -e "import{createDbClient}from './src/client';import{statusTransitions}from './src/schema';const{db,sql}=createDbClient({max:1});const rows=await db.select().from(statusTransitions);console.log({edges:rows.length,guarded:rows.filter(r=>Object.keys(r.config).length).length});await sql.end();"
```
Expected: `edges` > 0 and `guarded` > 0 (the `→merged`, `→fixed`, `→cancelled`, `→wont-fix` edges).

- [ ] **Step 7: test + typecheck + commit**

```bash
git add packages/db/src/seed/build-transitions.ts packages/db/src/seed/build-transitions.test.ts packages/db/src/seed/seed-scheme.ts packages/db/src/seed/scheme-types.ts
git commit -m "feat(db): seed per-type transition graph with guards"
```

---

## Task 5: Enforce the two guards

**Files:** Create `check-guard.ts` (+ test); Modify `tickets.routes.ts`, `load-project-vocab.ts`.

**Interfaces:**
- `ProjectVocab.transitions` rows already include `config` — expose a lookup `transitionEdge(vocab, {fromStatusId, toStatusId, typeId})` returning the matched edge (or undefined).
- `checkGuard(guard, state: { hasField: (key: string) => boolean; commentCount: number })` — pure; throws 422 when unmet.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/tickets/check-guard.test.ts`:

```ts
import { expect, test } from 'vitest';
import { checkGuard } from './check-guard';

test('requiresField passes when field present', () => {
  expect(() => checkGuard({ requiresField: 'pr' }, { hasField: () => true, commentCount: 0 })).not.toThrow();
});
test('requiresField throws when absent', () => {
  expect(() => checkGuard({ requiresField: 'pr' }, { hasField: () => false, commentCount: 0 })).toThrow();
});
test('requiresComment needs at least one comment', () => {
  expect(() => checkGuard({ requiresComment: true }, { hasField: () => true, commentCount: 0 })).toThrow();
  expect(() => checkGuard({ requiresComment: true }, { hasField: () => true, commentCount: 1 })).not.toThrow();
});
test('no guard is a no-op', () => {
  expect(() => checkGuard(undefined, { hasField: () => false, commentCount: 0 })).not.toThrow();
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `check-guard.ts`**

```ts
import { HttpError } from '../errors';

export type Guard = { requiresField?: string; requiresComment?: boolean };

export function checkGuard(
  guard: Guard | undefined,
  state: { hasField: (key: string) => boolean; commentCount: number },
): void {
  if (!guard) return;
  if (guard.requiresField && !state.hasField(guard.requiresField)) {
    throw new HttpError(422, `set "${guard.requiresField}" before this transition`);
  }
  if (guard.requiresComment && state.commentCount < 1) {
    throw new HttpError(422, 'add a comment explaining the resolution before closing');
  }
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Add `transitionEdge` helper to `load-project-vocab.ts`**

Append to the returned object a plain function is awkward on a data object; instead export a helper in the same file:

```ts
export function transitionEdge(
  vocab: ProjectVocab,
  input: { fromStatusId: number | null; toStatusId: number; typeId: number },
) {
  return vocab.transitions.find(
    (e) =>
      (e.ticketTypeId === null || e.ticketTypeId === input.typeId) &&
      e.fromStatusId === input.fromStatusId &&
      e.toStatusId === input.toStatusId,
  );
}
```

- [ ] **Step 6: Wire guards into the patch path**

In `tickets.routes.ts` patch status branch, right after `checkTransition(...)` (line 210), gather state and check the guard:

```ts
          const edge = transitionEdge(vocab, { fromStatusId, toStatusId: nextStatusId, typeId });
          const guard = (edge?.config as { guard?: Guard } | undefined)?.guard;
          if (guard) {
            const commentRows = guard.requiresComment
              ? await tx.select({ n: count() }).from(comments).where(eq(comments.ticketId, id))
              : [{ n: 0 }];
            const prField = vocab.fieldByKey.get('pr');
            const prRows = guard.requiresField && prField
              ? await tx.select().from(ticketValues).where(and(eq(ticketValues.ticketId, id), eq(ticketValues.fieldId, prField.id)))
              : [];
            checkGuard(guard, {
              hasField: () => prRows.some((r) => (r.valueText ?? '') !== ''),
              commentCount: Number(commentRows[0]?.n ?? 0),
            });
          }
```

Add imports: `import { comments } from '@tickets/db';`, `import { checkGuard, type Guard } from '../tickets/check-guard';`, `import { transitionEdge } from '../vocab/load-project-vocab';`. (`count`, `and`, `eq`, `ticketValues` are already imported.)

For the **create** path, a brand-new ticket has no comments and its `pr`/close statuses are not reachable as an entry edge, so no guard runs on create — the entry edge to the initial status carries no guard by construction.

- [ ] **Step 7: Measurement — guards bite**

On a Task ticket with no `pr` value, PATCH status `in-review → merged` → expect **422** "set pr…". Set `pr` to a URL, retry → **200**. On a Bug with no comments, PATCH → `wont-fix` → **422**; add a comment via `POST /api/tickets/:id/comments`, retry → **200**.

- [ ] **Step 8: test + typecheck + commit**

```bash
git add apps/api/src/tickets/check-guard.ts apps/api/src/tickets/check-guard.test.ts apps/api/src/vocab/load-project-vocab.ts apps/api/src/routes/tickets.routes.ts
git commit -m "feat(api): enforce transition guards (PR before merge, comment before close)"
```

---

## Task 6: Scheme-scope the vocab-mutation routes

**Files:** Modify `apps/api/src/routes/vocabulary.routes.ts`.

**Interfaces:** `createField`/`createLinkType` write `schemeId: vocab.project.schemeId`; `createStatus` requires a `typeKey` and writes `ticketTypeId`; `createTransition` resolves statuses within a type. Falls back to `projectId` when `project.schemeId` is null (parity with `loadProjectVocab`).

- [ ] **Step 1: Field + link-type creation target the scheme**

In `createField` insert, replace `projectId: vocab.project.id` with the scheme when present:

```ts
        ...(vocab.project.schemeId != null ? { schemeId: vocab.project.schemeId } : { projectId: vocab.project.id }),
```

Do the same in `createLinkType`.

- [ ] **Step 2: Status creation is type-scoped**

Add `ticketTypeKey: v.pipe(v.string(), v.minLength(1))` to `createStatusSchema`. In `createStatus`, resolve the type and write `ticketTypeId`:

```ts
    const type = vocab.typeByKey.get(body.ticketTypeKey);
    if (!type) throw new HttpError(400, `unknown ticket type "${body.ticketTypeKey}"`);
    const typeStatusCount = vocab.statuses.filter((s) => s.ticketTypeId === type.id).length;
    const inserted = await db.insert(statuses).values({
      ticketTypeId: type.id,
      key: body.key, label: body.label, kind: body.kind,
      config: body.config ?? {}, position: typeStatusCount,
    }).returning();
```

- [ ] **Step 3: Transition creation resolves per type**

In `createTransition`, `body.ticketTypeKey` is now effectively required (statuses are type-owned). Resolve the type first, then resolve from/to statuses via `statusByTypeKey.get(\`${type.id}:${key}\`)` instead of the ambiguous `statusByKey`. Throw 400 if `ticketTypeKey` is missing.

- [ ] **Step 4: Measurement**

Create a field via `POST /api/projects/demo/fields` → confirm it appears on the board (proves it was scheme-scoped and thus loaded). Create a status with `ticketTypeKey:"task"` → confirm it appears only under Task.

- [ ] **Step 5: typecheck + commit**

```bash
git add apps/api/src/routes/vocabulary.routes.ts
git commit -m "feat(api): scheme-scope vocab mutations; statuses created per type"
```

---

## Task 7: Clone a scheme (fork)

**Files:** Create `clone-scheme.ts` (+ test), `schemes.routes.ts`; Modify `app.ts`.

**Interfaces:**
- `remapClonedRows(rows, idMap)` — pure: given source rows carrying old FK ids and a `Map<oldId,newId>`, returns rows with remapped FKs. Unit-tested.
- `cloneScheme(db, sourceSchemeId, { key, name }): Promise<{ schemeId: number }>` — deep-copies scheme → types → statuses/transitions, fields → options, ticket_type_fields, link_types with fresh ids.
- `POST /api/schemes/:id/fork` → `{ key, name }` → 201 `{ id }`.

- [ ] **Step 1: Failing unit test for the pure remap**

Create `apps/api/src/schemes/clone-scheme.test.ts`:

```ts
import { expect, test } from 'vitest';
import { remapClonedRows } from './clone-scheme';

test('remaps a foreign key column via the id map', () => {
  const idMap = new Map([[10, 100], [11, 101]]);
  const rows = [{ id: 10, ticketTypeId: 10, key: 'a' }, { id: 11, ticketTypeId: 11, key: 'b' }];
  const out = remapClonedRows(rows, 'ticketTypeId', idMap);
  expect(out).toEqual([{ ticketTypeId: 100, key: 'a' }, { ticketTypeId: 101, key: 'b' }]);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `clone-scheme.ts`**

```ts
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import {
  fieldOptions, fields, linkTypes, schemes, statusTransitions, statuses, ticketTypeFields, ticketTypes,
} from '@tickets/db';

// pure: strip `id`, remap one FK column, keep the rest
export function remapClonedRows<T extends { id: number }>(
  rows: T[],
  fkColumn: keyof T,
  idMap: Map<number, number>,
): Array<Omit<T, 'id'>> {
  return rows.map(({ id: _id, ...rest }) => ({
    ...rest,
    [fkColumn]: idMap.get(rest[fkColumn] as unknown as number) as unknown,
  })) as Array<Omit<T, 'id'>>;
}

export async function cloneScheme(db: Db, sourceSchemeId: number, input: { key: string; name: string }) {
  return db.transaction(async (tx) => {
    const [src] = await tx.select().from(schemes).where(eq(schemes.id, sourceSchemeId));
    if (!src) throw new Error('source scheme not found');
    const [dst] = await tx.insert(schemes).values({ key: input.key, name: input.name, description: src.description, config: src.config }).returning();

    // types
    const srcTypes = await tx.select().from(ticketTypes).where(eq(ticketTypes.schemeId, sourceSchemeId));
    const typeIdMap = new Map<number, number>();
    for (const t of srcTypes) {
      const [n] = await tx.insert(ticketTypes).values({ schemeId: dst!.id, key: t.key, label: t.label, position: t.position, config: t.config }).returning();
      typeIdMap.set(t.id, n!.id);
    }
    // statuses (per type) → build status id map
    const srcStatuses = srcTypes.length ? await tx.select().from(statuses).where(inArray(statuses.ticketTypeId, srcTypes.map((t) => t.id))) : [];
    const statusIdMap = new Map<number, number>();
    for (const s of srcStatuses) {
      const [n] = await tx.insert(statuses).values({ ticketTypeId: typeIdMap.get(s.ticketTypeId!)!, key: s.key, label: s.label, kind: s.kind, position: s.position, config: s.config }).returning();
      statusIdMap.set(s.id, n!.id);
    }
    // transitions: remap from/to/type
    const srcTransitions = srcStatuses.length ? await tx.select().from(statusTransitions).where(inArray(statusTransitions.toStatusId, srcStatuses.map((s) => s.id))) : [];
    if (srcTransitions.length) {
      await tx.insert(statusTransitions).values(srcTransitions.map((e) => ({
        fromStatusId: e.fromStatusId === null ? null : statusIdMap.get(e.fromStatusId)!,
        toStatusId: statusIdMap.get(e.toStatusId)!,
        ticketTypeId: e.ticketTypeId === null ? null : typeIdMap.get(e.ticketTypeId)!,
        config: e.config,
      })));
    }
    // fields → options
    const srcFields = await tx.select().from(fields).where(eq(fields.schemeId, sourceSchemeId));
    const fieldIdMap = new Map<number, number>();
    for (const f of srcFields) {
      const [n] = await tx.insert(fields).values({ schemeId: dst!.id, key: f.key, label: f.label, type: f.type, system: f.system, config: f.config }).returning();
      fieldIdMap.set(f.id, n!.id);
    }
    const srcOptions = srcFields.length ? await tx.select().from(fieldOptions).where(inArray(fieldOptions.fieldId, srcFields.map((f) => f.id))) : [];
    if (srcOptions.length) await tx.insert(fieldOptions).values(remapClonedRows(srcOptions, 'fieldId', fieldIdMap));
    // ticket_type_fields (two FKs — remap both)
    const srcTTF = srcTypes.length ? await tx.select().from(ticketTypeFields).where(inArray(ticketTypeFields.ticketTypeId, srcTypes.map((t) => t.id))) : [];
    if (srcTTF.length) await tx.insert(ticketTypeFields).values(srcTTF.map((r) => ({ ticketTypeId: typeIdMap.get(r.ticketTypeId)!, fieldId: fieldIdMap.get(r.fieldId)!, position: r.position, required: r.required })));
    // link types
    const srcLinks = await tx.select().from(linkTypes).where(eq(linkTypes.schemeId, sourceSchemeId));
    if (srcLinks.length) await tx.insert(linkTypes).values(srcLinks.map((l) => ({ schemeId: dst!.id, key: l.key, label: l.label, inverseLabel: l.inverseLabel, directional: l.directional, position: l.position })));

    return { schemeId: dst!.id };
  });
}
```

- [ ] **Step 4: Run remap test — expect PASS.**

- [ ] **Step 5: Fork route + registration**

Create `apps/api/src/routes/schemes.routes.ts`:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import type { Db } from '@tickets/db';
import { cloneScheme } from '../schemes/clone-scheme';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';

const forkSchema = v.object({ key: v.pipe(v.string(), v.minLength(1)), name: v.pipe(v.string(), v.minLength(1)) });

export function registerSchemesRoutes(app: FastifyInstance, context: { db: Db }) {
  app.post('/api/schemes/:id/fork', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(forkSchema, request.body);
    const result = await cloneScheme(context.db, id, body);
    reply.status(201).send(result);
  });
}
```

Register in `app.ts`: import and call `registerSchemesRoutes(app, context);`.

- [ ] **Step 6: Measurement — fork copies everything**

```bash
curl -s -X POST localhost:4600/api/schemes/1/fork -H 'content-type: application/json' -d '{"key":"software-fork","name":"Software (fork)"}'
```
Then assert the fork's child counts equal the source's (5 types, 15 fields, 34 statuses, 4 link types, and equal transition counts) with a `tsx` select on both `schemeId`s.

- [ ] **Step 7: test + typecheck + build + commit**

```bash
git add apps/api/src/schemes/ apps/api/src/routes/schemes.routes.ts apps/api/src/app.ts
git commit -m "feat(api): clone/fork a scheme"
```

---

## Self-review notes (author)

- **Spec coverage:** enforced transition graph seeded ✓ (Task 4) + already-existing `checkTransition` enforces it; the two guards ✓ (Task 5); type-aware hierarchy ✓ (Task 3); clone/fork ✓ (Task 7); the type-owned-status write-path correctness the Scheme change requires ✓ (Task 2) and vocab-mutation re-scoping ✓ (Task 6).
- **Placeholder scan:** every code step is complete; commands have expected outputs.
- **Type consistency:** `TransitionDef`/`TypeDef` in `scheme-types.ts` match `build-transitions.ts` and its test; `Guard` shape matches between `check-guard.ts`, the seeded `status_transitions.config`, and the patch-path lookup; `resolveStatus`/`initialStatusFor` signatures match their callers; `checkParent`'s new signature matches both call sites.
- **Deferred to Plan 3:** backfilling the 4 existing projects onto the Software scheme, remapping tickets, dropping the old `project_id` columns, tightening `NOT NULL`, and swapping the `statuses` unique constraint to `(ticket_type_id, key)`.
- **Risk noted:** `buildTransitions` breadth (block/drop edges from every non-terminal) is intentionally permissive; the unit test pins the guard-bearing and forward edges, the rest are convenience edges.
