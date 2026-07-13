# EER Real DB Modelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the field-level `role: 'pk'|'fk'|null` hint with a real relational schema — columns with `nullable`/`default`, table-level constraints (PK/FK/UNIQUE/CHECK, composite-capable), and indexes — with badges, edges and cardinality all *derived* from constraints, and a Postgres type picker instead of free text.

**Architecture:** Additive-then-remove, so every task ends green. First add the new shape alongside the old (T2), then move every consumer onto derived data (T3), then delete the old shape in one mechanical sweep (T4). Editor UI follows (T6–T8). The seed is rewritten last (T9), proving equivalence against the old file kept as a fixture.

**Tech Stack:** React 19 + reducer/context state, pure engine modules (one function per folder + `index.ts` + colocated `.test.ts`), vitest, Tailwind v4 (enforced boundary), Vite 8.

**Spec of record:** `docs/superpowers/specs/2026-07-13-eer-real-db-modelling-design.md`

## Global Constraints

- After EVERY task: `pnpm --filter @tickets/eer test` and `pnpm --filter @tickets/eer typecheck` pass (typecheck also runs `scripts/verify-tailwind.mjs`). Baseline at plan start: **326 tests**.
- Vitest has no `test` script alias for filtering — run a subset with `pnpm --filter @tickets/eer exec vitest run <path>`.
- Tailwind boundary (enforced): no arbitrary values (`w-[420px]`), no class string > 100 chars (split into grouped `cn()` args), no fractional spacing steps (`py-0.75`), style props may set only `--*` custom properties (via `src/ui/runtime-style.ts`), no DOM `.style` API. Use the vocabulary already in the components (gray/blue/red ramps — read `components/editor/*.tsx`; do NOT invent token names).
- Engine modules: one function per folder — `<name>/<name>.ts` + `index.ts` + `<name>.test.ts` — pure, no DOM.
- Conventional commits scoped `(eer)`, one commit per task. Never `git add -A` — add only the files the task names.
- NEVER save over `apps/eer/models/items-platform.json` via the running UI. If you smoke-test live, create a throwaway model and delete it; leave `git status` free of model-file changes.
- The dev server the user runs on :4630 predates the models API. To drive the app live, start your own: `EER_DEV_PORT=4631 pnpm --filter @tickets/eer dev` (background). Never kill the user's server.

---

### Task 1: `pg-types` — the type catalogue

**Files:**
- Create: `apps/eer/src/engine/model/pg-types/pg-types.ts`, `index.ts`
- Test: `apps/eer/src/engine/model/pg-types/pg-types.test.ts`

**Interfaces:**
- Produces:
```ts
export interface PgType { name: string; group: PgTypeGroup; params: 0 | 1 | 2 }
export type PgTypeGroup = 'numeric' | 'text' | 'temporal' | 'boolean' | 'uuid' | 'json' | 'binary';
export const PG_TYPES: PgType[];
export interface ParsedType { base: string; params: string[]; custom: boolean }
export function parseType(s: string): ParsedType;      // "varchar(255)" → {base:'varchar', params:['255'], custom:false}
export function formatType(base: string, params: string[]): string;  // ('numeric',['10','2']) → "numeric(10,2)"
```
Pure string ↔ struct; a base not in `PG_TYPES` parses as `{ base: s, params: [], custom: true }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { PG_TYPES, formatType, parseType } from './pg-types';

describe('pg-types', () => {
  it('lists known postgres types with their param arity', () => {
    const byName = new Map(PG_TYPES.map((t) => [t.name, t]));
    expect(byName.get('int')!.params).toBe(0);
    expect(byName.get('varchar')!.params).toBe(1);
    expect(byName.get('numeric')!.params).toBe(2);
    expect(byName.get('timestamptz')!.group).toBe('temporal');
    expect(byName.get('jsonb')!.group).toBe('json');
  });

  it('parses a plain type', () => {
    expect(parseType('int')).toEqual({ base: 'int', params: [], custom: false });
  });

  it('parses parameterised types', () => {
    expect(parseType('varchar(255)')).toEqual({ base: 'varchar', params: ['255'], custom: false });
    expect(parseType('numeric(10,2)')).toEqual({ base: 'numeric', params: ['10', '2'], custom: false });
    expect(parseType('numeric( 10 , 2 )')).toEqual({ base: 'numeric', params: ['10', '2'], custom: false });
  });

  it('flags an unknown type as custom, keeping it verbatim', () => {
    expect(parseType('citext')).toEqual({ base: 'citext', params: [], custom: true });
    expect(parseType('my_enum')).toEqual({ base: 'my_enum', params: [], custom: true });
  });

  it('formats back, dropping empty params', () => {
    expect(formatType('int', [])).toBe('int');
    expect(formatType('varchar', ['255'])).toBe('varchar(255)');
    expect(formatType('numeric', ['10', '2'])).toBe('numeric(10,2)');
    expect(formatType('varchar', [''])).toBe('varchar');
  });

  it('roundtrips every catalogue type', () => {
    for (const t of PG_TYPES) {
      const params = t.params === 0 ? [] : t.params === 1 ? ['8'] : ['8', '2'];
      const s = formatType(t.name, params);
      const back = parseType(s);
      expect(back.base, s).toBe(t.name);
      expect(back.params, s).toEqual(params);
      expect(back.custom, s).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module './pg-types'`)

Run: `pnpm --filter @tickets/eer exec vitest run src/engine/model/pg-types`

- [ ] **Step 3: Implement**

`pg-types.ts`:

```ts
// The Postgres type catalogue the editor's type picker offers, plus the string
// <-> (base, params) codec. Types are STORED as plain strings ("varchar(255)"),
// so hand-written files and custom types (enums, domains, citext) keep working —
// they simply parse as `custom` and render in the picker's free-text escape hatch.

export type PgTypeGroup = 'numeric' | 'text' | 'temporal' | 'boolean' | 'uuid' | 'json' | 'binary';

export interface PgType {
  name: string;
  group: PgTypeGroup;
  params: 0 | 1 | 2; // varchar(n) = 1, numeric(p,s) = 2
}

export const PG_TYPES: PgType[] = [
  { name: 'smallint', group: 'numeric', params: 0 },
  { name: 'int', group: 'numeric', params: 0 },
  { name: 'bigint', group: 'numeric', params: 0 },
  { name: 'serial', group: 'numeric', params: 0 },
  { name: 'bigserial', group: 'numeric', params: 0 },
  { name: 'numeric', group: 'numeric', params: 2 },
  { name: 'real', group: 'numeric', params: 0 },
  { name: 'double precision', group: 'numeric', params: 0 },
  { name: 'text', group: 'text', params: 0 },
  { name: 'varchar', group: 'text', params: 1 },
  { name: 'char', group: 'text', params: 1 },
  { name: 'boolean', group: 'boolean', params: 0 },
  { name: 'timestamptz', group: 'temporal', params: 0 },
  { name: 'timestamp', group: 'temporal', params: 0 },
  { name: 'date', group: 'temporal', params: 0 },
  { name: 'time', group: 'temporal', params: 0 },
  { name: 'interval', group: 'temporal', params: 0 },
  { name: 'uuid', group: 'uuid', params: 0 },
  { name: 'json', group: 'json', params: 0 },
  { name: 'jsonb', group: 'json', params: 0 },
  { name: 'bytea', group: 'binary', params: 0 },
];

const BY_NAME = new Map(PG_TYPES.map((t) => [t.name, t]));

export interface ParsedType {
  base: string;
  params: string[];
  custom: boolean; // base is not in the catalogue — keep the string verbatim
}

export function parseType(s: string): ParsedType {
  const text = s.trim();
  const open = text.indexOf('(');
  if (open === -1 || !text.endsWith(')')) {
    return { base: text, params: [], custom: !BY_NAME.has(text) };
  }
  const base = text.slice(0, open).trim();
  const params = text
    .slice(open + 1, -1)
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return { base, params, custom: !BY_NAME.has(base) };
}

export function formatType(base: string, params: string[]): string {
  const kept = params.map((p) => p.trim()).filter((p) => p.length > 0);
  return kept.length ? `${base}(${kept.join(',')})` : base;
}
```

`index.ts`: `export * from './pg-types';`

- [ ] **Step 4: Run tests — PASS.** Then full suite + typecheck.

Run: `pnpm --filter @tickets/eer test && pnpm --filter @tickets/eer typecheck`
Expected: 332 passing (326 + 6), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/pg-types
git commit -m "feat(eer): pg-types catalogue + type string codec"
```

---

### Task 2: Model shape — columns gain `nullable`/`default`; entities gain `constraints`/`indexes`; loader normalises legacy

**Files:**
- Modify: `apps/eer/src/engine/model/types/types.ts`
- Modify: `apps/eer/src/engine/model/load-model/load-model.ts`
- Test: `apps/eer/src/engine/model/load-model/load-model.test.ts`

**Interfaces:**
- Produces (in `types.ts`):
```ts
export type FkAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';
export type Constraint =
  | { id: string; kind: 'pk'; name: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name: string | null; columns: string[] }
  | { id: string; kind: 'check'; name: string | null; expression: string }
  | { id: string; kind: 'fk'; name: string | null; columns: string[]; refTable: string;
      refColumns: string[]; onDelete: FkAction | null; onUpdate: FkAction | null };
export interface TableIndex { id: string; name: string; columns: string[]; unique: boolean }
```
  `Field` gains `nullable: boolean` and `default: string | null`. `Entity` gains
  `constraints: Constraint[]` and `indexes: TableIndex[]`.
  **`Field.role`/`ref`/`refField` and `Entity.fields` STAY for now** — Task 4 removes them. This
  keeps every existing consumer compiling and every test green.
- Legacy normalisation in `loadModel` (runs when an entity has no `constraints` key):
  - one `{kind:'pk'}` constraint from all fields with `role === 'pk'` (declaration order), id `c1`
  - one `{kind:'fk'}` per field with a `ref` (regardless of role — the seed's `outbox.event_id` is
    role `pk` WITH a ref), `columns:[f.name]`, `refColumns:[f.refField ?? 'id']`, ids `c2`, `c3`, …
  - `nullable` defaults `true`, `default` defaults `null`
  - When an entity DOES carry `constraints`, they are read verbatim (validated: ids unique per
    table, generated `c<n>` when missing).

- [ ] **Step 1: Write the failing tests** (append to `load-model.test.ts`)

```ts
it('synthesises constraints from legacy role/ref fields', () => {
  const raw = {
    groups: [{ id: 'z', label: 'Z' }],
    entities: [
      { id: 'users', group: 'z', fields: [{ name: 'id', type: 'serial', role: 'pk' }] },
      {
        id: 'orders',
        group: 'z',
        fields: [
          { name: 'id', type: 'serial', role: 'pk' },
          { name: 'user_id', type: 'int', role: 'fk', ref: 'users', refField: 'id' },
        ],
      },
    ],
  };
  const { model, errors } = loadModel(raw);
  expect(errors).toEqual([]);
  const orders = model!.entityById.get('orders')!;
  expect(orders.constraints).toEqual([
    { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
    {
      id: 'c2', kind: 'fk', name: null, columns: ['user_id'],
      refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null,
    },
  ]);
  expect(orders.indexes).toEqual([]);
  expect(orders.fields[1]!.nullable).toBe(true);
  expect(orders.fields[1]!.default).toBeNull();
});

it('treats a ref on a non-fk field as a foreign key (shared-pk reference)', () => {
  const raw = {
    groups: [{ id: 'z', label: 'Z' }],
    entities: [
      { id: 'events', group: 'z', fields: [{ name: 'id', type: 'bigserial', role: 'pk' }] },
      {
        id: 'outbox', group: 'z',
        fields: [{ name: 'event_id', type: 'bigint', role: 'pk', ref: 'events', refField: 'id' }],
      },
    ],
  };
  const outbox = loadModel(raw).model!.entityById.get('outbox')!;
  expect(outbox.constraints).toEqual([
    { id: 'c1', kind: 'pk', name: null, columns: ['event_id'] },
    {
      id: 'c2', kind: 'fk', name: null, columns: ['event_id'],
      refTable: 'events', refColumns: ['id'], onDelete: null, onUpdate: null,
    },
  ]);
});

it('reads explicit constraints, indexes, nullable and default verbatim', () => {
  const raw = {
    groups: [{ id: 'z', label: 'Z' }],
    entities: [
      { id: 'a', group: 'z', fields: [{ name: 'id', type: 'int' }] },
      {
        id: 'items', group: 'z',
        fields: [
          { name: 'id', type: 'bigserial', nullable: false },
          { name: 'a_id', type: 'int', nullable: false },
          { name: 'key', type: 'text', default: "'draft'" },
        ],
        constraints: [
          { id: 'c1', kind: 'pk', columns: ['id'] },
          { id: 'c2', kind: 'unique', name: 'items_a_key', columns: ['a_id', 'key'] },
          { id: 'c3', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'], onDelete: 'cascade' },
          { id: 'c4', kind: 'check', expression: 'char_length(key) > 0' },
        ],
        indexes: [{ id: 'i1', name: 'idx_items_a', columns: ['a_id'], unique: false }],
      },
    ],
  };
  const { model, errors } = loadModel(raw);
  expect(errors).toEqual([]);
  const items = model!.entityById.get('items')!;
  expect(items.constraints).toHaveLength(4);
  expect(items.constraints[1]).toEqual({ id: 'c2', kind: 'unique', name: 'items_a_key', columns: ['a_id', 'key'] });
  expect(items.constraints[2]).toEqual({
    id: 'c3', kind: 'fk', name: null, columns: ['a_id'],
    refTable: 'a', refColumns: ['id'], onDelete: 'cascade', onUpdate: null,
  });
  expect(items.constraints[3]).toEqual({ id: 'c4', kind: 'check', name: null, expression: 'char_length(key) > 0' });
  expect(items.indexes).toEqual([{ id: 'i1', name: 'idx_items_a', columns: ['a_id'], unique: false }]);
  expect(items.fields[0]!.nullable).toBe(false);
  expect(items.fields[2]!.default).toBe("'draft'");
});
```

- [ ] **Step 2: Run — expect FAIL** (`constraints` is not on Entity).

- [ ] **Step 3: Implement.** In `types.ts` add the three exported types above; add `nullable: boolean` + `default: string | null` to `Field`; add `constraints: Constraint[]` + `indexes: TableIndex[]` to `Entity`. In `load-model.ts`, inside the entity normalisation, after `fields` are built, add:

```ts
    const rawConstraints = Array.isArray(e.constraints) ? e.constraints : null;
    const constraints: Constraint[] = rawConstraints
      ? rawConstraints.map((c: any, ci: number) => normalizeConstraint(c, ci, e.id, errors))
      : synthesizeLegacyConstraints(fields);
    const indexes: TableIndex[] = (Array.isArray(e.indexes) ? e.indexes : []).map((ix: any, ii: number) => ({
      id: typeof ix.id === 'string' && ix.id ? ix.id : 'i' + (ii + 1),
      name: typeof ix.name === 'string' ? ix.name : '',
      columns: Array.isArray(ix.columns) ? ix.columns.filter((c: unknown) => typeof c === 'string') : [],
      unique: ix.unique === true,
    }));
```

and include `constraints, indexes` in the entity literal. Then these two helpers (module scope):

```ts
const FK_ACTIONS: FkAction[] = ['cascade', 'restrict', 'set null', 'set default', 'no action'];

function fkAction(v: unknown): FkAction | null {
  return typeof v === 'string' && FK_ACTIONS.includes(v as FkAction) ? (v as FkAction) : null;
}

function normalizeConstraint(c: any, i: number, entityId: string, errors: string[]): Constraint {
  const id = typeof c.id === 'string' && c.id ? c.id : 'c' + (i + 1);
  const name = typeof c.name === 'string' && c.name ? c.name : null;
  const columns: string[] = Array.isArray(c.columns) ? c.columns.filter((x: unknown) => typeof x === 'string') : [];
  if (c.kind === 'check') return { id, kind: 'check', name, expression: typeof c.expression === 'string' ? c.expression : '' };
  if (c.kind === 'fk') {
    if (typeof c.refTable !== 'string') errors.push(`Entity "${entityId}" constraint "${id}" is missing "refTable".`);
    const refColumns: string[] = Array.isArray(c.refColumns)
      ? c.refColumns.filter((x: unknown) => typeof x === 'string')
      : [];
    return {
      id, kind: 'fk', name, columns,
      refTable: typeof c.refTable === 'string' ? c.refTable : '',
      refColumns, onDelete: fkAction(c.onDelete), onUpdate: fkAction(c.onUpdate),
    };
  }
  if (c.kind === 'unique') return { id, kind: 'unique', name, columns };
  return { id, kind: 'pk', name, columns };
}

// Legacy files describe keys with per-field roles. One PK from every role:'pk'
// field, and one FK per field carrying a ref — regardless of role, because a
// shared-primary-key reference is role 'pk' AND a ref.
function synthesizeLegacyConstraints(fields: Field[]): Constraint[] {
  const out: Constraint[] = [];
  const pkCols = fields.filter((f) => f.role === 'pk').map((f) => f.name);
  let n = 1;
  if (pkCols.length) out.push({ id: 'c' + n++, kind: 'pk', name: null, columns: pkCols });
  for (const f of fields) {
    if (!f.ref) continue;
    out.push({
      id: 'c' + n++, kind: 'fk', name: null, columns: [f.name],
      refTable: f.ref, refColumns: [f.refField ?? 'id'], onDelete: null, onUpdate: null,
    });
  }
  return out;
}
```

Also parse `nullable` / `default` per field: `nullable: f.nullable !== false`, `default: typeof f.default === 'string' ? f.default : null`.

- [ ] **Step 4: Run tests — the 3 new + all existing PASS.** Full suite + typecheck.

Expected: 335 passing (332 + 3).

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/types apps/eer/src/engine/model/load-model
git commit -m "feat(eer): entities carry constraints + indexes; loader synthesises them from legacy roles"
```

---

### Task 3: Derived badges + derived edges (constraints become the source of truth)

**Files:**
- Create: `apps/eer/src/engine/model/column-roles/column-roles.ts`, `index.ts`, `column-roles.test.ts`
- Create: `apps/eer/src/engine/model/derive-relationships/derive-relationships.ts`, `index.ts`, `derive-relationships.test.ts`
- Modify: `apps/eer/src/engine/model/load-model/load-model.ts` (use the new derivation)
- Modify: `apps/eer/src/engine/model/apply-model-edit/apply-model-edit.ts` (use the new derivation)
- Modify: `apps/eer/src/components/diagram/entity-cards/field-row.tsx`, `apps/eer/src/components/detail-panel/role-tag.tsx`, `apps/eer/src/components/detail-panel/entity-detail.tsx`, `apps/eer/src/engine/geometry/measure-entity/measure-entity.ts`
- Test: the four modified modules' existing test files

**Interfaces:**
- Produces:
```ts
export interface ColumnRole { pk: boolean; fk: boolean; unique: boolean }
export function columnRoles(entity: Entity): Map<string, ColumnRole>;
export function deriveRelationships(model: Model): Relationship[];
```
- `deriveRelationships(model)`: one relationship per FK constraint —
  `id: 'rel:' + entity.id + ':' + constraint.id`, `source: c.refTable`, `sourceField: c.refColumns[0]`,
  `target: entity.id`, `targetField: c.columns[0]`, `kind: 'fk'`, `label: null`,
  cardinality `'1-1'` when the FK's columns are exactly the table's PK columns or exactly a UNIQUE
  constraint's columns (set-equal), else `'1-n'`; `cardinalityInferred: true`.
  Skipped (not derived) when `refTable` is unknown or any `refColumns` name is absent on the target.
  Explicit `model.relationships` whose `kind !== 'fk'` are kept and returned FIRST, then the derived
  ones; an explicit rel duplicating a derived endpoint pair (unordered `(source,sourceField)` ×
  `(target,targetField)`) is dropped in favour of the derived one.
- `columnRoles(entity)`: `pk` = column appears in the entity's PK constraint; `fk` = appears in any
  FK constraint's `columns`; `unique` = sole column of a UNIQUE constraint OR sole column of the PK.

- [ ] **Step 1: Write the failing tests**

`column-roles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { Entity } from '../types';
import { columnRoles } from './column-roles';

const entity = (constraints: Entity['constraints']): Entity =>
  ({
    id: 't', label: 't', group: 'z', description: null,
    fields: [
      { name: 'a', type: 'int', role: null, ref: null, refField: null, title: null, description: null, nullable: false, default: null },
      { name: 'b', type: 'int', role: null, ref: null, refField: null, title: null, description: null, nullable: false, default: null },
      { name: 'c', type: 'int', role: null, ref: null, refField: null, title: null, description: null, nullable: true, default: null },
    ],
    constraints, indexes: [], x: 0, y: 0, _w: 0, _h: 0,
  }) as Entity;

describe('columnRoles', () => {
  it('marks pk columns from the pk constraint, composite included', () => {
    const roles = columnRoles(entity([{ id: 'c1', kind: 'pk', name: null, columns: ['a', 'b'] }]));
    expect(roles.get('a')!.pk).toBe(true);
    expect(roles.get('b')!.pk).toBe(true);
    expect(roles.get('c')!.pk).toBe(false);
  });

  it('marks fk columns from every fk constraint', () => {
    const roles = columnRoles(
      entity([
        { id: 'c1', kind: 'fk', name: null, columns: ['b'], refTable: 'o', refColumns: ['id'], onDelete: null, onUpdate: null },
        { id: 'c2', kind: 'fk', name: null, columns: ['c'], refTable: 'p', refColumns: ['id'], onDelete: null, onUpdate: null },
      ]),
    );
    expect(roles.get('b')!.fk).toBe(true);
    expect(roles.get('c')!.fk).toBe(true);
    expect(roles.get('a')!.fk).toBe(false);
  });

  it('a single-column pk and a single-column unique are both unique; a composite is not', () => {
    const roles = columnRoles(
      entity([
        { id: 'c1', kind: 'pk', name: null, columns: ['a'] },
        { id: 'c2', kind: 'unique', name: null, columns: ['b'] },
        { id: 'c3', kind: 'unique', name: null, columns: ['b', 'c'] },
      ]),
    );
    expect(roles.get('a')!.unique).toBe(true);
    expect(roles.get('b')!.unique).toBe(true);
    expect(roles.get('c')!.unique).toBe(false);
  });

  it('a column may be both pk and fk (shared-primary-key reference)', () => {
    const roles = columnRoles(
      entity([
        { id: 'c1', kind: 'pk', name: null, columns: ['a'] },
        { id: 'c2', kind: 'fk', name: null, columns: ['a'], refTable: 'o', refColumns: ['id'], onDelete: null, onUpdate: null },
      ]),
    );
    expect(roles.get('a')).toEqual({ pk: true, fk: true, unique: true });
  });
});
```

`derive-relationships.test.ts` — build models with `loadModel` on raw objects that carry explicit `constraints` (Task 2 reads them), then assert:

```ts
import { describe, expect, it } from 'vitest';

import { loadModel } from '../load-model';
import { deriveRelationships } from './derive-relationships';

const raw = (constraints: unknown[], extra: Record<string, unknown> = {}) => ({
  groups: [{ id: 'z', label: 'Z' }],
  entities: [
    { id: 'users', group: 'z', fields: [{ name: 'id', type: 'serial' }], constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }] },
    {
      id: 'orders', group: 'z',
      fields: [{ name: 'id', type: 'serial' }, { name: 'user_id', type: 'int' }],
      constraints,
    },
  ],
  ...extra,
});

describe('deriveRelationships', () => {
  it('derives one 1-n edge per fk constraint, ided by entity + constraint', () => {
    const model = loadModel(raw([
      { id: 'c1', kind: 'pk', columns: ['id'] },
      { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
    ])).model!;
    const rels = deriveRelationships(model);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({
      id: 'rel:orders:c2', source: 'users', sourceField: 'id',
      target: 'orders', targetField: 'user_id', kind: 'fk', cardinality: '1-n',
    });
  });

  it('is 1-1 when the fk columns are the referencing table’s primary key', () => {
    const model = loadModel(raw([
      { id: 'c1', kind: 'pk', columns: ['user_id'] },
      { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
    ])).model!;
    expect(deriveRelationships(model)[0]!.cardinality).toBe('1-1');
  });

  it('is 1-1 when the fk columns are covered by a unique constraint', () => {
    const model = loadModel(raw([
      { id: 'c1', kind: 'pk', columns: ['id'] },
      { id: 'c2', kind: 'unique', columns: ['user_id'] },
      { id: 'c3', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
    ])).model!;
    expect(deriveRelationships(model).find((r) => r.id === 'rel:orders:c3')!.cardinality).toBe('1-1');
  });

  it('anchors a composite fk on its lead column pair', () => {
    const model = loadModel({
      groups: [{ id: 'z', label: 'Z' }],
      entities: [
        {
          id: 'a', group: 'z', fields: [{ name: 'k1', type: 'int' }, { name: 'k2', type: 'int' }],
          constraints: [{ id: 'c1', kind: 'pk', columns: ['k1', 'k2'] }],
        },
        {
          id: 'b', group: 'z', fields: [{ name: 'a1', type: 'int' }, { name: 'a2', type: 'int' }],
          constraints: [{ id: 'c1', kind: 'fk', columns: ['a1', 'a2'], refTable: 'a', refColumns: ['k1', 'k2'] }],
        },
      ],
    }).model!;
    const rels = deriveRelationships(model);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({ source: 'a', sourceField: 'k1', target: 'b', targetField: 'a1' });
  });

  it('skips an fk whose target table or column does not exist', () => {
    const model = loadModel(raw([
      { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'nope', refColumns: ['id'] },
      { id: 'c3', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['nope'] },
    ])).model!;
    expect(deriveRelationships(model)).toEqual([]);
  });

  it('keeps a non-fk authored relationship and puts it first', () => {
    const model = loadModel(
      raw(
        [{ id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] }],
        {
          kinds: [{ id: 'nm', label: 'Many-to-many', style: 'dashed' }],
          relationships: [
            { id: 'doc', source: 'users', sourceField: 'id', target: 'orders', targetField: 'id',
              kind: 'nm', label: 'documented', cardinality: 'n-m' },
          ],
        },
      ),
    ).model!;
    const rels = deriveRelationships(model);
    expect(rels.map((r) => r.id)).toEqual(['doc', 'rel:orders:c2']);
    expect(rels[0]!.label).toBe('documented');
  });
});
```

- [ ] **Step 2: Run both — expect FAIL** (modules missing).

- [ ] **Step 3: Implement**

`column-roles.ts`:

```ts
// What a column IS, derived from the table's constraints — the diagram's PK/FK
// badges and colours read this instead of a stored `role`, so they can never
// disagree with the schema.

import type { Entity } from '../types';

export interface ColumnRole {
  pk: boolean;
  fk: boolean;
  unique: boolean;
}

export function columnRoles(entity: Entity): Map<string, ColumnRole> {
  const roles = new Map<string, ColumnRole>();
  for (const f of entity.fields) roles.set(f.name, { pk: false, fk: false, unique: false });

  for (const c of entity.constraints) {
    if (c.kind === 'pk') {
      for (const name of c.columns) {
        const r = roles.get(name);
        if (r) {
          r.pk = true;
          if (c.columns.length === 1) r.unique = true; // a single-column pk is unique by definition
        }
      }
    } else if (c.kind === 'fk') {
      for (const name of c.columns) {
        const r = roles.get(name);
        if (r) r.fk = true;
      }
    } else if (c.kind === 'unique' && c.columns.length === 1) {
      const r = roles.get(c.columns[0]!);
      if (r) r.unique = true;
    }
  }
  return roles;
}
```

`derive-relationships.ts`:

```ts
// Relationships ARE the foreign keys. One edge per FK constraint, with a stable
// id built from the owning entity and constraint, so renames never orphan an
// edge and nothing has to guess which edges were "derived" vs authored.
// Authored non-fk relationships (n-m documentation edges) are kept verbatim.

import { columnRoles } from '../column-roles';
import type { Cardinality, Entity, Model, Relationship } from '../types';

const pairKey = (r: { source: string; sourceField: string; target: string; targetField: string }): string =>
  [`${r.source}.${r.sourceField}`, `${r.target}.${r.targetField}`].sort().join('|');

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// 1-1 when each parent row can match at most one child row: the child's fk
// columns are its whole primary key, or are covered by a unique constraint.
function cardinalityOf(entity: Entity, columns: string[]): Cardinality {
  for (const c of entity.constraints) {
    if ((c.kind === 'pk' || c.kind === 'unique') && sameSet(c.columns, columns)) return '1-1';
  }
  return '1-n';
}

export function deriveRelationships(model: Model): Relationship[] {
  const derived: Relationship[] = [];
  for (const e of model.entities) {
    for (const c of e.constraints) {
      if (c.kind !== 'fk') continue;
      const target = model.entityById.get(c.refTable);
      if (!target) continue;
      const names = new Set(target.fields.map((f) => f.name));
      if (!c.refColumns.length || !c.columns.length) continue;
      if (!c.refColumns.every((n) => names.has(n))) continue;
      derived.push({
        id: `rel:${e.id}:${c.id}`,
        source: c.refTable,
        sourceField: c.refColumns[0]!,
        target: e.id,
        targetField: c.columns[0]!,
        cardinality: cardinalityOf(e, c.columns),
        cardinalityInferred: true,
        kind: 'fk',
        label: null,
      });
    }
  }

  const derivedPairs = new Set(derived.map(pairKey));
  const authored = model.relationships.filter(
    (r) =>
      r.kind !== 'fk' &&
      model.entityById.has(r.source) &&
      model.entityById.has(r.target) &&
      !derivedPairs.has(pairKey(r)),
  );
  return [...authored, ...derived];
}
```

Note: `derive-relationships.ts` does NOT import `columnRoles` — the cardinality rule reads
constraints directly. Do not add an unused import; TS `noUnusedLocals` fails the build.

`index.ts` for both folders (`export * from './<name>';`).

Wire it in:
- `load-model.ts`: after entities are normalised and `entityById` built, replace the existing
  relationship assembly with `relationships = deriveRelationships({ ...partialModel })` — the
  authored list must already be normalised at that point (ids, cardinality). Keep the existing
  per-relationship validation warnings for authored rels.
- `apply-model-edit.ts`: replace its private `deriveRelationships` with an import of this module,
  and delete `is-derivable-shaped` usage from it (the module itself is deleted in Task 4).

Switch the renderers to derived roles:
- `measure-entity.ts`, `field-row.tsx`, `role-tag.tsx`, `entity-detail.tsx`: compute
  `const roles = columnRoles(entity)` once per entity and read `roles.get(f.name)` instead of
  `f.role`. Badge text: `pk` → `PK`, else `fk` → `FK`, else none. Keep every existing class name so
  the rendered output is unchanged (yellow PK, green FK).

- [ ] **Step 4: Run the full suite.** Existing tests that assert PK/FK badges must STILL PASS
      unchanged — that is the proof the visual language survived. Fix any test that referenced
      `f.role` **only** by switching it to constraints in the fixture (do NOT weaken an assertion).

Run: `pnpm --filter @tickets/eer test && pnpm --filter @tickets/eer typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/column-roles apps/eer/src/engine/model/derive-relationships \
        apps/eer/src/engine/model/load-model apps/eer/src/engine/model/apply-model-edit \
        apps/eer/src/engine/geometry/measure-entity apps/eer/src/components/diagram/entity-cards \
        apps/eer/src/components/detail-panel
git commit -m "feat(eer): badges and edges derive from constraints, not field roles"
```

---

### Task 4: Delete `role`/`ref`/`refField`; rename `fields` → `columns`

**Files:**
- Modify: `apps/eer/src/engine/model/types/types.ts` (drop `Role`, `Field.role|ref|refField`; rename `Field` → `Column`, `Entity.fields` → `Entity.columns`)
- Delete: `apps/eer/src/engine/model/is-derivable-shaped/` (whole folder), `apps/eer/src/engine/model/infer-cardinality/` (whole folder — its role table is dead; `CARDINALITIES` moves to `types.ts` as `export const CARDINALITIES`)
- Modify (mechanical): `load-model.ts`, `serialize-model.ts`, `apply-model-edit.ts`, `run-checks.ts`, `field-index.ts`, `measure-entity.ts`, `search-model.ts`, `column-roles.ts`, `derive-relationships.ts`, `entity-detail.tsx`, `group-detail.tsx`, `entity-card.tsx`, `field-grid.tsx`, `table-modal.tsx`, `role-tag.tsx`, `field-row.tsx`, `src/test/models.ts`
- Test: every touched test file

**`serialize-model.ts` is NOT merely mechanical here — it must now emit the new shape:** per entity,
`columns` (each with `name`, `type`, and `nullable: false` / `default` / `title` / `description` only
when non-default), `constraints` (verbatim, minus `null` names/actions), `indexes` (verbatim), and
NO `role` / `ref` / `refField`. It must also STOP emitting FK-derived relationships (they are
regenerated from constraints on load) while still emitting authored non-fk ones. Extend its existing
roundtrip test to cover constraints + indexes + nullable + default.

**Interfaces:**
- Produces: `Column` (was `Field`, minus role/ref/refField, plus nullable/default), `Entity.columns`.
  `SearchResult.field` KEEPS its name (it means "the column name that matched") — do not rename it.
  `Relationship.sourceField` / `targetField` KEEP their names (they name a column).
- Consumes: Task 3's `columnRoles` / `deriveRelationships` (already in place, so nothing depends on
  `role` any more — this task is a pure removal).

- [ ] **Step 1: Delete the dead modules and the dead fields**

```bash
git rm -r apps/eer/src/engine/model/is-derivable-shaped apps/eer/src/engine/model/infer-cardinality
```

In `types.ts`: delete `export type Role`; rename `interface Field` → `interface Column` (dropping
`role`, `ref`, `refField`); `Entity.fields: Field[]` → `Entity.columns: Column[]`; add
`export const CARDINALITIES: Cardinality[] = ['1-1', '1-n', 'n-1', 'n-m'];`

- [ ] **Step 2: Run typecheck to enumerate the breakage**

Run: `pnpm --filter @tickets/eer typecheck`
Expected: a list of ~30 errors across the files above. Work the list top to bottom — every fix is
mechanical (`.fields` → `.columns`, drop `role:`/`ref:`/`refField:` from fixtures, `Field` →
`Column`). In `load-model.ts`, the legacy normaliser still READS raw `role`/`ref`/`refField` off the
JSON (that is the whole point of Task 2's `synthesizeLegacyConstraints`) — it just no longer stores
them on the `Column`. `field-grid.tsx` / `table-modal.tsx` lose their Role / Ref-table / Ref-field
cells here (they are rebuilt properly in Task 6) — the fastest correct move is to delete those three
cells and the `EditField.role|ref|refField` members, leaving the grid with name/type/note.

- [ ] **Step 3: Run the full suite; fix fixtures**

`src/test/models.ts` exports `pkField` and `fkTo(...)` used by many tests. Replace them with
constraint-shaped helpers, keeping the same names so call sites stay put:

```ts
export const pkField = { name: 'id', type: 'int' };
export const fkTo = (ref: string, name = ref + '_id') => ({ name, type: 'int' });
// and add to each fixture entity a `constraints` array, e.g.
//   constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] },
//                 { id: 'c2', kind: 'fk', columns: ['users_id'], refTable: 'users', refColumns: ['id'] }]
```

Because `loadModel` still synthesises constraints from legacy `role`/`ref` keys (Task 2), an even
smaller change works: leave `pkField`/`fkTo` emitting `role`/`ref` in the RAW fixture objects (they
are raw JSON, not `Column`s) and let the loader convert them. **Prefer this** — it keeps the diff
small and simultaneously exercises the legacy path on every test run.

- [ ] **Step 4: Full suite + typecheck green.**

- [ ] **Step 5: Commit**

```bash
git add -u apps/eer/src
git commit -m "refactor(eer): drop field roles and refs; entities have columns"
```

---

### Task 5: Constraint validation + the FK self-check

**Files:**
- Modify: `apps/eer/src/engine/model/apply-model-edit/apply-model-edit.ts`
- Modify: `apps/eer/src/engine/checks/run-checks/run-checks.ts`
- Test: their existing test files

**Interfaces:**
- Produces: `applyModelEdit` throws `Error` (reducer catches → `ui.editError`) for each rule below.
  `EditEntity` (the payload of `upsertEntity`) becomes:
```ts
export interface EditColumn { name: string; type: string; nullable: boolean; default: string | null;
                              title: string | null; description: string | null }
export interface EditEntity { id: string; label: string; group: string; description: string | null;
                              columns: EditColumn[]; constraints: Constraint[]; indexes: TableIndex[] }
export type ModelEdit = … | { kind: 'upsertEntity'; entity: EditEntity } | …
```
  `fkRefsTo(model, entityId)` now reports FK **constraints** pointing at the entity:
  `{ entityId: string; constraintId: string; columns: string[] }[]`.

- [ ] **Step 1: Failing tests** (`apply-model-edit.test.ts`), one per rule:

```ts
const base = () => buildModel();               // fixture model: users(id pk), orders(id pk, users_id fk→users.id), tags(id pk)
const edit = (over: Partial<EditEntity>): ModelEdit => ({
  kind: 'upsertEntity',
  entity: {
    id: 'orders', label: 'orders', group: 'z2', description: null,
    columns: [
      { name: 'id', type: 'int', nullable: false, default: null, title: null, description: null },
      { name: 'users_id', type: 'int', nullable: true, default: null, title: null, description: null },
    ],
    constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }],
    indexes: [],
    ...over,
  } as EditEntity,
});

it('rejects duplicate column names', () => {
  expect(() => applyModelEdit(base(), edit({
    columns: [
      { name: 'id', type: 'int', nullable: false, default: null, title: null, description: null },
      { name: 'id', type: 'int', nullable: false, default: null, title: null, description: null },
    ],
  }))).toThrow(/Duplicate column name "id"/);
});

it('rejects a second primary key', () => {
  expect(() => applyModelEdit(base(), edit({
    constraints: [
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
      { id: 'c2', kind: 'pk', name: null, columns: ['users_id'] },
    ],
  }))).toThrow(/one primary key/i);
});

it('rejects a constraint naming a column the table does not have', () => {
  expect(() => applyModelEdit(base(), edit({
    constraints: [{ id: 'c1', kind: 'pk', name: null, columns: ['nope'] }],
  }))).toThrow(/unknown column "nope"/i);
});

it('rejects an empty column list', () => {
  expect(() => applyModelEdit(base(), edit({
    constraints: [{ id: 'c1', kind: 'unique', name: null, columns: [] }],
  }))).toThrow(/at least one column/i);
});

it('rejects an fk to an unknown table or column, and an arity mismatch', () => {
  const fk = (over: Record<string, unknown>) =>
    edit({ constraints: [{ id: 'c1', kind: 'fk', name: null, columns: ['users_id'],
                           refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null, ...over } as Constraint] });
  expect(() => applyModelEdit(base(), fk({ refTable: 'nope' }))).toThrow(/unknown table "nope"/i);
  expect(() => applyModelEdit(base(), fk({ refColumns: ['nope'] }))).toThrow(/unknown column "nope"/i);
  expect(() => applyModelEdit(base(), fk({ columns: ['id', 'users_id'] }))).toThrow(/same number of columns/i);
});

it('rejects an empty check expression and duplicate constraint/index names', () => {
  expect(() => applyModelEdit(base(), edit({
    constraints: [{ id: 'c1', kind: 'check', name: null, expression: '  ' }],
  }))).toThrow(/expression/i);
  expect(() => applyModelEdit(base(), edit({
    constraints: [
      { id: 'c1', kind: 'unique', name: 'dup', columns: ['id'] },
      { id: 'c2', kind: 'unique', name: 'dup', columns: ['users_id'] },
    ],
  }))).toThrow(/Duplicate constraint name "dup"/);
  expect(() => applyModelEdit(base(), edit({
    indexes: [
      { id: 'i1', name: 'dup', columns: ['id'], unique: false },
      { id: 'i2', name: 'dup', columns: ['users_id'], unique: false },
    ],
  }))).toThrow(/Duplicate index name "dup"/);
});

it('accepts a valid composite fk with actions', () => {
  const next = applyModelEdit(base(), edit({
    constraints: [
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
      { id: 'c2', kind: 'fk', name: 'orders_user_fk', columns: ['users_id'], refTable: 'users',
        refColumns: ['id'], onDelete: 'cascade', onUpdate: null },
    ],
  }));
  expect(next.relationships.some((r) => r.id === 'rel:orders:c2')).toBe(true);
});
```

`run-checks.test.ts`:

```ts
it('flags a foreign key whose target columns are not a primary key or unique', () => {
  // orders.users_id → users.name, where users.name has no pk/unique constraint
  const model = buildModel({
    groups: [{ id: 'z', label: 'Z' }],
    entities: [
      { id: 'users', group: 'z', fields: [{ name: 'id', type: 'int' }, { name: 'name', type: 'text' }],
        constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }] },
      { id: 'orders', group: 'z', fields: [{ name: 'id', type: 'int' }, { name: 'user_name', type: 'text' }],
        constraints: [{ id: 'c1', kind: 'fk', columns: ['user_name'], refTable: 'users', refColumns: ['name'] }] },
    ],
  });
  const check = runChecks({ model, geometry, view, root }).find((c) => /foreign key/i.test(c.name))!;
  expect(check.pass).toBe(false);
  expect(check.problems.join(' ')).toMatch(/users\(name\)/);
});
```

(Read `run-checks.ts` for its exact call signature and `CheckResult` shape before writing this — it
takes an object with `model`, `geometry`, `view`, `root`; mirror the neighbouring tests' setup.)

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** In `apply-model-edit.ts`, extend `validateEditEntity` with the rules
      above (each `throw new Error(...)` with the exact message the tests match). In `run-checks.ts`
      add:

```ts
  // Postgres requires a foreign key to reference a unique-constrained column set.
  const fkProblems: string[] = [];
  for (const e of model.entities) {
    for (const c of e.constraints) {
      if (c.kind !== 'fk') continue;
      const target = model.entityById.get(c.refTable);
      if (!target) continue;
      const covered = target.constraints.some(
        (tc) => (tc.kind === 'pk' || tc.kind === 'unique') && sameSet(tc.columns, c.refColumns),
      );
      if (!covered) fkProblems.push(`${e.id}(${c.columns.join(', ')}) → ${c.refTable}(${c.refColumns.join(', ')})`);
    }
  }
  results.push({
    name: 'Every foreign key references a key',
    pass: fkProblems.length === 0,
    scope: `${model.entities.length} tables`,
    problems: fkProblems,
  });
```

(with a local `sameSet` helper, or export one from `derive-relationships` and import it.)

- [ ] **Step 4: Full suite + typecheck green.**

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/apply-model-edit apps/eer/src/engine/checks/run-checks
git commit -m "feat(eer): constraint validation + fk-references-a-key self-check"
```

---

### Task 6: Editor — columns grid (type picker, nullable, default)

**Files:**
- Modify: `apps/eer/src/components/editor/field-grid.tsx` → rename to `columns-grid.tsx` (git mv), and its import in `table-modal.tsx`
- Create: `apps/eer/src/components/editor/type-cell.tsx`
- Modify: `apps/eer/src/components/editor/table-modal.tsx`
- Test: `apps/eer/src/components/editor/table-modal.test.tsx` (update), `apps/eer/src/components/editor/type-cell.test.tsx` (new)

**Interfaces:**
- Consumes: `PG_TYPES`, `parseType`, `formatType` (Task 1); `EditColumn` (Task 5).
- Produces: `ColumnsGrid({ columns, onChange }: { columns: EditColumn[]; onChange: (c: EditColumn[]) => void })`
  — row: name · **TypeCell** · nullable checkbox · default input · note input · ↑ ↓ · ✕; plus "Add column".
  `TypeCell({ value, onChange }: { value: string; onChange: (t: string) => void })` — a `<select>`
  of `PG_TYPES` grouped by `group` via `<optgroup>`, plus a final `custom…` option; when the selected
  type has `params > 0`, one or two small number inputs appear after it; when `custom`, a text input.
  Emits the formatted string (`formatType`). Opening on a value parses it (`parseType`); a custom
  value selects `custom…` and prefills the text input.

- [ ] **Step 1: Failing tests** (`type-cell.test.tsx`)

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TypeCell } from './type-cell';

afterEach(cleanup);

describe('TypeCell', () => {
  it('selects the base type and emits it', () => {
    const onChange = vi.fn();
    render(<TypeCell value="int" onChange={onChange} />);
    const select = screen.getByLabelText('type');
    expect(select).toHaveValue('int');
    fireEvent.change(select, { target: { value: 'text' } });
    expect(onChange).toHaveBeenCalledWith('text');
  });

  it('shows one param input for varchar and emits varchar(n)', () => {
    const onChange = vi.fn();
    render(<TypeCell value="varchar(255)" onChange={onChange} />);
    expect(screen.getByLabelText('type')).toHaveValue('varchar');
    const p1 = screen.getByLabelText('type parameter 1');
    expect(p1).toHaveValue('255');
    fireEvent.change(p1, { target: { value: '64' } });
    expect(onChange).toHaveBeenCalledWith('varchar(64)');
  });

  it('shows two param inputs for numeric', () => {
    const onChange = vi.fn();
    render(<TypeCell value="numeric(10,2)" onChange={onChange} />);
    expect(screen.getByLabelText('type parameter 1')).toHaveValue('10');
    expect(screen.getByLabelText('type parameter 2')).toHaveValue('2');
    fireEvent.change(screen.getByLabelText('type parameter 2'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('numeric(10,4)');
  });

  it('falls back to a custom text input for an unknown type', () => {
    const onChange = vi.fn();
    render(<TypeCell value="citext" onChange={onChange} />);
    expect(screen.getByLabelText('type')).toHaveValue('__custom__');
    const custom = screen.getByLabelText('custom type');
    expect(custom).toHaveValue('citext');
    fireEvent.change(custom, { target: { value: 'my_enum' } });
    expect(onChange).toHaveBeenCalledWith('my_enum');
  });

  it('switching to custom keeps editing free-form', () => {
    const onChange = vi.fn();
    render(<TypeCell value="int" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('type'), { target: { value: '__custom__' } });
    expect(screen.getByLabelText('custom type')).toBeInTheDocument();
  });
});
```

And in `table-modal.test.tsx`, replace the role/ref assertions with this one (READ the file first and
reuse its existing render harness + `applyModelEdit` spy verbatim — the body below assumes a
`renderTableModal(id)` helper and an `edits` spy in that file's style; adapt the two helper names to
whatever it actually uses, do not invent a new harness):

```tsx
it('adds a column with a picked type, nullable and default, and saves them', () => {
  renderTableModal('users');
  fireEvent.click(screen.getByRole('button', { name: /add column/i }));

  const rows = screen.getAllByLabelText(/^Column \d+ name$/);
  const i = rows.length; // the new row is the last one, 1-indexed labels
  fireEvent.change(screen.getByLabelText(`Column ${i} name`), { target: { value: 'note' } });

  const typeSelects = screen.getAllByLabelText('type');
  fireEvent.change(typeSelects[i - 1]!, { target: { value: 'varchar' } });
  const params = screen.getAllByLabelText('type parameter 1');
  fireEvent.change(params[params.length - 1]!, { target: { value: '64' } });

  fireEvent.click(screen.getByLabelText(`Column ${i} nullable`)); // ticked by default → untick
  fireEvent.change(screen.getByLabelText(`Column ${i} default`), { target: { value: "'draft'" } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  const edit = edits.mock.calls.at(-1)![0] as ModelEdit & { kind: 'upsertEntity' };
  expect(edit.entity.columns.at(-1)).toEqual({
    name: 'note', type: 'varchar(64)', nullable: false, default: "'draft'", title: null, description: null,
  });
});
```

The `aria-label`s used above (`Column N name`, `Column N nullable`, `Column N default`) are the
contract this task's `columns-grid.tsx` must render.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `type-cell.tsx`**

```tsx
// The type picker. Types are stored as strings ("varchar(255)"), so this cell is
// a codec around a <select>: it parses the incoming string, renders the base +
// its params, and emits a formatted string back. `custom…` keeps enums/domains
// (and any hand-written type) editable.

import { PG_TYPES, formatType, parseType, type PgTypeGroup } from '../../engine/model/pg-types';
import { cn } from '../../ui/cn';

const CUSTOM = '__custom__';
const GROUPS: PgTypeGroup[] = ['numeric', 'text', 'boolean', 'temporal', 'uuid', 'json', 'binary'];
const cell = cn('rounded border border-gray-600 bg-gray-900 px-1 py-1', 'font-mono text-xs text-gray-50');

export function TypeCell({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const parsed = parseType(value);
  const base = parsed.custom ? CUSTOM : parsed.base;
  const spec = PG_TYPES.find((t) => t.name === parsed.base);
  const arity = parsed.custom ? 0 : (spec?.params ?? 0);

  const setBase = (next: string) => {
    if (next === CUSTOM) {
      onChange(parsed.custom ? parsed.base : '');
      return;
    }
    const nextSpec = PG_TYPES.find((t) => t.name === next);
    onChange(formatType(next, parsed.params.slice(0, nextSpec?.params ?? 0)));
  };

  const setParam = (i: number, v: string) => {
    const params = [...parsed.params];
    params[i] = v;
    onChange(formatType(parsed.base, params.slice(0, arity)));
  };

  return (
    <div className="flex grow items-center gap-1">
      <select className={cn(cell, 'grow')} aria-label="type" value={base} onChange={(e) => setBase(e.target.value)}>
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {PG_TYPES.filter((t) => t.group === g).map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM}>custom…</option>
      </select>
      {parsed.custom && (
        <input
          className={cn(cell, 'w-24')}
          aria-label="custom type"
          value={parsed.base}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {Array.from({ length: arity }, (_, i) => (
        <input
          key={i}
          className={cn(cell, 'w-12')}
          aria-label={`type parameter ${i + 1}`}
          value={parsed.params[i] ?? ''}
          onChange={(e) => setParam(i, e.target.value)}
        />
      ))}
    </div>
  );
}
```

Then `columns-grid.tsx`: take `field-grid.tsx`, drop the Role / Ref-table / Ref-field columns,
add `<TypeCell>` in the Type cell, a `nullable` checkbox (label "Null"), and a `default` text input.
Keep the shared `COL` width map idiom (header + cells) so the grid stays aligned and doesn't scroll.
Add-column default: `{ name: '', type: 'text', nullable: true, default: null, title: null, description: null }`.

- [ ] **Step 4: Full suite + typecheck green.**

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/components/editor
git commit -m "feat(eer): columns grid with a postgres type picker, nullable and default"
```

---

### Task 7: Editor — constraints section

**Files:**
- Create: `apps/eer/src/components/editor/constraints-editor.tsx`, `apps/eer/src/components/editor/column-multi-select.tsx`
- Modify: `apps/eer/src/components/editor/table-modal.tsx`
- Test: `apps/eer/src/components/editor/constraints-editor.test.tsx`

**Interfaces:**
- Consumes: `Constraint`, `FkAction` (Task 2), `Model`.
- Produces:
  `ColumnMultiSelect({ options, value, onChange, label }: { options: string[]; value: string[];
   onChange: (v: string[]) => void; label: string })` — a checkbox list in a bordered box (NOT a
   native multi-select: jsdom and users both handle checkboxes better); order of `value` is the
   order the user ticked, preserved (composite keys are ordered).
  `ConstraintsEditor({ model, ownId, columns, constraints, onChange })` — `columns: string[]` are
  the table's current column names (from the draft, so a just-added column is selectable);
  Add buttons: `+ PK`, `+ UNIQUE`, `+ FK`, `+ CHECK`; each row shows kind badge, optional name input,
  the relevant editors, and ✕. New ids: `c<max+1>`.

- [ ] **Step 1: Failing tests** (`constraints-editor.test.tsx`)

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildModel } from '../../test/models';
import type { Constraint } from '../../engine/model/types';
import { ConstraintsEditor } from './constraints-editor';

afterEach(cleanup);

const model = buildModel(); // users(id), orders(id, users_id), tags(id)
const cols = ['id', 'users_id'];

const setup = (constraints: Constraint[] = []) => {
  const onChange = vi.fn();
  render(<ConstraintsEditor model={model} ownId="orders" columns={cols} constraints={constraints} onChange={onChange} />);
  return onChange;
};

describe('ConstraintsEditor', () => {
  it('adds each constraint kind with a fresh id', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ FK' }));
    const next = onChange.mock.calls[0]![0] as Constraint[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'c1', kind: 'fk', columns: [], refTable: '', refColumns: [] });
  });

  it('ticking columns adds them in tick order (composite keys are ordered)', () => {
    const onChange = setup([{ id: 'c1', kind: 'pk', name: null, columns: [] }]);
    fireEvent.click(screen.getByLabelText('Constraint 1 column users_id'));
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ columns: ['users_id'] });
    cleanup();

    const onChange2 = setup([{ id: 'c1', kind: 'pk', name: null, columns: ['users_id'] }]);
    fireEvent.click(screen.getByLabelText('Constraint 1 column id'));
    expect((onChange2.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ columns: ['users_id', 'id'] });
  });

  it('unticking a column removes it', () => {
    const onChange = setup([{ id: 'c1', kind: 'pk', name: null, columns: ['id', 'users_id'] }]);
    fireEvent.click(screen.getByLabelText('Constraint 1 column id'));
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ columns: ['users_id'] });
  });

  it('an fk row lists the target table’s columns once a table is chosen', () => {
    const onChange = setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refTable: '', refColumns: [], onDelete: null, onUpdate: null },
    ]);
    fireEvent.change(screen.getByLabelText('Constraint 1 target table'), { target: { value: 'users' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ refTable: 'users', refColumns: [] });
    cleanup();

    setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refTable: 'users', refColumns: [], onDelete: null, onUpdate: null },
    ]);
    expect(screen.getByLabelText('Constraint 1 target column id')).toBeInTheDocument();
  });

  it('sets an fk action', () => {
    const onChange = setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
    ]);
    fireEvent.change(screen.getByLabelText('Constraint 1 on delete'), { target: { value: 'cascade' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ onDelete: 'cascade' });
  });

  it('edits a check expression and a constraint name', () => {
    const onChange = setup([{ id: 'c1', kind: 'check', name: null, expression: '' }]);
    fireEvent.change(screen.getByLabelText('Constraint 1 expression'), { target: { value: 'number > 0' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ expression: 'number > 0' });
    fireEvent.change(screen.getByLabelText('Constraint 1 name'), { target: { value: 'ck_number' } });
    expect((onChange.mock.calls[1]![0] as Constraint[])[0]).toMatchObject({ name: 'ck_number' });
  });

  it('removes a row', () => {
    const onChange = setup([
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
      { id: 'c2', kind: 'unique', name: null, columns: ['users_id'] },
    ]);
    fireEvent.click(screen.getByLabelText('Remove constraint 1'));
    const next = onChange.mock.calls[0]![0] as Constraint[];
    expect(next.map((c) => c.id)).toEqual(['c2']);
  });
});
```

The `aria-label`s above (`Constraint N column <name>`, `Constraint N target table`,
`Constraint N target column <name>`, `Constraint N on delete`, `Constraint N expression`,
`Constraint N name`, `Remove constraint N`) are the contract this task must render.

- [ ] **Step 2: Run — FAIL. Step 3: Implement** both components (≤ ~120 lines each; respect the
      Tailwind boundary). FK row: name · columns (ColumnMultiSelect over `columns`) · `→` ·
      target-table `<select>` (all `model.entities`) · target-columns (ColumnMultiSelect over the
      chosen table's column names) · ON DELETE `<select>` · ON UPDATE `<select>` (options: `–`,
      cascade, restrict, set null, set default, no action) · ✕. New-row ids: `c<max existing + 1>`.

- [ ] **Step 4:** Wire into `table-modal.tsx` under the columns grid, with a hint line: *"A FOREIGN
      KEY is what draws an edge between two tables."* The modal's Save now dispatches
      `upsertEntity` with `{ columns, constraints, indexes }`.

- [ ] **Step 5: Full suite + typecheck. Commit**

```bash
git add apps/eer/src/components/editor
git commit -m "feat(eer): constraints editor — pk/unique/fk/check with composite columns"
```

---

### Task 8: Editor — indexes section

**Files:**
- Create: `apps/eer/src/components/editor/indexes-editor.tsx`
- Modify: `apps/eer/src/components/editor/table-modal.tsx`
- Test: `apps/eer/src/components/editor/indexes-editor.test.tsx`

**Interfaces:**
- Consumes: `TableIndex` (Task 2), `ColumnMultiSelect` (Task 7).
- Produces: `IndexesEditor({ columns, indexes, onChange })` — rows of: name input · ColumnMultiSelect ·
  unique checkbox · ✕; "Add index" appends `{ id: 'i<max+1>', name: '', columns: [], unique: false }`.

- [ ] **Step 1: Failing tests** (`indexes-editor.test.tsx`)

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableIndex } from '../../engine/model/types';
import { IndexesEditor } from './indexes-editor';

afterEach(cleanup);

const cols = ['id', 'users_id'];
const setup = (indexes: TableIndex[] = []) => {
  const onChange = vi.fn();
  render(<IndexesEditor columns={cols} indexes={indexes} onChange={onChange} />);
  return onChange;
};

describe('IndexesEditor', () => {
  it('adds an empty index with a fresh id', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: /add index/i }));
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toEqual({ id: 'i1', name: '', columns: [], unique: false });
  });

  it('edits name, columns (in tick order) and unique', () => {
    const onChange = setup([{ id: 'i1', name: '', columns: [], unique: false }]);
    fireEvent.change(screen.getByLabelText('Index 1 name'), { target: { value: 'idx_orders_user' } });
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toMatchObject({ name: 'idx_orders_user' });
    fireEvent.click(screen.getByLabelText('Index 1 column users_id'));
    expect((onChange.mock.calls[1]![0] as TableIndex[])[0]).toMatchObject({ columns: ['users_id'] });
    fireEvent.click(screen.getByLabelText('Index 1 unique'));
    expect((onChange.mock.calls[2]![0] as TableIndex[])[0]).toMatchObject({ unique: true });
  });

  it('removes an index', () => {
    const onChange = setup([
      { id: 'i1', name: 'a', columns: ['id'], unique: false },
      { id: 'i2', name: 'b', columns: ['users_id'], unique: true },
    ]);
    fireEvent.click(screen.getByLabelText('Remove index 1'));
    expect((onChange.mock.calls[0]![0] as TableIndex[]).map((i) => i.id)).toEqual(['i2']);
  });
});
```

Plus one in `table-modal.test.tsx` asserting a Save dispatches the indexes the editor produced
(mirror that file's existing spy-on-`applyModelEdit` pattern).

- [ ] **Step 2: FAIL → Step 3: implement → Step 4: suite + typecheck green.**
- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/components/editor
git commit -m "feat(eer): indexes editor"
```

---

### Task 9: Rewrite the seed, prove equivalence, e2e, docs

**Files:**
- Create: `apps/eer/src/test/fixtures/items-platform.legacy.json` (a copy of today's seed, kept as the legacy-shape fixture)
- Modify: `apps/eer/models/items-platform.json` (rewritten into the new shape)
- Create: `apps/eer/src/test/seed-equivalence.test.ts`
- Modify: `apps/eer/README.md`
- Modify: `apps/eer/src/model/eer-model.json` (the bundled fallback — same rewrite)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Snapshot the legacy seed as a fixture**

```bash
mkdir -p apps/eer/src/test/fixtures
cp apps/eer/models/items-platform.json apps/eer/src/test/fixtures/items-platform.legacy.json
```

- [ ] **Step 2: Write the equivalence test FIRST (it will pass trivially now, and must KEEP passing
      after the rewrite — that is its job)**

```ts
// The seed was rewritten from legacy role/ref fields into constraints. This
// proves the rewrite changed the SHAPE and nothing else: the same edges, the
// same cardinalities, the same badges, the same titles.
import { describe, expect, it } from 'vitest';

import legacyRaw from './fixtures/items-platform.legacy.json';
import newRaw from '../../models/items-platform.json';
import { columnRoles } from '../engine/model/column-roles';
import { loadModel } from '../engine/model/load-model';

const digest = (raw: unknown) => {
  const { model, errors } = loadModel(raw);
  expect(errors).toEqual([]);
  const m = model!;
  return {
    entities: m.entities.map((e) => e.id).sort(),
    edges: m.relationships
      .map((r) => `${r.source}.${r.sourceField}->${r.target}.${r.targetField}:${r.cardinality}`)
      .sort(),
    labels: m.relationships.filter((r) => r.label).map((r) => r.label).sort(),
    titles: m.entities.flatMap((e) => e.columns.filter((c) => c.title).map((c) => `${e.id}.${c.name}=${c.title!}`)).sort(),
    badges: m.entities
      .flatMap((e) => {
        const roles = columnRoles(e);
        return e.columns.map((c) => `${e.id}.${c.name}:${roles.get(c.name)!.pk ? 'pk' : ''}${roles.get(c.name)!.fk ? 'fk' : ''}`);
      })
      .sort(),
  };
};

describe('seed rewrite', () => {
  it('the new seed is equivalent to the legacy one: same edges, cardinalities, badges and titles', () => {
    expect(digest(newRaw)).toEqual(digest(legacyRaw));
  });
});
```

- [ ] **Step 3: Generate the rewritten seed.** Write a throwaway node script that
      `loadModel(legacy)` → `serializeModel(model, model.colors)` → writes
      `apps/eer/models/items-platform.json` (pretty, 2-space). `serializeModel` must now emit
      `columns` (with nullable/default when non-default), `constraints`, `indexes`, and NO
      `role`/`ref`/`refField` — if it doesn't yet, fix `serialize-model.ts` here (that is part of
      this task) and extend its roundtrip test. Delete the script afterwards; `git status` must show
      only the intended files.

- [ ] **Step 4: Run the equivalence test — it must still PASS.** If it fails, the rewrite lost
      information: fix the serializer, regenerate, re-run. Then apply the same rewrite to
      `apps/eer/src/model/eer-model.json` (the bundled fallback loaded when the API is absent).

- [ ] **Step 5: E2E acceptance walk** (own dev server on 4631; never touch the seed):
      New model → 2 tables → give table A a composite PK (2 columns) → give table B an FK to A with
      ON DELETE CASCADE → add an index → confirm the edge appears with 1-n → make B's FK columns its
      PK → confirm the edge flips to 1-1 → Save → hard reload → everything survives. Delete the
      scratch model. Screenshot. Record the saved JSON in your report.

- [ ] **Step 6: README** — replace the "connections are derived from fk fields" wording with the
      constraint model: columns (type/nullable/default), constraints (PK/UNIQUE/FK/CHECK, composite),
      indexes; **a FOREIGN KEY constraint is what draws an edge**; legacy `role`/`ref` files still
      load (normalised on read).

- [ ] **Step 7: Full suite + typecheck + build. Commit**

```bash
git add apps/eer/models/items-platform.json apps/eer/src/model/eer-model.json \
        apps/eer/src/test/fixtures apps/eer/src/test/seed-equivalence.test.ts \
        apps/eer/src/engine/model/serialize-model apps/eer/README.md
git commit -m "feat(eer): rewrite the seed into columns+constraints; prove equivalence; docs"
```
