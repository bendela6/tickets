# EER editor — real DB modelling (columns, constraints, indexes)

**Date:** 2026-07-13 · **App:** `apps/eer` · **Status:** approved (spec of record)

Replaces the field-level `role: 'pk'|'fk'|null` heuristic with an actual relational schema:
columns describe themselves, **constraints** describe the table, and everything the diagram
shows (badges, edges, cardinality) is **derived** from them. Types become a picker.

Supersedes the fk-field derivation contract from
`docs/superpowers/specs/2026-07-13-eer-model-editor-design.md` (§A3).

---

## 1. Why

`role` is not a database concept — it is a drawing hint. Today it is load-bearing across edge
derivation, cardinality inference, PK/FK badges, port colours and the self-checks, which means the
editor cannot express things every real schema has: composite keys, multi-column FKs, `UNIQUE`,
`CHECK`, `NOT NULL`, defaults, `ON DELETE`, indexes. Locked decisions:

| Decision | Choice |
|---|---|
| Constraint fidelity | **Table-level, composite** — PK / FK / UNIQUE / CHECK as objects with column lists |
| Type picker | **Postgres catalogue + params + `custom…` escape hatch** |
| Indexes | **name + columns + unique** (no method / partial / expression — YAGNI) |
| Legacy models | **Normalise on load (permanent) + rewrite the seed once** |
| FK shortcut in the column grid | **None** — an edge is created by adding a FOREIGN KEY constraint |

## 2. Model

```ts
interface Column {                    // was Field
  name: string;
  type: string;                       // "int" | "varchar(255)" | "numeric(10,2)" | custom
  nullable: boolean;                  // default true; NOT NULL when false
  default: string | null;             // raw SQL text, e.g. "now()", "0", "'draft'"
  title: string | null;               // preserved verbatim (see model-editor spec)
  description: string | null;
}

type Constraint =
  | { id: string; kind: 'pk';     name: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name: string | null; columns: string[] }
  | { id: string; kind: 'check';  name: string | null; expression: string }
  | { id: string; kind: 'fk';     name: string | null; columns: string[];
      refTable: string; refColumns: string[];
      onDelete: FkAction | null; onUpdate: FkAction | null };

type FkAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';

interface Index { id: string; name: string; columns: string[]; unique: boolean }

interface Entity { /* …unchanged… */ columns: Column[]; constraints: Constraint[]; indexes: Index[] }
```

`Role`, `Field.role`, `Field.ref`, `Field.refField` are **deleted** from the model. `Entity.fields`
is renamed `Entity.columns` (one mechanical rename; the diagram still calls a row a "field" in the
UI copy where that reads better).

**Blast radius of the rename** (all mechanical, all covered by the existing suite):
`measure-entity` (row count → card height), `field-row` / `entity-cards`, `connected-ports`,
`search-model` (searches column names; `SearchResult.field` keeps its name), `run-checks`,
`entity-detail`, `edge-path` / `end-kinds` (unchanged behaviour — they consume cardinality, not
roles), `apply-model-edit`, `serialize-model`, `load-model`, and the editor components.

Constraint/index `id` is a stable local id (`c1`, `c2`, `i1`) so edits and derived-edge ids are
stable across renames; `name` is the optional SQL name.

## 3. Derivation (replaces the fk-field contract)

**Badges.** A new pure module `engine/model/column-roles/` exports
`columnRoles(entity): Map<string, { pk: boolean; fk: boolean; unique: boolean }>` — a column is
`pk` if it appears in the table's PK constraint, `fk` if it appears in any FK constraint, and
`unique` if it is the sole column of a UNIQUE constraint **or** the sole column of the PK (a
single-column PK is unique by definition). `field-row`, `role-tag`, `entity-detail` and
`measure-entity` consume this instead of `f.role`; **the rendered PK/FK badges and colours do not
change**.

**Edges.** One relationship per FK constraint:

```
id:          rel:<entityId>:<constraintId>          // stable across renames
source:      constraint.refTable                    // the referenced (PK) side
sourceField: constraint.refColumns[0]
target:      entity.id                              // the referencing (FK) side
targetField: constraint.columns[0]
kind:        'fk'
```

A composite FK draws **one** edge anchored on the lead column pair; the detail panel lists the full
column tuple. Hand-authored `relationships[]` in a file are still honoured verbatim for non-FK
kinds (e.g. `n-m` documentation edges); FK-derived edges are regenerated on every edit, so the
"derivable-shaped" heuristic and `is-derivable-shaped.ts` are **deleted** — identity is now
explicit (`rel:<entity>:<constraint>`), which was the root cause of three data-loss bugs in the
previous build.

**Cardinality** (`infer-cardinality`'s role table is deleted):

- FK columns are exactly the referencing table's PK, or are covered by a UNIQUE → **1-1**
- otherwise → **1-n**
- `source === target` → self-loop (unchanged rendering)

## 4. Types

`engine/model/pg-types/` exports the catalogue:

```ts
interface PgType { name: string; group: 'numeric'|'text'|'temporal'|'boolean'|'uuid'|'json'|'binary'; params: 0|1|2 }
export const PG_TYPES: PgType[]        // int, bigint, smallint, serial, bigserial, numeric(p,s),
                                       // real, double precision, text, varchar(n), char(n),
                                       // boolean, timestamptz, timestamp, date, time, interval,
                                       // uuid, json, jsonb, bytea
export function parseType(s: string): { base: string; params: string[]; custom: boolean }
export function formatType(base: string, params: string[]): string
```

The grid's Type cell = `<select>` (grouped by `group`) + one/two param inputs shown only when
`params > 0` + a `custom…` option revealing a free-text input. Storage stays a plain string, so
serialization is unchanged and hand-written files (`citext`, enums, domains) keep loading — they
open in the picker as `custom`.

## 5. Editing UI (table modal)

Three sections, replacing today's single grid:

- **Columns** — name · type(select + params) · nullable (checkbox) · default · note · ↑↓ · ✕ · Add column.
  The Role / Ref-table / Ref-field cells are **removed**.
- **Constraints** — Add PK / UNIQUE / FK / CHECK. Row: kind badge · name (optional) · column
  multi-select (this table's columns) · for FK: target-table select + target-column multi-select +
  ON DELETE / ON UPDATE selects · for CHECK: expression input · ✕.
- **Indexes** — name · column multi-select · unique checkbox · ✕ · Add index.

The modal stays `size="wide"`. A hint line states that a FOREIGN KEY constraint is what draws an
edge.

## 6. Validation

`apply-model-edit` throws user-readable errors (the reducer catches them into `ui.editError`):

- duplicate column names; empty column name
- more than one PK constraint per table
- a constraint/index with an empty column list; a column name that isn't on the table
- FK: unknown `refTable`; unknown `refColumns`; `columns.length !== refColumns.length`
- duplicate constraint names / index names within a table
- CHECK with an empty expression

`run-checks` gains one check, the real Postgres rule: **every FK references a column set covered by
the target's PRIMARY KEY or a UNIQUE constraint** (reported as a problem row, not an exception).

## 7. Migration

`loadModel` normalises legacy files permanently (no version flag needed — the shape is
unambiguous):

- `fields[]` → `columns[]`, dropping `role`/`ref`/`refField`, preserving `name`/`type`/`title`/
  `description`; `nullable` defaults `true`, `default` defaults `null`.
- every field with `role: 'pk'` → one synthesised `{kind:'pk', columns:[…those names in order]}`.
- every field with `role: 'fk'` **and** a `ref` → `{kind:'fk', columns:[field.name],
  refTable: ref, refColumns:[refField ?? 'id'], onDelete:null, onUpdate:null}`.
- a field with a `ref` but no `fk` role (the seed's `outbox.event_id`, a shared-PK reference) →
  the same FK constraint; its PK membership is preserved by the rule above, so it lands as an
  identifying 1-1 FK — which is exactly what it is.
- explicit `relationships[]` that duplicate a derived FK edge are dropped (deduped by
  `(refTable, refColumns) × (table, columns)`), matching the previous build's pair-dedupe.

The seed `apps/eer/models/items-platform.json` is **rewritten once** into the new shape (generated
by running the normaliser + serializer, then committed). Acceptance: its 41 relationships, 18
edge labels and 140 column titles survive with identical meaning — proved by a test that loads the
OLD seed (kept as a test fixture) and the NEW seed and asserts equal derived edges, labels, titles
and badge sets.

## 8. Testing

- `column-roles`, `pg-types` (parse/format roundtrip incl. custom), `derive-relationships`
  (composite, self-loop, 1-1 vs 1-n), legacy-normalisation (each rule above), constraint validation
  (each throw), the new self-check.
- serialize→load roundtrip on the new seed (positions, colours, constraints, indexes, titles).
- Editor: columns grid (type picker with params + custom), constraints editor (FK creates an edge —
  assert the derived relationship appears), indexes editor.
- E2E: new model → 2 tables → composite PK → FK with ON DELETE CASCADE → an index → Save → reload →
  all survive; the diagram shows the edge with the right cardinality.

## 9. Out of scope

Index method/partial/expression; sequences; triggers; views; schemas/namespaces; generated columns;
DDL export (a future `to-sql` module is an obvious follow-on but not part of this).
