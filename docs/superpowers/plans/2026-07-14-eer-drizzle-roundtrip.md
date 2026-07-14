# EER ↔ drizzle lossless round-trip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A drizzle schema can be imported into the eer diagram and exported back out with nothing lost — proven by a gate test over the repo's real 18-table schema.

**Architecture:** A Node-only *reader* introspects a drizzle schema module with `getTableConfig`/`isPgEnum` and emits a plain-JSON `SchemaDescription`. Two **pure** engine transforms (`import-drizzle`, `export-drizzle`) convert between that and the eer `Model`. The type picker's catalogue is derived at runtime from drizzle's own builder registry, so it cannot offer a type drizzle can't build. The gate test asserts semantic equality both ways.

**Tech Stack:** TypeScript, React 19, Vitest + testing-library, Vite 8 dev middleware, drizzle-orm 0.45.2, drizzle-kit 0.31 (`drizzle-kit/api`), Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-07-14-eer-drizzle-roundtrip-design.md` (rev 3).
**UI spec of record:** Claude Design project `dc519bc9-8288-4ed6-bdd5-70d53ac8622d`, *EER Modal Spec* — 18 frames.

## Global Constraints

- **Engine purity:** everything under `apps/eer/src/engine/` is pure — no DOM, no filesystem, no network. One function per folder: `<name>/<name>.ts` + `index.ts` + `<name>.test.ts`.
- **Node-only code** lives in `apps/eer/src/node/` and `apps/eer/vite-plugins/`. It must never be imported from `src/components/` or `src/engine/`.
- **Tailwind boundary** (`apps/eer/scripts/verify-tailwind.mjs`, runs inside `pnpm test`/`typecheck`/`build`): no arbitrary values (`w-[13px]`), class strings ≤ 100 chars, no fractional spacing steps, `style` props may only set `--*` custom properties, no DOM `.style` API.
- **Type scale is fixed:** only `text-3xs|2xs|xs|sm|base|lg` exist. No other font sizes.
- **Modal widths:** `size="default"` (448px) or `size="wide"` (1024px). Nothing else.
- **Modals scroll on the backdrop**, never in the panel body. Do not add `overflow-y-auto`/`max-h-*` to a modal panel. The one sanctioned inner scroll is horizontal (`overflow-x-auto`).
- **Verification per task:** `pnpm --filter @tickets/eer test` and `pnpm --filter @tickets/eer typecheck` must both pass before the commit.
- **Commits:** conventional, scoped — `feat(eer): …`, `fix(eer): …`. One commit per task.
- Never weaken or delete an existing test to make a change pass. If a test must change, the change is part of the deliverable and must be justified in the commit message.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `apps/eer/src/engine/model/pg-types/pg-types.ts` | *(rewritten)* catalogue built from drizzle's builder registry; `parseType`/`formatType` with array dimensions |
| `apps/eer/src/engine/model/pg-types/descriptors.ts` | per-builder descriptor table (group, params, display name, emit) |
| `apps/eer/src/node/describe-drizzle/describe-drizzle.ts` | Node: drizzle module → `SchemaDescription` |
| `apps/eer/src/node/render-sql/render-sql.ts` | Node: drizzle `sql` chunks → SQL text |
| `apps/eer/src/engine/model/import-drizzle/import-drizzle.ts` | pure: `SchemaDescription` + `Model | null` → `{ model, report }` |
| `apps/eer/src/engine/model/export-drizzle/export-drizzle.ts` | pure: `Model` → drizzle TypeScript source |
| `apps/eer/src/test/gate/roundtrip.gate.test.ts` | the contract: real schema → model → schema → equal |
| `apps/eer/src/components/editor/type-picker.tsx` | the anchored type picker panel |
| `apps/eer/src/components/editor/tabs.tsx` | the table modal's tab bar with counts |
| `apps/eer/src/components/editor/enums-editor.tsx` | enum manager inside Model settings |
| `apps/eer/src/components/editor/import-modal.tsx` | dry-run import report |
| `apps/eer/src/components/editor/export-modal.tsx` | export preview + write |

**Modified:** `apps/eer/package.json` · `apps/eer/src/engine/model/types/types.ts` · `load-model` · `serialize-model` · `apply-model-edit` · `column-roles` · `apps/eer/vite-plugins/models-api.ts` · `columns-grid.tsx` · `type-cell.tsx` · `constraints-editor.tsx` · `indexes-editor.tsx` · `table-modal.tsx` · `model-modal.tsx` · `apps/eer/models/items-platform.json`.

---

## Task 1: The type catalogue comes from drizzle

**Files:**
- Modify: `apps/eer/package.json` (add `drizzle-orm` dependency)
- Create: `apps/eer/src/engine/model/pg-types/descriptors.ts`
- Modify: `apps/eer/src/engine/model/pg-types/pg-types.ts` (rewrite)
- Test: `apps/eer/src/engine/model/pg-types/pg-types.test.ts` (rewrite)

**Interfaces:**
- Consumes: nothing.
- Produces: `PG_TYPES: PgTypeDescriptor[]`, `parseType(s: string): ParsedType`, `formatType(base: string, params: string[], arrays: ArrayDimension[]): string`, `TYPE_ALIASES: Map<string, string>`, `normalizeTypeName(s: string): string`. Types `PgTypeDescriptor`, `PgTypeParam`, `ArrayDimension`, `ParsedType`, `PgTypeGroup` exactly as in the spec's Types section.

**Background the implementer needs:**

Drizzle's builder registry is **not** exported from `drizzle-orm/pg-core`. It lives at
`drizzle-orm/pg-core/columns/all` and returns 32 builders:

```
bigint bigserial bit boolean char cidr customType date doublePrecision geometry halfvec
inet integer interval json jsonb line macaddr macaddr8 numeric point real serial smallint
smallserial sparsevec text time timestamp uuid varchar vector
```

`customType` is a meta-factory, not a type — exclude it. `decimal` is an alias export of
`numeric` and is *not* in the registry — it goes in the alias map. A builder's SQL name is only
readable from a **built** column (`pgTable('t', { c: builder() }).c.getSQLType()`), never from the
builder itself.

Types the picker must NOT offer, because drizzle cannot build them and they therefore cannot
round-trip: `bytea` (in today's catalogue — remove it), `box`, `path`, `polygon`, `circle`,
`varbit`.

- [ ] **Step 1: Add the dependency**

```bash
cd apps/eer && pnpm add drizzle-orm@^0.45.2
```

Expected: `apps/eer/package.json` gains `"drizzle-orm": "^0.45.2"` under `dependencies`.

- [ ] **Step 2: Write the failing tests**

Create `apps/eer/src/engine/model/pg-types/pg-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getPgColumnBuilders } from 'drizzle-orm/pg-core/columns/all';

import { PG_TYPES, formatType, normalizeTypeName, parseType } from './pg-types';

describe('catalogue', () => {
  // The drift test: a drizzle upgrade that adds a builder turns this red rather
  // than leaving a silent hole in the picker.
  it('has a descriptor for every drizzle builder except the customType meta-factory', () => {
    const builders = Object.keys(getPgColumnBuilders()).filter((b) => b !== 'customType');
    const described = new Set(PG_TYPES.map((t) => t.builder));
    expect([...builders].filter((b) => !described.has(b))).toEqual([]);
  });

  it('offers nothing drizzle cannot build', () => {
    const names = PG_TYPES.map((t) => t.sqlName);
    for (const absent of ['bytea', 'box', 'path', 'polygon', 'circle', 'varbit']) {
      expect(names).not.toContain(absent);
    }
  });

  it('offers the serial family — 16 columns of the real schema use it', () => {
    const names = PG_TYPES.map((t) => t.sqlName);
    expect(names).toContain('serial');
    expect(names).toContain('bigserial');
    expect(names).toContain('smallserial');
  });

  it('carries drizzle SQL names, with shorthand only as a display name', () => {
    const ts = PG_TYPES.find((t) => t.builder === 'timestamp')!;
    expect(ts.sqlName).toBe('timestamp');
    const tstz = PG_TYPES.find((t) => t.sqlName === 'timestamp with time zone')!;
    expect(tstz.displayName).toBe('timestamptz');
  });
});

describe('parseType', () => {
  it('parses a bare type', () => {
    expect(parseType('text')).toEqual({ base: 'text', params: [], arrays: [], known: true });
  });

  it('parses parameters', () => {
    expect(parseType('numeric(10,2)')).toEqual({ base: 'numeric', params: ['10', '2'], arrays: [], known: true });
  });

  it('parses array dimensions, sized and nested', () => {
    expect(parseType('text[]').arrays).toEqual([{ size: null }]);
    expect(parseType('integer[2]').arrays).toEqual([{ size: 2 }]);
    expect(parseType('integer[2][]').arrays).toEqual([{ size: 2 }, { size: null }]);
  });

  it('parses a multi-word type', () => {
    expect(parseType('timestamp with time zone').known).toBe(true);
  });

  // The picker renders known:false as an invalid selection that blocks export.
  it('marks an unrecognised type unknown but keeps its text verbatim', () => {
    expect(parseType('legacy_money')).toEqual({
      base: 'legacy_money', params: [], arrays: [], known: false,
    });
  });
});

describe('formatType', () => {
  it('round-trips every shape parseType produces', () => {
    for (const s of ['text', 'varchar(64)', 'numeric(10,2)', 'text[]', 'integer[2][]', 'timestamp with time zone']) {
      const p = parseType(s);
      expect(formatType(p.base, p.params, p.arrays)).toBe(s);
    }
  });
});

describe('normalizeTypeName', () => {
  it('maps legacy aliases onto drizzle-canonical names', () => {
    expect(normalizeTypeName('int')).toBe('integer');
    expect(normalizeTypeName('int4')).toBe('integer');
    expect(normalizeTypeName('int8')).toBe('bigint');
    expect(normalizeTypeName('bool')).toBe('boolean');
    expect(normalizeTypeName('decimal')).toBe('numeric');
    expect(normalizeTypeName('timestamptz')).toBe('timestamp with time zone');
    expect(normalizeTypeName('serial4')).toBe('serial');
  });

  it('leaves an unknown name alone', () => {
    expect(normalizeTypeName('legacy_money')).toBe('legacy_money');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @tickets/eer vitest run src/engine/model/pg-types`
Expected: FAIL — `PG_TYPES` has no `builder`/`sqlName`/`displayName`, `parseType` returns `custom`, `normalizeTypeName` is not exported.

- [ ] **Step 4: Write the descriptor table**

Create `apps/eer/src/engine/model/pg-types/descriptors.ts`:

```ts
// One descriptor per drizzle pg-core builder. The NAMES come from drizzle (a
// built column's getSQLType()); the grouping, parameter grammar and display
// shorthand are ours — getSQLType() can't tell us that varchar takes a length
// while text doesn't (an unparameterised `bit` even reports "bit(undefined)").
// pg-types.test.ts asserts every builder in drizzle's registry appears here, so
// a drizzle upgrade that adds a type fails the suite instead of silently
// missing from the picker.

export type PgTypeGroup =
  | 'numeric' | 'text' | 'temporal' | 'boolean' | 'uuid'
  | 'json' | 'network' | 'geometric' | 'vector';

export interface PgTypeParam {
  name: string;
  kind: 'int' | 'text';
}

export interface PgTypeDescriptor {
  builder: string; // the getPgColumnBuilders() key
  sqlName: string; // what Postgres/drizzle print
  displayName: string; // what the picker shows (shorthand allowed)
  group: PgTypeGroup;
  params: PgTypeParam[];
}

const P = {
  length: { name: 'n', kind: 'int' } as PgTypeParam,
  precision: { name: 'p', kind: 'int' } as PgTypeParam,
  scale: { name: 's', kind: 'int' } as PgTypeParam,
  dimensions: { name: 'd', kind: 'int' } as PgTypeParam,
};

export const DESCRIPTORS: PgTypeDescriptor[] = [
  { builder: 'smallint', sqlName: 'smallint', displayName: 'smallint', group: 'numeric', params: [] },
  { builder: 'integer', sqlName: 'integer', displayName: 'integer', group: 'numeric', params: [] },
  { builder: 'bigint', sqlName: 'bigint', displayName: 'bigint', group: 'numeric', params: [] },
  { builder: 'smallserial', sqlName: 'smallserial', displayName: 'smallserial', group: 'numeric', params: [] },
  { builder: 'serial', sqlName: 'serial', displayName: 'serial', group: 'numeric', params: [] },
  { builder: 'bigserial', sqlName: 'bigserial', displayName: 'bigserial', group: 'numeric', params: [] },
  { builder: 'numeric', sqlName: 'numeric', displayName: 'numeric', group: 'numeric', params: [P.precision, P.scale] },
  { builder: 'real', sqlName: 'real', displayName: 'real', group: 'numeric', params: [] },
  { builder: 'doublePrecision', sqlName: 'double precision', displayName: 'double precision', group: 'numeric', params: [] },

  { builder: 'text', sqlName: 'text', displayName: 'text', group: 'text', params: [] },
  { builder: 'varchar', sqlName: 'varchar', displayName: 'varchar', group: 'text', params: [P.length] },
  { builder: 'char', sqlName: 'char', displayName: 'char', group: 'text', params: [P.length] },

  { builder: 'boolean', sqlName: 'boolean', displayName: 'boolean', group: 'boolean', params: [] },
  { builder: 'uuid', sqlName: 'uuid', displayName: 'uuid', group: 'uuid', params: [] },

  { builder: 'date', sqlName: 'date', displayName: 'date', group: 'temporal', params: [] },
  { builder: 'time', sqlName: 'time', displayName: 'time', group: 'temporal', params: [P.precision] },
  { builder: 'timestamp', sqlName: 'timestamp', displayName: 'timestamp', group: 'temporal', params: [P.precision] },
  { builder: 'interval', sqlName: 'interval', displayName: 'interval', group: 'temporal', params: [] },

  { builder: 'json', sqlName: 'json', displayName: 'json', group: 'json', params: [] },
  { builder: 'jsonb', sqlName: 'jsonb', displayName: 'jsonb', group: 'json', params: [] },

  { builder: 'inet', sqlName: 'inet', displayName: 'inet', group: 'network', params: [] },
  { builder: 'cidr', sqlName: 'cidr', displayName: 'cidr', group: 'network', params: [] },
  { builder: 'macaddr', sqlName: 'macaddr', displayName: 'macaddr', group: 'network', params: [] },
  { builder: 'macaddr8', sqlName: 'macaddr8', displayName: 'macaddr8', group: 'network', params: [] },

  { builder: 'point', sqlName: 'point', displayName: 'point', group: 'geometric', params: [] },
  { builder: 'line', sqlName: 'line', displayName: 'line', group: 'geometric', params: [] },
  { builder: 'geometry', sqlName: 'geometry(point)', displayName: 'geometry(point)', group: 'geometric', params: [] },

  { builder: 'bit', sqlName: 'bit', displayName: 'bit', group: 'vector', params: [P.length] },
  { builder: 'vector', sqlName: 'vector', displayName: 'vector', group: 'vector', params: [P.dimensions] },
  { builder: 'halfvec', sqlName: 'halfvec', displayName: 'halfvec', group: 'vector', params: [P.dimensions] },
  { builder: 'sparsevec', sqlName: 'sparsevec', displayName: 'sparsevec', group: 'vector', params: [P.dimensions] },
];

// Variants a builder reaches through options rather than a distinct export.
// They are real SQL types with their own names, so the picker lists them, but
// they map back to the SAME builder plus an option bag on export (Task 6).
export const VARIANTS: PgTypeDescriptor[] = [
  {
    builder: 'timestamp', sqlName: 'timestamp with time zone', displayName: 'timestamptz',
    group: 'temporal', params: [P.precision],
  },
  {
    builder: 'time', sqlName: 'time with time zone', displayName: 'timetz',
    group: 'temporal', params: [P.precision],
  },
];
```

- [ ] **Step 5: Rewrite pg-types.ts**

Replace `apps/eer/src/engine/model/pg-types/pg-types.ts` entirely:

```ts
// The type vocabulary. Types are STORED as SQL text ("varchar(255)",
// "integer[2][]") because that is what Postgres and drizzle both print — the
// diagram never invents a vocabulary of its own. There is no `custom` escape
// hatch: a name the catalogue doesn't know parses as `known: false`, which the
// picker renders as an invalid selection and which blocks export.

import { DESCRIPTORS, VARIANTS, type PgTypeDescriptor } from './descriptors';

export type { PgTypeDescriptor, PgTypeGroup, PgTypeParam } from './descriptors';

export const PG_TYPES: PgTypeDescriptor[] = [...DESCRIPTORS, ...VARIANTS];

const BY_SQL_NAME = new Map(PG_TYPES.map((t) => [t.sqlName, t]));

// Legacy and Postgres-shorthand spellings → the name drizzle prints.
export const TYPE_ALIASES = new Map<string, string>([
  ['int', 'integer'],
  ['int4', 'integer'],
  ['int2', 'smallint'],
  ['int8', 'bigint'],
  ['serial4', 'serial'],
  ['serial8', 'bigserial'],
  ['bool', 'boolean'],
  ['decimal', 'numeric'],
  ['float8', 'double precision'],
  ['float4', 'real'],
  ['timestamptz', 'timestamp with time zone'],
  ['timetz', 'time with time zone'],
  ['character varying', 'varchar'],
  ['character', 'char'],
]);

export function normalizeTypeName(base: string): string {
  return TYPE_ALIASES.get(base.trim().toLowerCase()) ?? base.trim();
}

export interface ArrayDimension {
  size: number | null;
}

export interface ParsedType {
  base: string;
  params: string[];
  arrays: ArrayDimension[];
  known: boolean;
}

const ARRAY_SUFFIX = /(\[\d*\])+$/;

export function parseType(s: string): ParsedType {
  let text = s.trim();

  // 1. peel array dimensions off the end: integer[2][] → [{size:2},{size:null}]
  const arrays: ArrayDimension[] = [];
  const suffix = text.match(ARRAY_SUFFIX);
  if (suffix) {
    text = text.slice(0, suffix.index).trim();
    for (const dim of suffix[0].matchAll(/\[(\d*)\]/g)) {
      arrays.push({ size: dim[1] ? Number(dim[1]) : null });
    }
  }

  // 2. peel parameters: numeric(10,2) → ['10','2']
  let params: string[] = [];
  const open = text.indexOf('(');
  if (open !== -1 && text.endsWith(')')) {
    params = text
      .slice(open + 1, -1)
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    text = text.slice(0, open).trim();
  }

  const base = normalizeTypeName(text);
  return { base, params, arrays, known: BY_SQL_NAME.has(base) };
}

export function formatType(base: string, params: string[], arrays: ArrayDimension[] = []): string {
  const kept = params.map((p) => p.trim()).filter((p) => p.length > 0);
  const head = kept.length ? `${base}(${kept.join(',')})` : base;
  const tail = arrays.map((a) => `[${a.size ?? ''}]`).join('');
  return head + tail;
}

export function descriptorFor(base: string): PgTypeDescriptor | undefined {
  return BY_SQL_NAME.get(normalizeTypeName(base));
}
```

Note the `geometry(point)` descriptor: drizzle's `geometry()` reports `geometry(point)` as its SQL
name, so `parseType('geometry(point)')` would peel `point` as a parameter. Guard it by checking
`BY_SQL_NAME` for the *whole* text before peeling parameters — add this at the top of `parseType`,
after the array peel:

```ts
  if (BY_SQL_NAME.has(text)) return { base: text, params: [], arrays, known: true };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @tickets/eer vitest run src/engine/model/pg-types`
Expected: PASS, all cases.

- [ ] **Step 7: Fix the fallout and run the whole suite**

`parseType`'s `custom` field is gone, so `type-cell.tsx` will not typecheck. Leave the picker
rewrite to Task 11 — for now, make `type-cell.tsx` compile by treating `!known` the way it treated
`custom` (a free-text input). Do not add features to it; it is replaced wholesale in Task 11.

Run: `pnpm --filter @tickets/eer test && pnpm --filter @tickets/eer typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/eer/package.json apps/eer/src/engine/model/pg-types apps/eer/src/components/editor/type-cell.tsx pnpm-lock.yaml
git commit -m "feat(eer): type catalogue is derived from drizzle's builder registry; array dimensions; no custom escape hatch"
```

---

## Task 2: The model grows to hold SQL truth

**Files:**
- Modify: `apps/eer/src/engine/model/types/types.ts`
- Modify: `apps/eer/src/engine/model/load-model/load-model.ts`
- Modify: `apps/eer/src/engine/model/serialize-model/serialize-model.ts`
- Test: `apps/eer/src/engine/model/load-model/load-model.test.ts`, `.../serialize-model/serialize-model.test.ts`

**Interfaces:**
- Consumes: `normalizeTypeName`, `parseType` (Task 1).
- Produces: the model types exactly as the spec's Types section defines them — `Column.identity`, `Column.generated`, `Identity`, `Generated`, `Constraint` (unique gains `nullsNotDistinct`, fk gains `refSchema`), `IndexColumn`, `TableIndex` (`columns: IndexColumn[]`, `method`, `only`, `where`), `Entity.schema`, `Model.enums`, `EnumDecl`.

**Background:** `TableIndex.columns` is `string[]` today. It becomes `IndexColumn[]`. That is a
breaking shape change of the same class as the earlier `fields` → `columns` migration: files on
disk keep the old shape and must be normalised on load, forever.

- [ ] **Step 1: Write the failing tests**

Append to `apps/eer/src/engine/model/load-model/load-model.test.ts`:

```ts
describe('drizzle-shaped model', () => {
  const base = {
    groups: [{ id: 'g', label: 'G' }],
    entities: [
      {
        id: 't', label: 't', group: 'g',
        columns: [{ name: 'id', type: 'int' }, { name: 'body', type: 'text' }],
        constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }],
      },
    ],
  };

  it('normalises legacy index columns from string[] to IndexColumn[]', () => {
    const { model } = loadModel({
      ...base,
      entities: [{ ...base.entities[0], indexes: [{ id: 'i1', name: 'idx', columns: ['body'], unique: false }] }],
    });
    expect(model!.entities[0]!.indexes[0]!.columns).toEqual([
      { expression: 'body', isExpression: false, order: null, nulls: null, opClass: null },
    ]);
  });

  it('keeps a full index column with ordering, opClass, method, only and where', () => {
    const { model } = loadModel({
      ...base,
      entities: [
        {
          ...base.entities[0],
          indexes: [
            {
              id: 'i1', name: 'idx', unique: true, method: 'btree', only: false,
              where: "body <> ''",
              columns: [{ expression: 'body', isExpression: false, order: 'desc', nulls: 'last', opClass: 'text_ops' }],
            },
          ],
        },
      ],
    });
    const ix = model!.entities[0]!.indexes[0]!;
    expect(ix.method).toBe('btree');
    expect(ix.where).toBe("body <> ''");
    expect(ix.only).toBe(false);
    expect(ix.columns[0]).toEqual({ expression: 'body', isExpression: false, order: 'desc', nulls: 'last', opClass: 'text_ops' });
  });

  it('normalises legacy type aliases onto drizzle-canonical names', () => {
    const { model } = loadModel(base);
    expect(model!.entities[0]!.columns[0]!.type).toBe('integer'); // was "int"
  });

  it('warns on an unknown type but keeps the text verbatim', () => {
    const { model, warnings } = loadModel({
      ...base,
      entities: [{ ...base.entities[0], columns: [{ name: 'id', type: 'legacy_money' }] }],
    });
    expect(model!.entities[0]!.columns[0]!.type).toBe('legacy_money');
    expect(warnings.join(' ')).toContain('legacy_money');
  });

  it('does not warn on a type declared as a model enum', () => {
    const { warnings } = loadModel({
      ...base,
      enums: [{ name: 'user_kind', values: ['human', 'agent'] }],
      entities: [{ ...base.entities[0], columns: [{ name: 'id', type: 'user_kind' }] }],
    });
    expect(warnings.join(' ')).not.toContain('user_kind');
  });

  it('loads enums, nullsNotDistinct, refSchema, identity, generated and entity schema', () => {
    const { model } = loadModel({
      ...base,
      enums: [{ name: 'k', values: ['a', 'b'], schema: null }],
      entities: [
        {
          id: 't', label: 't', group: 'g', schema: 'billing',
          columns: [
            { name: 'id', type: 'integer', identity: { always: true } },
            { name: 'total', type: 'integer', generated: { expression: 'qty * price', stored: true } },
          ],
          constraints: [
            { id: 'c1', kind: 'unique', columns: ['id'], nullsNotDistinct: true },
            { id: 'c2', kind: 'fk', columns: ['id'], refSchema: 'public', refTable: 't', refColumns: ['id'] },
          ],
        },
      ],
    });
    const e = model!.entities[0]!;
    expect(model!.enums).toEqual([{ name: 'k', values: ['a', 'b'], schema: null }]);
    expect(e.schema).toBe('billing');
    expect(e.columns[0]!.identity!.always).toBe(true);
    expect(e.columns[1]!.generated).toEqual({ expression: 'qty * price', stored: true });
    expect(e.constraints[0]).toMatchObject({ kind: 'unique', nullsNotDistinct: true });
    expect(e.constraints[1]).toMatchObject({ kind: 'fk', refSchema: 'public' });
  });
});
```

Append to `serialize-model.test.ts`:

```ts
it('round-trips every new field through save → load', () => {
  const raw = {
    meta: { title: 'x' },
    enums: [{ name: 'k', values: ['a', 'b'], schema: null }],
    groups: [{ id: 'g', label: 'G' }],
    entities: [
      {
        id: 't', label: 't', group: 'g', schema: null,
        columns: [
          { name: 'id', type: 'serial' },
          { name: 'k', type: 'k' },
          { name: 'tags', type: 'text[]' },
        ],
        constraints: [
          { id: 'c1', kind: 'pk', columns: ['id'] },
          { id: 'c2', kind: 'unique', columns: ['k'], nullsNotDistinct: true },
        ],
        indexes: [
          {
            id: 'i1', name: 'idx', unique: false, method: 'gin', only: false, where: 'k IS NOT NULL',
            columns: [{ expression: 'lower(k)', isExpression: true, order: 'asc', nulls: 'first', opClass: null }],
          },
        ],
      },
    ],
  };
  const first = loadModel(raw).model!;
  const second = loadModel(JSON.parse(JSON.stringify(serializeModel(first, new Map())))).model!;
  expect(second.entities[0]!.indexes).toEqual(first.entities[0]!.indexes);
  expect(second.entities[0]!.constraints).toEqual(first.entities[0]!.constraints);
  expect(second.enums).toEqual(first.enums);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @tickets/eer vitest run src/engine/model/load-model src/engine/model/serialize-model`
Expected: FAIL — `Model.enums` undefined, index columns are strings, type is `"int"`.

- [ ] **Step 3: Extend the types**

In `apps/eer/src/engine/model/types/types.ts`, replace the `Constraint`, `TableIndex`, `Column`,
`Entity` and `Model` declarations with the spec's Types section (rev 3), and add `Identity`,
`Generated`, `IndexColumn` and `EnumDecl`. Every new field is **required** on the normalized model
(`null`/`false`/`[]` when absent) so no consumer has to guess — normalisation is `load-model`'s job.

- [ ] **Step 4: Normalise on load**

In `load-model.ts`:

```ts
import { normalizeTypeName, parseType } from '../pg-types';
import type { EnumDecl, Generated, Identity, IndexColumn } from '../types';

function normalizeIndexColumn(c: unknown): IndexColumn {
  if (typeof c === 'string') {
    return { expression: c, isExpression: false, order: null, nulls: null, opClass: null };
  }
  const o = c as Record<string, unknown>;
  return {
    expression: typeof o.expression === 'string' ? o.expression : '',
    isExpression: o.isExpression === true,
    order: o.order === 'asc' || o.order === 'desc' ? o.order : null,
    nulls: o.nulls === 'first' || o.nulls === 'last' ? o.nulls : null,
    opClass: typeof o.opClass === 'string' ? o.opClass : null,
  };
}

function normalizeIdentity(v: unknown): Identity | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : null);
  return {
    always: o.always === true,
    name: str('name'),
    increment: str('increment'),
    minValue: str('minValue'),
    maxValue: str('maxValue'),
    startWith: str('startWith'),
    cache: str('cache'),
    cycle: typeof o.cycle === 'boolean' ? o.cycle : null,
  };
}

function normalizeGenerated(v: unknown): Generated | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return typeof o.expression === 'string' ? { expression: o.expression, stored: true } : null;
}
```

Wire them in: index normalisation in the `indexes` map (also reading `method`, `only`, `where`),
`identity`/`generated` on the column map, `schema` on the entity, `nullsNotDistinct` on the unique
constraint and `refSchema` on the fk constraint in `normalizeConstraint`, and:

```ts
  // ---- enums (the JSON twin of pgEnum) ----
  const enums: EnumDecl[] = (Array.isArray(r.enums) ? r.enums : []).map((e: any) => ({
    name: typeof e.name === 'string' ? e.name : '',
    values: Array.isArray(e.values) ? e.values.filter((v: unknown) => typeof v === 'string') : [],
    schema: typeof e.schema === 'string' ? e.schema : null,
  }));
  const enumNames = new Set(enums.map((e) => e.name));
```

Column types get normalised through the alias map, and an unrecognised base that is not a declared
enum warns:

```ts
      const parsed = parseType(f.type || '');
      const type = f.type ? formatType(parsed.base, parsed.params, parsed.arrays) : '';
      if (type && !parsed.known && !enumNames.has(parsed.base)) {
        warnings.push(`Column "${e.id}.${f.name}" has unknown type "${parsed.base}".`);
      }
```

(`enums` must be parsed *before* the entities loop so `enumNames` exists.)

- [ ] **Step 5: Emit on serialize**

In `serialize-model.ts`, emit `enums` (omit when empty), `schema` (omit when null), `identity` and
`generated` (omit when null), `nullsNotDistinct` (omit when false), `refSchema` (omit when null),
and the full index shape (`method`/`only`/`where` omitted when null/false). Omission keeps existing
files byte-stable; the serialize round-trip test above is the guard.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @tickets/eer test`
Expected: PASS. Other suites will need mechanical fixes where they construct a `TableIndex` with
`columns: ['x']` — update them to the new shape. **Do not weaken any assertion.**

- [ ] **Step 7: Commit**

```bash
git add apps/eer/src
git commit -m "feat(eer): model holds SQL truth — identity, generated, index method/where/order, nullsNotDistinct, schemas, enums"
```

---

## Task 3: Edits preserve what the editor cannot author

**Files:**
- Modify: `apps/eer/src/engine/model/apply-model-edit/apply-model-edit.ts`
- Test: `apps/eer/src/engine/model/apply-model-edit/apply-model-edit.test.ts`

**Interfaces:**
- Consumes: model types (Task 2).
- Produces: `applyModelEdit` accepting `constraints`/`indexes`/`enums` verbatim; new edit kinds `renameEnum`, `deleteEnum`, `upsertEnum`; `enumRefsTo(model, enumName): { entityId: string; column: string }[]`.

**Background — this is the rule this codebase keeps breaking.** The table modal rebuilds
constraints and indexes from drafts. Any field the UI does not render (`where`, `only`, `method`,
`opClass`, `nullsNotDistinct`, `identity`, `generated`, captured constraint names) must survive an
open-and-save untouched. Past regressions in this app all had this shape: a derived value was
regenerated from a lossy draft and the original was destroyed.

- [ ] **Step 1: Write the failing tests**

```ts
it('an unchanged upsert is a fixed point — nothing the UI cannot author is lost', () => {
  const model = loadModel(FIXTURE_WITH_EVERYTHING).model!; // identity, generated, gin index, partial where, nullsNotDistinct
  const before = JSON.stringify(serializeModel(model, new Map()));

  const e = model.entities[0]!;
  const next = applyModelEdit(model, {
    kind: 'upsertEntity',
    entity: {
      id: e.id, label: e.label, group: e.group, description: e.description,
      fields: e.columns.map((c) => ({ ...c, description: c.description ?? '' })),
      constraints: e.constraints,
      indexes: e.indexes,
    },
  });

  expect(JSON.stringify(serializeModel(next, new Map()))).toBe(before);
});

it('refuses to delete an enum a column still uses, naming the dependents', () => {
  const model = loadModel(FIXTURE_WITH_ENUM).model!; // users.kind : user_kind
  expect(() => applyModelEdit(model, { kind: 'deleteEnum', name: 'user_kind' })).toThrow(
    /users\.kind/,
  );
});

it('renaming an enum re-points every column using it', () => {
  const model = loadModel(FIXTURE_WITH_ENUM).model!;
  const next = applyModelEdit(model, { kind: 'renameEnum', from: 'user_kind', to: 'actor_kind' });
  expect(next.enums.map((e) => e.name)).toEqual(['actor_kind']);
  expect(next.entityById.get('users')!.columns.find((c) => c.name === 'kind')!.type).toBe('actor_kind');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @tickets/eer vitest run src/engine/model/apply-model-edit`
Expected: FAIL — no `deleteEnum`/`renameEnum` edit kinds; the fixed-point test fails if any field is dropped.

- [ ] **Step 3: Implement**

`upsertEntity` already takes `constraints`/`indexes` verbatim — extend the entity payload to carry
`schema` and per-column `identity`/`generated`, and make `EditField` carry them so the modal's
drafts round-trip. Add the enum edits, with `enumRefsTo` powering the refusal:

```ts
export function enumRefsTo(model: Model, name: string): { entityId: string; column: string }[] {
  const out: { entityId: string; column: string }[] = [];
  for (const e of model.entities) {
    for (const c of e.columns) {
      if (parseType(c.type).base === name) out.push({ entityId: e.id, column: c.name });
    }
  }
  return out;
}
```

`deleteEnum` throws when `enumRefsTo` is non-empty, listing `entity.column` pairs — the same
refusal shape as the existing inbound-FK guard (`validateInboundReferences`). `renameEnum` rewrites
the enum and every column whose parsed base matches, preserving array dimensions:

```ts
const p = parseType(c.type);
if (p.base === from) c.type = formatType(to, p.params, p.arrays);
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @tickets/eer test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/apply-model-edit
git commit -m "feat(eer): edits preserve unauthored SQL fields; enum rename cascades, delete is refused while in use"
```

---

## Task 4: Read a drizzle schema (Node)

**Files:**
- Create: `apps/eer/src/node/render-sql/render-sql.ts` + `index.ts` + `render-sql.test.ts`
- Create: `apps/eer/src/node/describe-drizzle/describe-drizzle.ts` + `index.ts` + `describe-drizzle.test.ts`
- Modify: `apps/eer/vitest.config.ts` (a Node-environment project for `src/node/**`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `describeDrizzle(module: Record<string, unknown>, groups: SchemaGroupDescription[]): SchemaDescription` and `renderSql(value: unknown): string | null`. `SchemaDescription`, `TableDescription`, `ColumnDescription`, `UnsupportedConstruct` exactly as the spec defines.

**Background — the bug that killed rev 1.** `hasDefault && !default` is **not** how you detect
`.$defaultFn()`. Verified against the real schema:

```
users.id  (serial().primaryKey())  →  hasDefault: true, default: undefined, defaultFn: undefined
```

There are **16 serial columns** in `@tickets/db`; that heuristic reports every one as unsupported.
Read `column.defaultFn` and `column.onUpdateFn` **directly** — they are `undefined` unless
`.$defaultFn()` / `.$onUpdate()` was called. A default that comes from the column's *type*
(`serial`), from an identity, or from a generated expression is never a runtime default.

Introspection API, all verified present in 0.45.2:

```ts
import { getTableConfig, isPgEnum, PgTable } from 'drizzle-orm/pg-core';
const cfg = getTableConfig(table);
// cfg.name, cfg.schema, cfg.columns, cfg.primaryKeys, cfg.uniqueConstraints, cfg.checks,
// cfg.foreignKeys, cfg.indexes
// fk.reference() → { columns, foreignTable, foreignColumns }; fk.onDelete / fk.onUpdate
// index.config keys: name, columns, unique, only, method, where
// enum object: { enumName, enumValues, schema }
```

An inline `.primaryKey()` marks the *column* (`column.primary`), not `cfg.primaryKeys` — the real
schema uses inline PKs everywhere, so both must be read and normalised into one table-level PK.

- [ ] **Step 1: Write the failing tests**

`describe-drizzle.test.ts` builds a schema module inline (no dependency on `@tickets/db`, so the
test states its own truth):

```ts
import { check, index, integer, pgEnum, pgTable, serial, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { expect, it } from 'vitest';

import { describeDrizzle } from './describe-drizzle';

const kind = pgEnum('kind', ['human', 'agent']);

const users = pgTable('users', {
  id: serial('id').primaryKey(),                       // inline PK + type-borne default
  email: text('email').notNull(),
  kind: kind('kind').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [uniqueIndex('users_email_idx').on(t.email)]);

const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug'),
}, (t) => [
  unique('posts_slug_key').on(t.slug).nullsNotDistinct(),
  check('posts_slug_len', sql`length(slug) > 0`),
  index('posts_live_idx').on(t.slug).where(sql`slug IS NOT NULL`),
]);

const mod = { kind, users, posts };

it('never reports a serial column as a runtime default', () => {
  const d = describeDrizzle(mod, []);
  expect(d.unsupported.filter((u) => u.kind === 'default-fn')).toEqual([]);
});

it('normalises an inline primaryKey into a table-level pk', () => {
  const d = describeDrizzle(mod, []);
  expect(d.tables.find((t) => t.name === 'users')!.primaryKey!.columns).toEqual(['id']);
});

it('reads defaults as SQL text', () => {
  const d = describeDrizzle(mod, []);
  const col = d.tables.find((t) => t.name === 'users')!.columns.find((c) => c.name === 'created_at')!;
  expect(col.default).toBe('now()');
  expect(col.sqlType).toBe('timestamp with time zone');
});

it('reads fk actions, nullsNotDistinct, checks and a partial index', () => {
  const d = describeDrizzle(mod, []);
  const posts = d.tables.find((t) => t.name === 'posts')!;
  expect(posts.foreignKeys[0]).toMatchObject({ refTable: 'users', refColumns: ['id'], onDelete: 'cascade' });
  expect(posts.uniques[0]!.nullsNotDistinct).toBe(true);
  expect(posts.checks[0]).toMatchObject({ name: 'posts_slug_len', expression: 'length(slug) > 0' });
  expect(posts.indexes[0]).toMatchObject({ name: 'posts_live_idx', where: 'slug IS NOT NULL', method: 'btree' });
});

it('reads enums', () => {
  const d = describeDrizzle(mod, []);
  expect(d.enums).toEqual([{ name: 'kind', values: ['human', 'agent'], schema: null }]);
});

it('reports a $defaultFn column as unsupported and export-blocking', () => {
  const t = pgTable('t', { id: text('id').$defaultFn(() => 'x') });
  const d = describeDrizzle({ t }, []);
  expect(d.unsupported).toEqual([
    expect.objectContaining({ kind: 'default-fn', where: 't.id', blocksExport: true }),
  ]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @tickets/eer vitest run src/node`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement renderSql**

drizzle stores a `sql` template as an object of chunks. Render it with drizzle's own pg dialect so
the text matches what drizzle-kit would emit:

```ts
import { PgDialect } from 'drizzle-orm/pg-core';
import { SQL, isSQLWrapper } from 'drizzle-orm';

const dialect = new PgDialect();

// A default is either a JS literal (`.default(0)`) or a sql template
// (`.defaultNow()` → sql`now()`). Both become SQL text: once flattened you can
// no longer tell a SQL string literal from a JS string, so the exporter emits
// everything through sql`…` and never guesses (spec: "SQL text is SQL text").
export function renderSql(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof SQL || isSQLWrapper(value)) {
    const query = dialect.sqlToQuery(value instanceof SQL ? value : (value as { getSQL(): SQL }).getSQL());
    return query.sql;
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}
```

- [ ] **Step 4: Implement describeDrizzle**

Key rules, in order:

1. Tables: `Object.values(module).filter((v) => v instanceof PgTable)`; enums: `isPgEnum`.
2. PK: `cfg.primaryKeys[0]` if present, else the columns with `column.primary` — normalise to one
   table-level `{ name, columns }`.
3. Columns: `sqlType: column.getSQLType()`, `notNull`, `default: renderSql(column.default)`,
   `identity` from `column.generatedIdentity` (null when absent), `generated` from
   `column.generated` (`{ expression: renderSql(g.as), stored: true }`).
4. **Unsupported**, each with `blocksExport: true`: `column.defaultFn !== undefined` →
   `{ kind: 'default-fn', where: '<table>.<column>' }`; `column.onUpdateFn !== undefined` →
   `{ kind: 'on-update', … }`; any export that is a `Relations` instance → `{ kind: 'relations' }`.
   **Never** infer either from `hasDefault`.
5. FKs: `fk.reference()` → local `columns`, `getTableConfig(foreignTable).name`/`.schema`,
   `foreignColumns`; `fk.onDelete`/`fk.onUpdate`; name from `fk.getName()`.
6. Indexes: `idx.config` → `{ name, unique, only, method, where: renderSql(where) }`; each column is
   either a real column (`name`, plus `indexConfig` for `order`/`nulls`/`opClass`) or an expression
   (`isExpression: true`, `expression: renderSql(col)`).
7. `groups` is passed in by the caller (Task 8 reads `SCHEMA_GROUPS`), not discovered here — this
   keeps `describeDrizzle` a pure function of its inputs and testable without `@tickets/db`.

- [ ] **Step 5: Add a Node test project**

`src/node/**` must run in the `node` environment, not `jsdom`. In `apps/eer/vitest.config.ts`, add a
second project (or an `environmentMatchGlobs` entry) mapping `src/node/**` → `node`.

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @tickets/eer vitest run src/node`
Expected: PASS — in particular "never reports a serial column as a runtime default".

- [ ] **Step 7: Prove it against the real schema**

Add `describe-drizzle.real.test.ts` (Node project), importing `@tickets/db`'s schema barrel:

```ts
import * as schema from '../../../../../packages/db/src/schema/index';

it('describes the real 18-table schema with no unsupported constructs', () => {
  const d = describeDrizzle(schema as Record<string, unknown>, []);
  expect(d.tables).toHaveLength(18);
  expect(d.enums).toHaveLength(3);
  expect(d.unsupported).toEqual([]);   // no relations/$defaultFn/$onUpdate in this repo
  expect(d.tables.flatMap((t) => t.columns).filter((c) => c.sqlType === 'serial')).toHaveLength(16);
});
```

Run: `pnpm --filter @tickets/eer vitest run src/node`
Expected: PASS. If `unsupported` is non-empty, the detector is wrong — fix it, do not relax the test.

- [ ] **Step 8: Commit**

```bash
git add apps/eer/src/node apps/eer/vitest.config.ts
git commit -m "feat(eer): read a drizzle schema by introspection; defaultFn detected directly, never inferred from hasDefault"
```

---

## Task 5: Import — description → model, merged

**Files:**
- Create: `apps/eer/src/engine/model/import-drizzle/import-drizzle.ts` + `index.ts` + `import-drizzle.test.ts`

**Interfaces:**
- Consumes: `SchemaDescription` (Task 4), model types (Task 2).
- Produces: `importDrizzle(desc: SchemaDescription, existing: Model | null): { model: Model; report: ImportReport }`. `ImportReport`/`ChangeRow` exactly as the spec defines.

**Rules:**

- Identity is `(schema, name)`. Entity id = `name` when schema is null/`public`, else `schema.name`.
- **Merge, don't clobber.** For a table already in the model, keep its `group`, position, `label`,
  `description`, per-column `title`/`description`, and any colour override keyed by its id. Replace
  only the SQL facts (columns, constraints, indexes, schema).
- New tables land in the zone `SCHEMA_GROUPS` puts them in; a table in no group lands in a zone
  `ungrouped` (created if missing). On a **first** import (`existing === null`) the zones are seeded
  from `desc.groups`, with `model.colors` taking each group's hex.
- Tables in the model but not in the description go in `report.removedTables`. `importDrizzle`
  returns the model **with them removed** — the caller (the modal) only applies the result when the
  user confirms, so the dry run is the report and Apply is the consent.
- `report.blocksExport` is true when any unknown column type or any `unsupported` entry exists.

- [ ] **Step 1: Write the failing tests**

```ts
it('seeds zones and colours from the description on a first import', () => {
  const { model } = importDrizzle(DESC, null);
  expect(model.groups.map((g) => g.id)).toEqual(['workspace', 'structure']);
  expect(model.colors.get('workspace')).toBe('#7aa2ff');
});

it('preserves zone, position, colour and column titles on re-import', () => {
  const first = importDrizzle(DESC, null).model;
  first.entityById.get('users')!.group = 'structure';
  first.entityById.get('users')!.columns[0]!.title = 'ID';
  const moved = new Map(first.colors).set('users', '#ff0000');

  const { model } = importDrizzle(DESC_WITH_EXTRA_COLUMN, { ...first, colors: moved });

  const users = model.entityById.get('users')!;
  expect(users.group).toBe('structure');          // not reset to the SCHEMA_GROUPS default
  expect(users.columns[0]!.title).toBe('ID');     // UI-only data survives
  expect(model.colors.get('users')).toBe('#ff0000');
  expect(users.columns).toHaveLength(DESC_WITH_EXTRA_COLUMN.tables[0]!.columns.length);
});

it('reports added, changed and removed tables with their canvas effect', () => {
  const before = importDrizzle(DESC, null).model;
  const { report } = importDrizzle(DESC_MINUS_POSTS, before);
  expect(report.removedTables).toEqual([
    { table: 'posts', detail: expect.any(String), canvasEffect: expect.stringContaining('leave the canvas') },
  ]);
});

it('blocks export when a column type is unknown', () => {
  const { report } = importDrizzle(DESC_WITH_LEGACY_MONEY, null);
  expect(report.unknownTypes).toEqual([{ table: 'orders', column: 'amount', type: 'legacy_money' }]);
  expect(report.blocksExport).toBe(true);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @tickets/eer vitest run src/engine/model/import-drizzle`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**, then re-run.

Build the model by producing raw JSON in the file shape and handing it to `loadModel` — that reuses
all normalisation and derivation (relationships come from FK constraints for free) instead of
duplicating it.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @tickets/eer test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/eer/src/engine/model/import-drizzle
git commit -m "feat(eer): import a drizzle schema into the model, merging zones/colours/titles and reporting the diff"
```

---

## Task 6: Export — model → drizzle TypeScript

**Files:**
- Create: `apps/eer/src/engine/model/export-drizzle/export-drizzle.ts` + `index.ts` + `export-drizzle.test.ts`

**Interfaces:**
- Consumes: model types (Task 2), `parseType`/`descriptorFor` (Task 1).
- Produces: `exportDrizzle(model: Model): string`.

**Rules:**

- Emit `pgEnum` declarations first, then one `pgTable` per entity in model order.
- Column: `<builder>('<name>'<, options>)`, then `.notNull()`, `.default(sql\`…\`)`,
  `.generatedAlwaysAs(sql\`…\`)`, `.array()` per dimension. **Never** guess a JS literal — every
  default goes through `` sql`…` ``.
- **Escaping:** a default/CHECK/predicate may contain a backtick or `${`. Escape both:
  `` s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') ``.
- Timestamp and date columns are emitted with `mode: 'string'` — the repo's house style. This does
  not change SQL, so the gate is unaffected.
- Table-level second argument: `primaryKey`, `unique(...).on(...)` (`.nullsNotDistinct()` when set),
  `foreignKey({...}).onDelete(...).onUpdate(...)`, `check(...)`, `index/uniqueIndex(...).on(...)`
  with `.using()`, `.where()` and per-column `.asc()/.desc()/.nullsFirst()/.nullsLast()/.op()`.
- Constraint names are emitted **verbatim** from the model (they were captured at import); never
  re-derive them.
- `exportDrizzle` **throws** if any column type is unknown or any unsupported construct is recorded
  — export is blocked, per spec.

- [ ] **Step 1: Write the failing tests** — one per construct, plus escaping:

```ts
it('escapes a default containing a backtick or a template hole', () => {
  const src = exportDrizzle(modelWithDefault("concat('`', ${'$'}{x})"));
  expect(src).toContain('\\`');
  expect(src).toContain('\\${');
});

it('throws rather than exporting a model with an unknown type', () => {
  expect(() => exportDrizzle(modelWithUnknownType)).toThrow(/legacy_money/);
});
```

- [ ] **Step 2: Run to verify they fail.** Run: `pnpm --filter @tickets/eer vitest run src/engine/model/export-drizzle`

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Write the `loadGeneratedModule` test helper**

Create `apps/eer/src/test/helpers/load-generated-module.ts` (Node-project only — it touches the
filesystem, so it must never be imported from a jsdom test):

```ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Writes generated drizzle source to a temp .ts and imports it, so a test can
// introspect the REAL module the exporter produced rather than trust its text.
// Vitest transpiles the import, so this also proves the file parses.
export async function loadGeneratedModule(source: string): Promise<Record<string, unknown>> {
  const dir = await mkdtemp(join(tmpdir(), 'eer-gen-'));
  const file = join(dir, 'schema.generated.ts');
  await writeFile(file, source, 'utf8');
  try {
    return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, unknown>;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 5: Stand the gate up early, on a small fixture**

Create `apps/eer/src/test/fixtures/tiny-schema.ts` — a hand-written two-table drizzle schema (one
enum, a composite FK with `ON DELETE CASCADE`, a partial unique index, a CHECK, a `serial` PK) — and
assert the round-trip in `export-drizzle.test.ts`. This test lives in the **Node** vitest project.

```ts
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';

it('round-trips a two-table schema through drizzle-kit with an empty migration', async () => {
  const original = await import('../../../test/fixtures/tiny-schema');
  const { model } = importDrizzle(describeDrizzle(original, []), null);

  const regenerated = await loadGeneratedModule(exportDrizzle(model));

  const migration = await generateMigration(
    await generateDrizzleJson(original),
    await generateDrizzleJson(regenerated),
  );
  expect(migration).toEqual([]);   // Postgres cannot tell the two schemas apart
});
```

- [ ] **Step 6: Run the tests.** Expected: PASS, empty migration.

- [ ] **Step 7: Commit**

```bash
git add apps/eer/src/engine/model/export-drizzle apps/eer/src/test/fixtures apps/eer/src/test/helpers
git commit -m "feat(eer): export the model as drizzle TypeScript; proven by an empty drizzle-kit migration"
```

---

## Task 7: The gate — the real 18-table schema

**Files:**
- Create: `apps/eer/src/test/gate/roundtrip.gate.test.ts`

**Interfaces:** consumes everything above.

- [ ] **Step 1: Write the gate**

```ts
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { expect, it } from 'vitest';

import * as realSchema from '../../../../../packages/db/src/schema/index';
import { describeDrizzle } from '../../node/describe-drizzle';
import { importDrizzle } from '../../engine/model/import-drizzle';
import { exportDrizzle } from '../../engine/model/export-drizzle';

it('round-trips @tickets/db with nothing lost', async () => {
  const before = describeDrizzle(realSchema as Record<string, unknown>, []);
  const { model, report } = importDrizzle(before, null);

  expect(report.blocksExport).toBe(false);
  expect(model.entities).toHaveLength(18);
  expect(model.enums).toHaveLength(3);

  const source = exportDrizzle(model);
  const regenerated = await loadGeneratedModule(source);   // temp .ts + tsc + import

  // Gate A — our canonical descriptor
  const after = describeDrizzle(regenerated, []);
  expect(after).toEqual(before);

  // Gate B — drizzle-kit's own opinion
  const migration = await generateMigration(
    await generateDrizzleJson(realSchema),
    await generateDrizzleJson(regenerated),
  );
  expect(migration).toEqual([]);
});

it('the generated file typechecks', async () => {
  const source = exportDrizzle(importDrizzle(describeDrizzle(realSchema as Record<string, unknown>, []), null).model);
  const dir = await mkdtemp(join(tmpdir(), 'eer-tsc-'));
  const file = join(dir, 'schema.generated.ts');
  await writeFile(file, source, 'utf8');

  const { status, stdout } = spawnSync(
    'npx',
    ['tsc', '--noEmit', '--strict', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck', file],
    { encoding: 'utf8', shell: true },
  );

  expect(stdout).toBe('');       // tsc prints errors to stdout
  expect(status).toBe(0);
});
```

**Importing the real schema:** `apps/eer` has no dependency on `@tickets/db`, and the package root
(`src/index.ts`) is import-unsafe (it pulls `client.ts` and `environment.ts`). Import the schema
**barrel** by relative path, as the snippet above does. If `tsc` rejects the cross-package relative
import, add a `@tickets/db-schema` path alias to `apps/eer/tsconfig.json` and the matching `resolve.alias`
in `vite.config.ts` / `vitest.config.ts` — do **not** add a runtime dependency on `@tickets/db`, and
do **not** import the package root.

- [ ] **Step 2: Run it.** Expected: FAIL first (that is the point — it names every remaining gap).

- [ ] **Step 3: Fix until green.** Every failure here is a real loss of fidelity. Fix the transform,
never the assertion.

- [ ] **Step 4: Commit**

```bash
git add apps/eer/src/test/gate
git commit -m "test(eer): the round-trip gate — @tickets/db imports, exports and re-imports identically"
```

---

## Task 8: Dev-server routes

**Files:**
- Modify: `apps/eer/vite-plugins/models-api.ts` (or a sibling `drizzle-api.ts` registered alongside it)

**Interfaces:**
- Produces: `GET /api/drizzle/schema?module=<path>` → `SchemaDescription`; `POST /api/drizzle/export` `{ filename, source }` → writes the file, returns its path.

**Rules (spec, *Reader / writer boundary*):**

- Dev only. The production build must have no filesystem surface.
- Import path is request-supplied but **must** resolve inside the workspace root and end in `.ts`;
  default `packages/db/src/schema/index.ts`. Load it with `server.ssrLoadModule`. A module that
  throws returns **422** with the message — never a crash.
- The route reads `SCHEMA_GROUPS` from `@tickets/db` and passes it to `describeDrizzle` as `groups`,
  resolving each group's Instrument colour *name* to hex (unknown name → the default palette).
- Export writes **only** inside `apps/eer/exports/`: sanitise the filename, write atomically, never
  escape the directory, never touch `packages/db`.

- [ ] **Step 1: Write the failing tests** — path containment (`../../etc/passwd` → 400), non-`.ts`
  (→ 400), a module that throws (→ 422), a happy path returning 18 tables, and an export write that
  lands in `apps/eer/exports/` and rejects a traversing filename.

- [ ] **Step 2: Run to verify they fail.** Run: `pnpm --filter @tickets/eer vitest run vite-plugins`

- [ ] **Step 3: Implement, run, commit**

```bash
git add apps/eer/vite-plugins
git commit -m "feat(eer): dev routes to read a drizzle schema and write an exported one"
```

---

## Task 9: Rewrite the seed

**Files:**
- Modify: `apps/eer/models/items-platform.json`
- Modify: `apps/eer/src/test/seed-equivalence.test.ts`

**Background:** the seed has **two columns typed bare `"enum"`** (`users.kind`, `fields.type`) which
no alias can rescue — after Task 1 they are unknown types. Their documented values are in their
`description` fields: `human | agent` and `string | number | boolean | date | datetime | option |
user | json`.

- [ ] **Step 1: Extend the equivalence test first**

```ts
it('the seed has no unknown types and no bare "enum" columns', () => {
  const { model, warnings } = loadModel(seed);
  expect(warnings.filter((w) => /unknown type/.test(w))).toEqual([]);
  for (const e of model!.entities) {
    for (const c of e.columns) expect(c.type).not.toBe('enum');
  }
});

it('declares the enums its columns use', () => {
  const { model } = loadModel(seed);
  expect(model!.enums.map((e) => e.name)).toEqual(['user_kind', 'field_type']);
});
```

The existing equivalence assertions (41 relationships, 18 labels, 3 m2m, 140 titles, badges) stay
exactly as they are — they are what proves the rewrite changed nothing else.

- [ ] **Step 2: Run to verify they fail.** Run: `pnpm --filter @tickets/eer vitest run src/test/seed-equivalence`

- [ ] **Step 3: Rewrite the seed:** declare `enums`, point the two columns at them, alias every
  legacy type name (`int` → `integer`, `timestamptz` → `timestamp with time zone`), and migrate
  index columns to the object shape.

- [ ] **Step 4: Run the full suite.** Expected: PASS, including every pre-existing equivalence assertion.

- [ ] **Step 5: Commit**

```bash
git add apps/eer/models apps/eer/src/test
git commit -m "feat(eer): seed declares its enums and uses drizzle-canonical type names"
```

---

## Task 10: Table modal — tabs

**Files:**
- Create: `apps/eer/src/components/editor/tabs.tsx` + `tabs.test.tsx`
- Modify: `apps/eer/src/components/editor/table-modal.tsx` + `table-modal.test.tsx`

**UI spec:** frames 1a–1c. One wide modal, three tabs — Columns / Constraints / Indexes — each with
a mono count. Active tab: 2px `blue-400` underline. A tab whose content has errors shows a **red
count** instead. Switching tabs never loses unsaved edits. Footer is unchanged: destructive Delete
far left, Save right.

- [ ] **Step 1: Write the failing tests**

```ts
it('keeps unsaved edits when switching tabs', async () => {
  renderTableModal({ id: 'users' });
  await userEvent.type(screen.getByLabelText('Column 1 name'), '_x');
  await userEvent.click(screen.getByRole('tab', { name: /constraints/i }));
  await userEvent.click(screen.getByRole('tab', { name: /columns/i }));
  expect(screen.getByLabelText('Column 1 name')).toHaveValue('id_x');
});

it('surfaces an error count on the tab that owns the error', async () => {
  renderTableModal({ id: 'users' });
  await duplicateAColumnName();
  await userEvent.click(screen.getByRole('tab', { name: /constraints/i }));
  expect(screen.getByRole('tab', { name: /columns/i })).toHaveTextContent('1');
  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
});
```

- [ ] **Step 2–5:** run (FAIL) → implement `Tabs` as a `role="tablist"` with `aria-selected` (state
  lives in `TableModalForm`, so drafts are untouched by tab switches) → run (PASS) → commit.

```bash
git commit -m "feat(eer): table editor is tabbed — columns / constraints / indexes, with error counts"
```

---

## Task 11: The type picker

**Files:**
- Create: `apps/eer/src/components/editor/type-picker.tsx` + `type-picker.test.tsx`
- Modify: `apps/eer/src/components/editor/type-cell.tsx` (becomes the trigger + param inputs)

**UI spec:** frame 1d. Anchored under the type cell, 672px wide, same surface as the modal. Three
fixed columns of built-in groups. A filter field matching name *and* group. Current value = blue
row; keyboard cursor = `gray-700` fill. **Enums in their own violet section at the bottom, never
mixed into built-ins.** Parameterised types advertise their signature — `(p,s)`, `(n)`, `(d)` — and
grow inline param inputs in the row after picking. `↑↓` moves, `⏎` picks, `esc` closes. Type is
**only ever picked, never typed**. An unknown type pins to the top, red and unselectable.

- [ ] **Step 1: Write the failing tests**

```ts
it('never offers a type drizzle cannot build', () => {
  renderPicker();
  for (const absent of ['bytea', 'box', 'varbit']) {
    expect(screen.queryByRole('option', { name: absent })).toBeNull();
  }
});

it('lists model enums in their own section', () => {
  renderPicker({ enums: [{ name: 'user_kind', values: ['human', 'agent'], schema: null }] });
  expect(within(screen.getByRole('group', { name: /enums in this model/i }))
    .getByRole('option', { name: 'user_kind' })).toBeInTheDocument();
});

it('grows param inputs after picking a parameterised type', async () => {
  const onChange = vi.fn();
  renderCell({ value: 'text', onChange });
  await pick('numeric');
  await userEvent.type(screen.getByLabelText('p'), '10');
  await userEvent.type(screen.getByLabelText('s'), '2');
  expect(onChange).toHaveBeenLastCalledWith('numeric(10,2)');
});

it('makes a type an array with the [] control, and back', async () => {
  const onChange = vi.fn();
  renderCell({ value: 'text', onChange });
  await userEvent.click(screen.getByRole('checkbox', { name: '[]' }));
  expect(onChange).toHaveBeenLastCalledWith('text[]');
});

it('pins an unknown type at the top, red and unselectable', () => {
  renderCell({ value: 'legacy_money' });
  const opt = screen.getByRole('option', { name: /legacy_money/ });
  expect(opt).toHaveAttribute('aria-disabled', 'true');
});
```

- [ ] **Step 2–5:** run (FAIL) → implement → run (PASS) → commit. Delete the old custom-mode ref
hack in `type-cell.tsx` wholesale; there is no free-text path any more.

```bash
git commit -m "feat(eer): type picker — filterable, grouped, enums separate, params inline, no free text"
```

---

## Task 12: Constraints and indexes tabs

**Files:** Modify `constraints-editor.tsx`, `indexes-editor.tsx`, `column-multi-select.tsx`, `columns-grid.tsx` (+ their tests)

**UI spec:** frames 1b, 1c, 1e, 1f.

- Constraint cards on `gray-900`, `gray-600` border, 10px radius. Kind badge mono uppercase; **only
  FOREIGN KEY is blue** — it is the card that draws an edge (say so inline).
- Name inputs show the name Postgres would generate, **greyed**, when blank (`orders_pkey`,
  `orders_number_key`, `orders_total_check`); typing overrides.
- Column chips are **numbered in pick order** and never re-sorted — order is semantic in a composite
  key.
- UNIQUE carries a `NULLS NOT DISTINCT` checkbox.
- Indexes: per-column `ASC`/`DESC` (blue) and `NULLS FIRST`/`LAST`; method select
  (btree · hash · gin · gist · brin); `WHERE` takes a raw SQL predicate and makes the index partial,
  showing "— full index" greyed when empty. The UNIQUE checkbox here builds a unique *index* — the
  caption must say which one you are making.
- Errors render **at the mistake**: red border on the offending input, an 11px mono message inside
  the card, red-tinted chips when the chips are the problem (FK arity). Save shows a mono count
  naming where the errors are.
- **Refusal** (frame 1f): deleting a column another table's FK targets is *refused*, not confirmed.
  The strip appears under the row, names `order_items.order_items_customer_fk` exactly, and links to
  open that table. `validateInboundReferences` (already in `apply-model-edit`) is the engine side;
  this is its UI.

- [ ] **Step 1: Write the failing tests** — one per bullet, including:

```ts
it('refuses to delete a column another table s FK targets, naming the constraint', async () => {
  renderTableModal({ id: 'users' });                      // projects.owner_id → users.id
  await userEvent.click(screen.getByRole('button', { name: 'Delete column id' }));
  expect(screen.getByText(/projects\.projects_owner_id_users_id_fk/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();   // nothing changed
});

it('keeps composite key chips in pick order', async () => {
  renderConstraintsEditor({ columns: ['a', 'b', 'c'] });
  await pickColumns(['c', 'a']);
  expect(chipOrder()).toEqual(['c', 'a']);               // not ['a','c']
});
```

- [ ] **Step 2–5:** run (FAIL) → implement → run (PASS) → commit.

```bash
git commit -m "feat(eer): constraints and indexes tabs — pick-order chips, generated names, refusals at the mistake"
```

---

## Task 13: Model settings — the enum manager

**Files:** Modify `model-modal.tsx`; create `enums-editor.tsx` (+ tests)

**UI spec:** frames 2a, 2b. 448px. Enum cards reuse the constraint-card surface. Values are
**numbered chips in DDL order** — drag to reorder, `×` removes, dashed adder appends. Renaming an
enum renames it everywhere. Deleting one that is in use is **refused**, listing every dependent
`table.column` in red mono ("2 columns use it: `orders.status`, `shipments.status`").

- [ ] **Step 1: Write the failing tests**

```ts
it('renaming an enum re-points every column that uses it', async () => {
  renderModelModal();
  await renameEnum('user_kind', 'actor_kind');
  await save();
  expect(model().entityById.get('users')!.columns.find((c) => c.name === 'kind')!.type).toBe('actor_kind');
});

it('refuses to delete an enum in use and names the dependents', async () => {
  renderModelModal();
  await userEvent.click(screen.getByRole('button', { name: 'Delete enum user_kind' }));
  expect(screen.getByText(/users\.kind/)).toBeInTheDocument();
  expect(model().enums.map((e) => e.name)).toContain('user_kind');   // still there
});
```

- [ ] **Step 2–5:** run (FAIL) → implement on top of Task 3's `renameEnum`/`deleteEnum`/`enumRefsTo`
→ run (PASS) → commit.

```bash
git commit -m "feat(eer): enum manager in model settings — ordered values, cascading rename, refused delete"
```

---

## Task 14: Import and export modals

**Files:** create `import-modal.tsx`, `export-modal.tsx` (+ tests); modify `editor-modals.tsx`, `add-chooser.tsx` / top bar to open them

**UI spec:** frames 3a, 4a. Both wide (1024).

- **Import is always a dry run.** Module path + Re-scan, then a report: counts, then `+ ADDED` /
  `~ CHANGED` / `− REMOVED` rows with fixed-width mono badges, each saying **what it means on the
  canvas** ("draws a new card + edge", "its card and 2 edges leave the canvas"). Constructs that
  cannot be reproduced are listed in a yellow section and **block export** — the wording is
  "cannot be reproduced — resolve before exporting", *not* "kept verbatim" (we cannot preserve what
  we cannot see; see the spec). `Apply import` is a normal primary — the report is the safety.
- **Export:** target path, a preview of the generated file (a `gray-950` well, 12px mono, the one
  sanctioned inner horizontal scroll), `Write file`. Export is **disabled** with the reason shown
  when the model has an unknown type or an unreproducible construct.

- [ ] **Step 1: Write the failing tests**

```ts
it('applies nothing until Apply is pressed', async () => {
  renderImportModal();
  await scan();
  expect(model().entities).toHaveLength(22);      // unchanged — the seed
  await userEvent.click(screen.getByRole('button', { name: /apply import/i }));
  expect(model().entities).toHaveLength(18);
});

it('blocks export when a column type is unknown, and says why', async () => {
  renderExportModal({ model: modelWithUnknownType });
  expect(screen.getByRole('button', { name: /write file/i })).toBeDisabled();
  expect(screen.getByText(/legacy_money/)).toBeInTheDocument();
});
```

- [ ] **Step 2–5:** run (FAIL) → implement → run (PASS) → commit.

```bash
git commit -m "feat(eer): import dry-run report and export preview modals"
```

---

## Task 15: Verify end to end, then document

**Files:** modify `apps/eer/README.md` (or `docs/`), update `CLAUDE.md` if the dev commands change

- [ ] **Step 1: Full check**

```bash
pnpm --filter @tickets/eer test && pnpm --filter @tickets/eer typecheck && pnpm --filter @tickets/eer build
```

Expected: all green, including the gate.

- [ ] **Step 2: Drive the real app** (see the `running-the-stack` skill for ports; eer dev is
  `pnpm --filter @tickets/eer dev`)

Walk it and record the result of each: import `packages/db/src/schema/index.ts` → the report lists 18
tables → Apply → 18 cards render in the `SCHEMA_GROUPS` zones with 0 console errors → open `tickets`,
switch all three tabs, save unchanged → the model is byte-identical → change a column to an enum
type and tick `[]` → save → reload → it survived → Export → the preview shows the generated file →
Write → the file lands in `apps/eer/exports/`.

- [ ] **Step 3: Document** the round-trip in the app's README: what is in scope, what blocks export,
  and the fact that export writes to `apps/eer/exports/` and never to `packages/db`.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(eer): document the drizzle round-trip, its scope and its export block"
```

---

## Self-review notes

- **Spec coverage:** contract/gate → T6, T7. Reader → T4. Transforms → T5, T6. Routes/boundary → T8.
  Model growth → T2. Preserve-through-edit → T3 (and the fixed-point assertion is re-run in T15's
  walk). Catalogue + picker → T1, T11. Unresolved state → T5 (report), T6 (export throws), T14 (UI).
  Seed → T9. UI spec → T10–T14.
- **Risk order is deliberate:** the fatal detector bug is fixed and *proven against the real schema*
  in T4, and the gate mechanism is exercised on a two-table fixture in T6 — before the 18-table gate
  in T7 and before any UI work. If the round-trip is impossible, we learn it in T6, not in T14.
