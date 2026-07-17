# SP4a Phase 1 — Web Working-UI Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the redesigned Instrument web app's working screens off the old ticket API onto the new items API + board shape, surfacing the type/option model, yielding a deployable app on the new schema.

**Architecture:** The migration is centered on the board response shape (`apps/web/src/api/types.ts`) and the derived indexes (`utils/index-board.ts`). `GET /api/projects/:key/board` now returns `{project, types, fields, placements, options(+kind,+optionSetId), transitions(+fieldId,+optionIds), linkTypes, views, users, items}` — a status is an `option` on the field whose `config.workflow===true`; fields are a scheme library placed on types via `placements`. Every mutation now carries a `{commandId, actorId}` envelope. Screens re-derive vocab from the board via new indexes; a shared `apiMutate` wrapper adds the envelope.

**Tech Stack:** React 19, TanStack Router/Query, Tailwind v4, valibot-free client, vitest + jsdom + @testing-library/react.

## Global Constraints

- **This is a coordinated shape migration.** `apps/web/src/api/types.ts` is rewritten in Task 1, which breaks compilation across consumers. `pnpm --filter @tickets/web typecheck` and a full `test` run stay RED from Task 1 until the final integration task **by design** — mirroring the SP2/SP3 "package red mid-branch" precedent. **Per-task gate:** run the task's own vitest file(s) by name (`pnpm --filter @tickets/web test -- <file>`), which pass in isolation because vitest compiles per-file. The FINAL task restores full `typecheck` + `test` + `build` green — that is the deployability gate. Do not treat a red whole-package typecheck mid-plan as a failure.
- **New board shape (verbatim target).** `Board = { project: Project; types: ItemType[]; fields: Field[]; placements: ItemTypeField[]; options: Option[]; transitions: Transition[]; linkTypes: LinkType[]; views: View[]; users: User[]; items: Item[] }`. Field/type/option/etc shapes are defined in Task 1 and must be used verbatim by later tasks.
- **The workflow field** is the placed field with `config.workflow === true` (there is exactly one per type in this scheme; key is `status`). A status value is an `Option.value` string; lifecycle color/glyph come from `Option.kind ∈ {todo,active,blocked,done,dropped}` (null for non-workflow options). `'status'` is NO LONGER a `FieldType` — the workflow field's `type` is `'option'`.
- **Options are a shared pool**: `options[]` is top-level, keyed by `optionSetId`; a field's options = `options.filter(o => o.optionSetId === field.optionSetId)`, further narrowed per type by `placement.configOverride.allowedOptionIds` when present.
- **Transitions** are `{id, fieldId, itemTypeId: number|null, fromOptionId: number|null, toOptionId: number, config}`. Empty applicable-edge set ⇒ unrestricted (mirror the server); `itemTypeId === null` applies to all types.
- **Command envelope**: every mutating request body includes `commandId: crypto.randomUUID()` and `actorId` (from `useCurrentUser().userId`). Reads never do.
- **Field types** are now `'string'|'number'|'boolean'|'date'|'datetime'|'option'|'user'|'json'` (server enum). Map old widget branches: old `text`→`string`, old `select`/`multi_select`→`option` (with `config.multiple`), old `status`→`option`+`config.workflow`, new `user`/`datetime` added.
- **Terminology:** visible copy says "item" (generic) and the specific type name; drop "ticket". File/hook renames follow (`use-create-ticket`→`use-create-item`, etc.). Update test text expectations accordingly.
- **Tests only against tickets_test / mocked fetch.** Component tests stub `fetch`; never hit a live DB. Manual verification runs the API on `tickets_platform`, never production `tickets`.
- **Verification gate (final):** `pnpm --filter @tickets/web typecheck` + `pnpm --filter @tickets/web test` + `pnpm build` all green.

---

### Task 1: New board types (`types.ts`)

**Files:**
- Rewrite: `apps/web/src/api/types.ts`

**Interfaces:**
- Produces the verbatim types every later task consumes (Board, Item, ItemType, Field, ItemTypeField, Option, Transition, LinkType, View, User, Project, Comment, ItemLink, ActivityEntry, and the mutation input/envelope types).

- [ ] **Step 1: Replace the file contents**

Replace `apps/web/src/api/types.ts` entirely with:

```ts
export interface Project { id: number; key: string; name: string; schemeId: number; itemPrefix: string; createdAt: string; }

export type UserKind = 'human' | 'agent';
export interface User { id: number; name: string; email: string | null; kind: UserKind; archivedAt: string | null; }

export interface ItemType {
  id: number; schemeId: number; key: string; label: string;
  config: { color?: string } & Record<string, unknown>;
  archivedAt: string | null;
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'option' | 'user' | 'json';
export interface Field {
  id: number; schemeId: number; key: string; label: string; type: FieldType;
  config: { multiple?: boolean; workflow?: boolean; format?: string } & Record<string, unknown>;
  optionSetId: number | null;
  archivedAt: string | null;
}

// A field placed on a type.
export interface ItemTypeField {
  itemTypeId: number; fieldId: number; position: number; required: boolean;
  configOverride: { allowedOptionIds?: number[] } | null;
}

export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';
export interface Option {
  id: number; optionSetId: number; value: string; label: string; position: number;
  kind: StatusKind | null;                       // null for non-workflow options
  config: { color?: string; icon?: string } & Record<string, unknown>;
  archivedAt: string | null;
}

export interface Transition {
  id: number; fieldId: number; itemTypeId: number | null;
  fromOptionId: number | null; toOptionId: number;
  config: { guard?: { requiresComment?: boolean; requiresField?: string } } | null;
}

export interface LinkType { id: number; itemTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; }
export interface View { id: number; projectId: number; name: string; config: Record<string, unknown>; }

export interface Comment { id: number; itemId: number; authorId: number; parentId: number | null; body: string; createdAt: string; }
export interface ItemLink { id: number; linkTypeId: number; sourceItemId: number; targetItemId: number; createdAt: string; }

export interface Item {
  id: number; number: number; typeId: number; parentId: number | null;
  createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string;
  values: Record<string, unknown>;               // fieldKey -> rendered (option value string, {id,name}, scalar, or array)
  comments: Comment[]; links: ItemLink[];
}

export interface Board {
  project: Project;
  types: ItemType[];
  fields: Field[];
  placements: ItemTypeField[];
  options: Option[];
  transitions: Transition[];
  linkTypes: LinkType[];
  views: View[];
  users: User[];
  items: Item[];
}

export interface ActivityEntry {
  id: number; itemId: number; eventId: number; kind: string;
  actorId: number; at: string; correlationId: string; summary: Record<string, unknown>;
}

// The envelope every mutation body carries.
export interface CommandEnvelope { commandId: string; actorId: number; }

export interface CreateItemInput { projectKey: string; actorId: number; typeKey: string; parentId?: number | null; values: Record<string, unknown>; }
export interface PatchItemInput { itemId: number; actorId: number; expectedUpdatedAt: string; parentId?: number | null; archived?: boolean; values?: Record<string, unknown>; }
export interface CreatedItem { id: number; number: number; typeId: number; parentId: number | null; createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string; }
export interface PatchItemResult { id: number; updatedAt: string; }
export interface CreateCommentInput { itemId: number; actorId: number; body: string; parentId?: number | null; }
export interface CreateLinkInput { actorId: number; linkTypeKey: string; sourceItemId: number; targetItemId: number; }
export interface DeleteLinkInput { linkId: number; actorId: number; }
export interface CreateUserInput { name: string; kind?: UserKind; }
export interface CreateProjectInput { key: string; name: string; itemPrefix: string; }

export interface ListMeta { total?: number }
export interface UsersResponse { data: User[] }
export interface ProjectsResponse { data: Project[] }
```

- [ ] **Step 2: Verify the file typechecks in isolation**

Run: `npx --prefix apps/web tsc --noEmit apps/web/src/api/types.ts` (or `pnpm --filter @tickets/web exec tsc --noEmit --skipLibCheck src/api/types.ts`)
Expected: no errors in `types.ts` itself. (The wider package will not typecheck yet — expected per Global Constraints.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/types.ts
git commit -m "feat(web): new items board types (replaces ticket shapes)"
```

---

### Task 2: `index-board` over the new shape

**Files:**
- Rewrite: `apps/web/src/utils/index-board.ts`
- Create: `apps/web/src/utils/index-board.test.ts`

**Interfaces:**
- Consumes: Task 1 `Board`, `Item`, `Field`, `Option`, `ItemType`, `User`, `ItemTypeField`.
- Produces `indexBoard(board): BoardIndexes` with:
  `typeById: Map<number,ItemType>`, `fieldById: Map<number,Field>`, `fieldByKey: Map<string,Field>`,
  `userById: Map<number,User>`, `itemById: Map<number,Item>`, `itemByNumber: Map<number,Item>`,
  `optionById: Map<number,Option>`, `optionsBySetId: Map<number,Option[]>` (active, position-sorted),
  `placementsByType: Map<number,ItemTypeField[]>` (position-sorted),
  `childrenByParent: Map<number,Item[]>`,
  and methods `workflowField(typeId): Field | undefined`, `optionsForField(typeId, field): Option[]` (field's set, narrowed by the type's `configOverride.allowedOptionIds`), `optionByValue(field, value): Option | undefined`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/utils/index-board.test.ts`:

```ts
import { expect, test } from 'vitest';
import type { Board } from '../api/types';
import { indexBoard } from './index-board';

function board(): Board {
  return {
    project: { id: 1, key: 'core', name: 'Core', schemeId: 1, itemPrefix: 'CORE', createdAt: 'x' },
    types: [{ id: 1, schemeId: 1, key: 'task', label: 'Task', config: {}, archivedAt: null }],
    fields: [
      { id: 10, schemeId: 1, key: 'status', label: 'Status', type: 'option', config: { workflow: true }, optionSetId: 100, archivedAt: null },
      { id: 11, schemeId: 1, key: 'title', label: 'Title', type: 'string', config: {}, optionSetId: null, archivedAt: null },
    ],
    placements: [
      { itemTypeId: 1, fieldId: 11, position: 1, required: true, configOverride: null },
      { itemTypeId: 1, fieldId: 10, position: 2, required: false, configOverride: { allowedOptionIds: [1000, 1002] } },
    ],
    options: [
      { id: 1000, optionSetId: 100, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'wip', label: 'WIP', position: 2, kind: 'active', config: {}, archivedAt: null },
      { id: 1002, optionSetId: 100, value: 'done', label: 'Done', position: 3, kind: 'done', config: {}, archivedAt: null },
    ],
    transitions: [], linkTypes: [], views: [], users: [{ id: 7, name: 'A', email: null, kind: 'human', archivedAt: null }],
    items: [
      { id: 500, number: 1, typeId: 1, parentId: null, createdBy: 7, archivedAt: null, createdAt: 'x', updatedAt: 'x', values: { status: 'todo', title: 'P' }, comments: [], links: [] },
      { id: 501, number: 2, typeId: 1, parentId: 500, createdBy: 7, archivedAt: null, createdAt: 'x', updatedAt: 'x', values: {}, comments: [], links: [] },
    ],
  };
}

test('indexes maps, workflow field, per-type option allowlist, children', () => {
  const ix = indexBoard(board());
  expect(ix.typeById.get(1)!.key).toBe('task');
  expect(ix.itemByNumber.get(1)!.id).toBe(500);
  expect(ix.workflowField(1)!.key).toBe('status');
  // allowlist narrows the field's set to todo+done (not wip)
  expect(ix.optionsForField(1, ix.workflowField(1)!).map((o) => o.value)).toEqual(['todo', 'done']);
  expect(ix.optionByValue(ix.workflowField(1)!, 'done')!.id).toBe(1002);
  expect(ix.childrenByParent.get(500)!.map((c) => c.id)).toEqual([501]);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/web test -- index-board.test`
Expected: FAIL — new `indexBoard` shape not present.

- [ ] **Step 3: Rewrite `index-board.ts`**

```ts
import type { Board, Field, Item, ItemType, ItemTypeField, Option, User } from '../api/types';

export function indexBoard(board: Board) {
  const typeById = new Map<number, ItemType>(board.types.map((t) => [t.id, t]));
  const fieldById = new Map<number, Field>(board.fields.map((f) => [f.id, f]));
  const fieldByKey = new Map<string, Field>(board.fields.map((f) => [f.key, f]));
  const userById = new Map<number, User>(board.users.map((u) => [u.id, u]));
  const itemById = new Map<number, Item>(board.items.map((i) => [i.id, i]));
  const itemByNumber = new Map<number, Item>(board.items.map((i) => [i.number, i]));
  const optionById = new Map<number, Option>(board.options.map((o) => [o.id, o]));

  const optionsBySetId = new Map<number, Option[]>();
  for (const o of board.options) {
    if (o.archivedAt) continue;
    const bucket = optionsBySetId.get(o.optionSetId) ?? [];
    bucket.push(o);
    optionsBySetId.set(o.optionSetId, bucket);
  }
  for (const bucket of optionsBySetId.values()) bucket.sort((a, b) => a.position - b.position);

  const placementsByType = new Map<number, ItemTypeField[]>();
  for (const p of board.placements) {
    const bucket = placementsByType.get(p.itemTypeId) ?? [];
    bucket.push(p);
    placementsByType.set(p.itemTypeId, bucket);
  }
  for (const bucket of placementsByType.values()) bucket.sort((a, b) => a.position - b.position);

  const childrenByParent = new Map<number, Item[]>();
  for (const item of board.items) {
    if (item.parentId !== null && !item.archivedAt) {
      const bucket = childrenByParent.get(item.parentId) ?? [];
      bucket.push(item);
      childrenByParent.set(item.parentId, bucket);
    }
  }

  function placement(typeId: number, fieldId: number): ItemTypeField | undefined {
    return placementsByType.get(typeId)?.find((p) => p.fieldId === fieldId);
  }
  function workflowField(typeId: number): Field | undefined {
    for (const p of placementsByType.get(typeId) ?? []) {
      const f = fieldById.get(p.fieldId);
      if (f && (f.config as { workflow?: boolean }).workflow === true) return f;
    }
    return undefined;
  }
  function optionsForField(typeId: number, field: Field): Option[] {
    if (field.optionSetId === null) return [];
    const all = optionsBySetId.get(field.optionSetId) ?? [];
    const allow = placement(typeId, field.id)?.configOverride?.allowedOptionIds;
    return allow ? all.filter((o) => allow.includes(o.id)) : all;
  }
  function optionByValue(field: Field, value: string): Option | undefined {
    if (field.optionSetId === null) return undefined;
    return (optionsBySetId.get(field.optionSetId) ?? []).find((o) => o.value === value);
  }

  return {
    typeById, fieldById, fieldByKey, userById, itemById, itemByNumber, optionById,
    optionsBySetId, placementsByType, childrenByParent,
    placement, workflowField, optionsForField, optionByValue,
  };
}

export type BoardIndexes = ReturnType<typeof indexBoard>;
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @tickets/web test -- index-board.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/index-board.ts apps/web/src/utils/index-board.test.ts
git commit -m "feat(web): index-board over the items board shape"
```

---

### Task 3: `legal-status-targets` over options + transitions

**Files:**
- Rewrite: `apps/web/src/utils/legal-status-targets.ts`
- Create: `apps/web/src/utils/legal-status-targets.test.ts`

**Interfaces:**
- Consumes: Task 1 `Board`/`Item`/`Option`, Task 2 `BoardIndexes` (`workflowField`, `optionsForField`, `optionByValue`).
- Produces: `legalStatusTargets(board, indexes, item, typeId): Option[]` — the workflow options reachable for `item` (or entry options when `item === null`), for the given `typeId`. Empty applicable-edge set ⇒ all options. The current option stays listed.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/utils/legal-status-targets.test.ts`:

```ts
import { expect, test } from 'vitest';
import type { Board } from '../api/types';
import { indexBoard } from './index-board';
import { legalStatusTargets } from './legal-status-targets';

function board(transitions: Board['transitions']): Board {
  return {
    project: { id: 1, key: 'core', name: 'Core', schemeId: 1, itemPrefix: 'C', createdAt: 'x' },
    types: [{ id: 1, schemeId: 1, key: 'task', label: 'Task', config: {}, archivedAt: null }],
    fields: [{ id: 10, schemeId: 1, key: 'status', label: 'Status', type: 'option', config: { workflow: true }, optionSetId: 100, archivedAt: null }],
    placements: [{ itemTypeId: 1, fieldId: 10, position: 1, required: false, configOverride: null }],
    options: [
      { id: 1000, optionSetId: 100, value: 'todo', label: 'To do', position: 1, kind: 'todo', config: {}, archivedAt: null },
      { id: 1001, optionSetId: 100, value: 'wip', label: 'WIP', position: 2, kind: 'active', config: {}, archivedAt: null },
      { id: 1002, optionSetId: 100, value: 'done', label: 'Done', position: 3, kind: 'done', config: {}, archivedAt: null },
    ],
    transitions, linkTypes: [], views: [], users: [],
    items: [{ id: 500, number: 1, typeId: 1, parentId: null, createdBy: 1, archivedAt: null, createdAt: 'x', updatedAt: 'x', values: { status: 'todo' }, comments: [], links: [] }],
  };
}

test('no edges ⇒ all options', () => {
  const b = board([]);
  const ix = indexBoard(b);
  expect(legalStatusTargets(b, ix, b.items[0]!, 1).map((o) => o.value)).toEqual(['todo', 'wip', 'done']);
});

test('with edges ⇒ current + reachable', () => {
  const b = board([{ id: 1, fieldId: 10, itemTypeId: null, fromOptionId: 1000, toOptionId: 1001, config: null }]);
  const ix = indexBoard(b);
  // from todo: current (todo) + wip
  expect(legalStatusTargets(b, ix, b.items[0]!, 1).map((o) => o.value).sort()).toEqual(['todo', 'wip']);
});

test('creation uses entry edges (from null)', () => {
  const b = board([{ id: 1, fieldId: 10, itemTypeId: 1, fromOptionId: null, toOptionId: 1000, config: null }]);
  const ix = indexBoard(b);
  expect(legalStatusTargets(b, ix, null, 1).map((o) => o.value)).toEqual(['todo']);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/web test -- legal-status-targets.test`
Expected: FAIL.

- [ ] **Step 3: Rewrite `legal-status-targets.ts`**

```ts
import type { Board, Item, Option } from '../api/types';
import type { BoardIndexes } from './index-board';

// Mirrors the server's checkTransition: no applicable edges ⇒ anything goes;
// with edges, only current + matching from→to targets are legal.
export function legalStatusTargets(
  board: Board,
  indexes: BoardIndexes,
  item: Item | null,
  typeId: number,
): Option[] {
  const wf = indexes.workflowField(typeId);
  if (!wf) return [];
  const options = indexes.optionsForField(typeId, wf).filter((o) => !o.archivedAt);
  const applicable = board.transitions.filter(
    (e) => e.fieldId === wf.id && (e.itemTypeId === null || e.itemTypeId === typeId),
  );
  if (applicable.length === 0) return options;

  if (!item) {
    const entry = applicable.filter((e) => e.fromOptionId === null);
    if (entry.length === 0) return options;
    return options.filter((o) => entry.some((e) => e.toOptionId === o.id));
  }
  const currentValue = item.values[wf.key];
  const current = typeof currentValue === 'string' ? indexes.optionByValue(wf, currentValue) : undefined;
  const fromCurrent = applicable.filter((e) => e.fromOptionId === (current?.id ?? null));
  return options.filter((o) => o.id === current?.id || fromCurrent.some((e) => e.toOptionId === o.id));
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @tickets/web test -- legal-status-targets.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/legal-status-targets.ts apps/web/src/utils/legal-status-targets.test.ts
git commit -m "feat(web): legal-status-targets over options + option transitions"
```

---

### Task 4: `apiMutate` envelope wrapper

**Files:**
- Modify: `apps/web/src/api/client.ts` (add `apiMutate`)
- Create: `apps/web/src/api/client.test.ts`

**Interfaces:**
- Consumes: existing `fetchJson`.
- Produces: `apiMutate<T>(path: string, opts: { method: 'POST'|'PATCH'|'DELETE'; actorId: number; body?: Record<string, unknown> }): Promise<T>` — merges `{ commandId: crypto.randomUUID(), actorId, ...body }` into a JSON body and calls `fetchJson`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/api/client.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest';
import { apiMutate } from './client';

afterEach(() => vi.unstubAllGlobals());

test('apiMutate injects a uuid commandId + actorId into the JSON body', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify({ id: 1 })) });
  vi.stubGlobal('fetch', fetchMock);
  const res = await apiMutate<{ id: number }>('/api/items/1', { method: 'PATCH', actorId: 7, body: { archived: true } });
  expect(res).toEqual({ id: 1 });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/items/1');
  expect(init.method).toBe('PATCH');
  const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(sent.actorId).toBe(7);
  expect(sent.archived).toBe(true);
  expect(typeof sent.commandId).toBe('string');
  expect((sent.commandId as string)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @tickets/web test -- client.test`
Expected: FAIL — no `apiMutate` export.

- [ ] **Step 3: Add `apiMutate` to `client.ts`**

Append to `apps/web/src/api/client.ts`:

```ts
export function apiMutate<T>(
  path: string,
  opts: { method: 'POST' | 'PATCH' | 'DELETE'; actorId: number; body?: Record<string, unknown> },
): Promise<T> {
  const body = { commandId: crypto.randomUUID(), actorId: opts.actorId, ...(opts.body ?? {}) };
  return fetchJson<T>(path, { method: opts.method, body: JSON.stringify(body) });
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @tickets/web test -- client.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/api/client.test.ts
git commit -m "feat(web): apiMutate wrapper injects commandId+actorId envelope"
```

---

### Task 5: Mutation hooks — reweave to items routes + envelope

**Files:**
- Rename+rewrite: `apps/web/src/api/use-create-ticket.ts` → `use-create-item.ts`
- Rename+rewrite: `apps/web/src/api/use-patch-ticket.ts` → `use-patch-item.ts`
- Rewrite: `apps/web/src/api/use-create-comment.ts`
- Rewrite: `apps/web/src/api/use-create-link.ts`, `apps/web/src/api/use-delete-link.ts`
- Rename+rewrite: `apps/web/src/api/use-ticket-events.ts` → `use-item-activity.ts`
- Modify: `apps/web/src/api/use-create-project.ts`, `use-create-user.ts` (envelope; project body `itemPrefix`)

**Interfaces:**
- Consumes: Task 1 input types, Task 4 `apiMutate`, `useCurrentUser`.
- Produces (hook names + signatures used by screens): `useCreateItem()` (`mutate(CreateItemInput minus projectKey passed separately? keep projectKey in input)`), `usePatchItem()`, `useCreateComment()`, `useCreateLink()`, `useDeleteLink()`, `useItemActivity(itemId, take?)`. All mutations take `actorId` in their input and route through `apiMutate`.

- [ ] **Step 1: Rewrite the hooks**

`apps/web/src/api/use-create-item.ts` (was `use-create-ticket.ts` — delete the old file):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { CreateItemInput, CreatedItem } from './types';

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) => {
      const { projectKey, actorId, ...rest } = input;
      return apiMutate<CreatedItem>(`/api/projects/${encodeURIComponent(projectKey)}/items`, {
        method: 'POST', actorId, body: rest,
      });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
```

`apps/web/src/api/use-patch-item.ts` (was `use-patch-ticket.ts` — delete old):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { PatchItemInput, PatchItemResult } from './types';

export function usePatchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchItemInput) => {
      const { itemId, actorId, ...rest } = input;
      return apiMutate<PatchItemResult>(`/api/items/${itemId}`, { method: 'PATCH', actorId, body: rest });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
```

`apps/web/src/api/use-create-comment.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { Comment, CreateCommentInput } from './types';

export function useCreateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => {
      const { itemId, actorId, ...rest } = input;
      return apiMutate<Comment>(`/api/items/${itemId}/comments`, { method: 'POST', actorId, body: rest });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
```

`apps/web/src/api/use-create-link.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { CreateLinkInput, ItemLink } from './types';

export function useCreateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLinkInput) => {
      const { actorId, ...rest } = input;
      return apiMutate<ItemLink>('/api/links', { method: 'POST', actorId, body: rest });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
```

`apps/web/src/api/use-delete-link.ts` (envelope in BODY, not query):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { DeleteLinkInput } from './types';

export function useDeleteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteLinkInput) =>
      apiMutate<unknown>(`/api/links/${input.linkId}`, { method: 'DELETE', actorId: input.actorId }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
```

`apps/web/src/api/use-item-activity.ts` (was `use-ticket-events.ts` — delete old):

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { ActivityEntry } from './types';

export function useItemActivity(itemId: number | null, take = 50) {
  return useQuery({
    queryKey: ['item-activity', itemId, take],
    enabled: itemId !== null,
    queryFn: () => fetchJson<ActivityEntry[]>(`/api/items/${itemId}/activity`),
  });
}
```

`use-create-project.ts` — body field `ticketPrefix` → `itemPrefix`, route via `apiMutate`? Projects/users take no actor event on the server; keep plain `fetchJson` POST but update the body field name:

```ts
// mutationFn body: { key, name, itemPrefix }  (was ticketPrefix)
```

`use-create-user.ts` — unchanged route/body; leave as-is (no envelope needed — `/api/users` create takes no actor). Verify it still typechecks against the new `User`/`CreateUserInput`.

- [ ] **Step 2: Update call sites' imports (compile-driving)**

Search-and-update imports of the renamed hooks across `apps/web/src` (`useCreateTicket`→`useCreateItem`, `usePatchTicket`→`usePatchItem`, `useTicketEvents`→`useItemActivity`, and input field renames `sourceTicketId`→`sourceItemId`, `targetTicketId`→`targetItemId`, `ticketId`→`itemId`, `authorId`→`actorId` for comments). These are consumed in the screen tasks (Tasks 7–11); update the import paths now, leave deeper screen logic to those tasks. The package typecheck stays red until Task 12.

- [ ] **Step 3: Verify the hook files typecheck against types**

Run: `pnpm --filter @tickets/web exec tsc --noEmit --skipLibCheck src/api/use-create-item.ts src/api/use-patch-item.ts src/api/use-create-comment.ts src/api/use-create-link.ts src/api/use-delete-link.ts src/api/use-item-activity.ts`
Expected: no errors in these files (module-resolution errors for react-query types under `--skipLibCheck` are acceptable; focus on shape errors). If isolated tsc is impractical, defer verification to the screen tasks' vitest runs.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/
git rm apps/web/src/api/use-create-ticket.ts apps/web/src/api/use-patch-ticket.ts apps/web/src/api/use-ticket-events.ts 2>/dev/null || true
git commit -m "feat(web): reweave mutation hooks to items routes + envelope"
```

---

### Task 6: Remove the Phase-2 admin surface (keep the build focused)

**Files:**
- Delete: `apps/web/src/api/use-vocab-workflow.ts`, `apps/web/src/api/use-vocab-fields.ts`
- Delete: `apps/web/src/components/settings/` (types-settings, fields-settings, link-types-settings, workflow-settings, users-settings, settings-screen + their tests) — **except** keep `users-settings` if it only uses `/api/users` (which is unchanged); confirm per-file.
- Modify: `apps/web/src/router.ts`, `apps/web/src/routes/settings-route.tsx`, and any nav entry in `apps/web/src/components/shell/app-shell.tsx` to drop the settings route/link.

**Interfaces:** none produced — this removes code that targets removed routes and old vocab shapes. Schema administration is SP4a **Phase 2**; git preserves the deleted files for Phase 2 to port.

- [ ] **Step 1: Audit each settings file's API usage**

Run: `pnpm --filter @tickets/web exec grep -rn "use-vocab\|/api/projects/.*statuses\|status-transitions\|/api/fields\|/api/statuses\|/api/options" src/components/settings`
For each settings component: if it only reads board vocab + `/api/users` (unchanged), it MAY be kept and rewired in a later task; if it calls removed routes/hooks, delete it in this task.

- [ ] **Step 2: Delete the vocab hooks + admin components that call removed routes**

```bash
git rm apps/web/src/api/use-vocab-workflow.ts apps/web/src/api/use-vocab-fields.ts
git rm apps/web/src/components/settings/types-settings.tsx apps/web/src/components/settings/fields-settings.tsx apps/web/src/components/settings/fields-settings.test.tsx apps/web/src/components/settings/link-types-settings.tsx apps/web/src/components/settings/workflow-settings.tsx apps/web/src/components/settings/workflow-settings.test.tsx
```

(Keep `users-settings.tsx`/`.test.tsx` and `settings-screen.tsx` only if they compile against unchanged routes after trimming the removed panels; otherwise delete the settings route entirely.)

- [ ] **Step 3: Drop the settings route + nav link**

Edit `apps/web/src/router.ts` to remove the `settings` route registration; delete `apps/web/src/routes/settings-route.tsx` if now unused; remove the Settings nav item from `app-shell.tsx`. Also delete `use-create-link-type.ts` (link-type create is Phase-2 admin) if no working screen uses it.

- [ ] **Step 4: Verify no dangling imports**

Run: `pnpm --filter @tickets/web exec grep -rn "use-vocab-workflow\|use-vocab-fields\|types-settings\|fields-settings\|workflow-settings\|use-create-link-type" src`
Expected: no matches (or only inside now-deleted files).

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src
git commit -m "chore(web): remove Phase-2 admin surface (defer schema admin to SP4a Phase 2)"
```

---

### Task 7: Field rendering core — `field-widget` + `get-cell-content`

**Files:**
- Modify: `apps/web/src/registry/field-widget.tsx`
- Modify: `apps/web/src/registry/get-cell-content.tsx`
- Modify: `apps/web/src/registry/option-color.ts` (add a `kind`→color helper if not present)
- Test: extend/add `apps/web/src/registry/get-cell-content.test.tsx` (create if absent)

**Interfaces:**
- Consumes: Task 2 `BoardIndexes` (`optionsForField`, `optionByValue`, `workflowField`), Task 1 `Field`/`Option`.
- Produces: field rendering that dispatches on the new `FieldType` set and treats the workflow field (`config.workflow===true`) as an `option` field whose color/glyph derive from `Option.kind`.

- [ ] **Step 1: Apply the exact substitutions**

In BOTH `field-widget.tsx` and `get-cell-content.tsx`, replace the old `field.type` dispatch with the new enum and route the workflow field through the option path:

- `case 'text'` → `case 'string'` (keep the `config.format === 'markdown'` / `config.widget === 'markdown'` branch — check which key the widget uses; new fields use `config.format === 'markdown'`).
- `case 'select'` / `case 'multi_select'` → a single `case 'option'` that reads `field.config.multiple === true` to decide single vs multi; options come from `indexes.optionsForField(item.typeId, field)` (needs the item's typeId — thread `typeId` into these functions).
- Delete the dedicated `case 'status'`. The workflow field is just an `option` field; when rendering it, color/glyph come from `Option.kind` via a `kindColor(kind)` helper (add to `option-color.ts`), falling back to `hexToOptionColor(option.config.color)` for non-workflow options.
- Add `case 'user'`: render the assignee via `indexes.userById` (value is a user id number or `{id,name}`); `case 'datetime'`: same as `date` with time.
- Where old code called `indexes.optionsByFieldId.get(field.id)`, replace with `indexes.optionsForField(typeId, field)`; where it called `indexes.statusByKey.get(value)`, replace with `indexes.optionByValue(field, value)`.

Update the function signatures to accept `typeId: number` (the item's type) so `optionsForField` can apply the per-type allowlist. Update all callers accordingly (done in the screen tasks that call these).

- [ ] **Step 2: Add `kindColor` to `option-color.ts`**

```ts
import type { StatusKind } from '../api/types';
// Lifecycle kind → named palette color (the workflow field's primary color source).
export function kindColor(kind: StatusKind | null): OptionColor {
  switch (kind) {
    case 'todo': return 'slate';
    case 'active': return 'blue';
    case 'blocked': return 'amber';
    case 'done': return 'green';
    case 'dropped': return 'rose';
    default: return 'slate';
  }
}
```

(Use the actual `OptionColor` names present in `option-color.ts` — read the file and map to its palette.)

- [ ] **Step 3: Add/extend the cell-content test**

Add a test asserting: an `option` field renders the option label; the workflow field renders a `StatusBadge` colored by `kind`; a `user` field renders the user name. Mock a board via the Task 2 factory shape.

Run: `pnpm --filter @tickets/web test -- get-cell-content.test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/registry/
git commit -m "feat(web): render fields over the new option model (workflow=option+kind)"
```

---

### Task 8: Create dialog (`new-item-dialog`)

**Files:**
- Rename+modify: `apps/web/src/components/new-ticket-dialog.tsx` → `new-item-dialog.tsx`
- Rewrite: `apps/web/src/components/new-ticket-dialog.test.tsx` → `new-item-dialog.test.tsx`
- Update importers (routes/board screen) of the dialog + `SubtaskQuickCreate`.

**Interfaces:**
- Consumes: `useCreateItem`, Task 2 indexes (`placementsByType`, `workflowField`, `optionsForField`), Task 3 `legalStatusTargets`, Task 7 `FieldWidget`.
- Produces: `NewItemDialog`, `SubtaskQuickCreate` (same props, board is new shape).

- [ ] **Step 1: Apply substitutions in the component**

- `board.typeFields.filter(r => r.ticketTypeId === type.id)` → `indexes.placementsByType.get(type.id) ?? []`.
- Field lookup `indexes.fieldById.get(row.fieldId)`; required from `placement.required`.
- Status default: `legalStatusTargets(board, indexes, null, type.id)`; pick the type's `initialOption` = first `todo`-kind option else first (mirror `vocab.initialOption`); set `values[workflowField.key] = option.value`.
- Copy: "New ticket" → "New item"; "New Bug" stays (type label); "Create ticket" → "Create item"; "Created from a parent ticket's Subtasks section" → "…parent item's…".
- Submit via `useCreateItem().mutate({ projectKey, actorId: userId, typeKey, parentId?, values })`.

- [ ] **Step 2: Rewrite the test to the new board factory + new expectations**

Port `new-ticket-dialog.test.tsx` to `new-item-dialog.test.tsx`: use the Task 2/3 board factory shape (types/fields/placements/options/items — NOT statuses/typeFields). Update assertions:
- title text: `New item`; type button names unchanged (`Task`, `Bug`); `Create item` button.
- The POST assertion: URL `/api/projects/CORE/items`; body now `{ commandId: expect.any(String), actorId: 7, typeKey: 'bug', values: {...} }` — assert `commandId` is a uuid and the rest equals; use `expect.objectContaining` or delete `commandId` before `toEqual`.
- Subtask POST: URL `/api/projects/CORE/items`; body `{ commandId, actorId: 7, typeKey: 'subtask', parentId: 100, values: { title: '…' } }`.

Run: `pnpm --filter @tickets/web test -- new-item-dialog.test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/new-item-dialog.tsx apps/web/src/components/new-item-dialog.test.tsx
git rm apps/web/src/components/new-ticket-dialog.tsx apps/web/src/components/new-ticket-dialog.test.tsx 2>/dev/null || true
git commit -m "feat(web): type-aware new-item dialog on the items API"
```

---

### Task 9: Item detail (drawer + detail-* panels + activity)

**Files:**
- Rename+modify: `apps/web/src/components/ticket-drawer.tsx` → `item-drawer.tsx`, `ticket-detail.tsx` → `item-detail.tsx`
- Modify: `apps/web/src/components/detail-fields.tsx`, `detail-comments.tsx`, `detail-links.tsx`, `detail-children.tsx`, `detail-activity.tsx`
- Rewrite: `ticket-drawer.test.tsx` → `item-drawer.test.tsx`

**Interfaces:**
- Consumes: `usePatchItem`, `useCreateComment`, `useCreateLink`, `useDeleteLink`, `useItemActivity`, Task 2 indexes, Task 3 `legalStatusTargets`, Task 7 `FieldWidget`.

- [ ] **Step 1: Substitutions across the detail components**

- `board.tickets`/`BoardTicket`/`ticket` → `board.items`/`Item`/`item`; `ticket.typeId` unchanged name.
- `detail-fields.tsx`: `board.typeFields.filter(r => r.ticketTypeId === ticket.typeId)` → `indexes.placementsByType.get(item.typeId) ?? []`; skip the workflow field in the grid (drawer header owns status) via `field.config.workflow === true` instead of `field.type === 'status'`. Thread `item.typeId` into `FieldWidget`.
- Status control in the drawer header: options from `legalStatusTargets(board, indexes, item, item.typeId)`; render with `StatusSelect` mapping each `Option`→`{ key: option.value, label: option.label, kind: option.kind }`, `legalTargets` = those option values; on change call `usePatchItem().mutate({ itemId, actorId, expectedUpdatedAt: item.updatedAt, values: { [workflowField.key]: nextValue } })`. Surface a 422 message via the existing toast.
- `detail-comments.tsx`: `useCreateComment().mutate({ itemId, actorId: userId, body })` (was `authorId`).
- `detail-links.tsx`: link create/delete via new hooks; link fields `sourceItemId`/`targetItemId`; resolve link type from `board.linkTypes`.
- `detail-activity.tsx`: replace `useTicketEvents` with `useItemActivity`; render `ActivityEntry[]` (`entry.kind` + `entry.summary` + actor via `indexes.userById.get(entry.actorId)`, time `entry.at`). Map the SP3 summary shapes (`item.created`→"created", `item.field_changed`→`${summary.field}: ${summary.from}→${summary.to}`, `comment.added`→`summary.excerpt`, `item.linked`→link).
- `detail-children.tsx`: children from `indexes.childrenByParent.get(item.id)`.

- [ ] **Step 2: Rewrite the drawer test**

Port `ticket-drawer.test.tsx` → `item-drawer.test.tsx` to the new board factory. Update the PATCH assertion: URL `/api/items/100`; body includes `commandId` (uuid) + `actorId` + `expectedUpdatedAt` + `values`. The old test asserted `expect(url).toBe('/api/tickets/100')` — change to `/api/items/100` and account for the envelope.

Run: `pnpm --filter @tickets/web test -- item-drawer.test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/
git rm apps/web/src/components/ticket-drawer.tsx apps/web/src/components/ticket-detail.tsx apps/web/src/components/ticket-drawer.test.tsx 2>/dev/null || true
git commit -m "feat(web): type-aware item detail (drawer, fields, comments, links, activity)"
```

---

### Task 10: Board (kanban + table + board screen)

**Files:**
- Modify: `apps/web/src/components/kanban-view.tsx`, `board/table-view.tsx`, `board-screen.tsx`, `board/board-header.tsx`, `board/filter-chips.tsx`, `board/kpi-strip.tsx`
- Rewrite: `apps/web/src/components/kanban-view.test.tsx`

**Interfaces:**
- Consumes: Task 2 indexes, Task 7 rendering, `legalStatusTargets`.

- [ ] **Step 1: Substitutions**

- Columns: build from the project's workflow options. Since types can differ, use the board-level status option set: `indexes.optionsBySetId.get(workflowField.optionSetId)` for the primary type, or union of workflow options across types. For Phase 1, use the option set of the first type's workflow field (the scheme shares one status set). Column `kind` drives tint via `kindColor`.
- Group items by `item.values[workflowField.key]` (option value string) instead of `ticket.values[statusField.key]` + `board.statuses`.
- `findFieldByPattern(board.fields, …)` for priority/assignee/due stays, but option rendering uses `indexes.optionsForField(item.typeId, field)`.
- `board.tickets` → `board.items`; `TypeBadge` label from `indexes.typeById.get(item.typeId)`.
- `StatusCell` (table): options from `legalStatusTargets(board, indexes, item, item.typeId)`, map to `{key: value, label, kind}`.

- [ ] **Step 2: Rewrite the kanban test** to the new board factory; assert columns render by option label + kind tint, items land in the right column by `values[status]`, and the type badge shows.

Run: `pnpm --filter @tickets/web test -- kanban-view.test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/
git commit -m "feat(web): board (kanban+table) over workflow options + kinds"
```

---

### Task 11: All-items, home, project-stats

**Files:**
- Rename+modify: `apps/web/src/components/all-tickets/all-tickets-screen.tsx` → `all-items-screen.tsx` (+ `columns-popover.tsx`, `global-filter-chips.tsx`, `shared-fields.ts`, `global-views.ts` under the folder)
- Modify: `apps/web/src/components/home/projects-home.tsx`, `apps/web/src/api/use-project-stats.ts`
- Rewrite: `all-tickets-screen.test.tsx` → `all-items-screen.test.tsx`
- Update routes: `routes/all-tickets-route.tsx` → `all-items-route.tsx`, and `router.ts`.

**Interfaces:** Consumes Task 2 indexes, Task 7 rendering.

- [ ] **Step 1: Substitutions**

- `board.tickets`→`board.items`; `TicketType`→`ItemType`; status via workflow option + `kind`.
- `use-project-stats.ts`: recompute open/active/done counts from `options.kind` on each item's workflow value (map item → workflow option → kind), not `board.statuses`. `done` = kind `done`|`dropped`; `active` = kind `active`; open = not done.
- Mutations (inline status edits in the table) via `usePatchItem` with the envelope.
- Copy: "All tickets"→"All items", etc.

- [ ] **Step 2: Rewrite the screen test** to the new factory + assert counts/rendering. Run: `pnpm --filter @tickets/web test -- all-items-screen`. Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/all-tickets/ apps/web/src/components/all-items* apps/web/src/components/home/ apps/web/src/api/use-project-stats.ts apps/web/src/routes/ apps/web/src/router.ts
git commit -m "feat(web): all-items + home + stats over the items model"
```

---

### Task 12: Terminology sweep + full green gate (deployable milestone)

**Files:** any remaining `apps/web/src` files with "ticket" in identifiers/copy; `apps/web/src/ui/ticket-key.tsx` → `item-key.tsx`; `use-board.ts` return type; `use-projects.ts`; remaining routes.

**Interfaces:** none new — this is the integration/cleanup task that restores full compilation.

- [ ] **Step 1: Sweep remaining renames**

Run: `pnpm --filter @tickets/web exec grep -rn "ticket\|Ticket\|BoardTicket\|statuses\|typeFields" src` and resolve every remaining reference: `useBoard` returns the new `Board`; `ticket-key.tsx`→`item-key.tsx` (prefix from `project.itemPrefix`); any lingering `board.statuses`/`board.typeFields`/`field.type==='status'`/`TicketX` types. Fix `use-board.ts`, `use-projects.ts`, `use-project-stats.ts`, `router.ts`, all `routes/*`.

- [ ] **Step 2: Restore full typecheck**

Run: `pnpm --filter @tickets/web typecheck`
Expected: **clean** (this is the first point the whole package compiles again).

- [ ] **Step 3: Full web test suite**

Run: `pnpm --filter @tickets/web test`
Expected: all green (updated component tests + the new util tests). Fix any stragglers.

- [ ] **Step 4: Build**

Run: `pnpm build` (or `pnpm --filter @tickets/web build`)
Expected: web builds (vite) with no type errors.

- [ ] **Step 5: Manual verification note (not a code step)**

Bring up the API on `tickets_platform` and load the web dev server against it; confirm the board loads real items, create/edit/comment/link work, the activity feed populates, and illegal status moves are blocked. Record the result. NEVER point at production `tickets`.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): terminology sweep + restore full typecheck/test/build (SP4a Phase 1 deployable)"
```

---

## Self-Review

**1. Spec coverage.** §1 data layer → Tasks 1–5 (types, index-board, legal-targets, apiMutate, hooks). §2 model mapping → Tasks 2/3/7 (workflow=option+kind, placements, optionSetId). §3 type-aware screens → Tasks 8 (create), 9 (detail+activity), 10 (board), 11 (all-items/home/stats). §4 testing → each task's vitest + Task 12 gate. §5 deployable milestone → Task 12. Admin deferral → Task 6 removes the Phase-2 surface. Terminology → Task 12 sweep + per-task copy. Transition-graph data caveat → Task 3/Task 9 use the "empty edge set ⇒ unrestricted" rule.

**2. Placeholder scan.** Foundation tasks (1–5) carry complete code. Consumer tasks (7–11) use precise substitution lists grounded in the exact old→new delta (named fields/branches), not vague "adapt the screen" instructions; each names its files, its exact renames, and updates its own test with concrete URL/body assertions. The one soft spot is that consumer tasks instruct "apply these substitutions" rather than dumping each 200–300-line component verbatim — deliberate, because the changes are systematic renames the digest fully enumerates and dumping whole components would bury the actual change. Each consumer task is still independently reviewable via its named vitest file.

**3. Type consistency.** `Board`/`Item`/`Option`/`Field`/`ItemTypeField`/`Transition` (Task 1) are used verbatim in Tasks 2–11. `BoardIndexes` methods (`workflowField`, `optionsForField`, `optionByValue`, `placementsByType`) defined in Task 2 are consumed in 3/7/8/9/10/11. `apiMutate` (Task 4) is used by every hook in Task 5. Hook names (`useCreateItem`, `usePatchItem`, `useItemActivity`) are consistent across screen tasks.

**Cross-task note for the executor:** the whole-package `typecheck` is RED from Task 1 until Task 12 by design — gate each task on its named vitest file(s), and treat Task 12 as the green-restoring integration gate. Run tasks in order (1→12): the shape (1), indexes (2), and legal-targets (3) are prerequisites for every screen; Task 6 (admin removal) must land before Task 12's typecheck can go green.
