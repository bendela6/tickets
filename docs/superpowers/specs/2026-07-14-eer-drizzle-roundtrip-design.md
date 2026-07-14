# EER ↔ drizzle: a lossless round-trip

**Date:** 2026-07-14 · **Status:** design, awaiting approval · **App:** `apps/eer`

## The ask

> "I have to be able to translate a drizzle table to our UI and the UI to drizzle without any gap."

Today `apps/eer` models tables as columns + constraints + indexes, and the type picker offers a
hand-written list of 21 Postgres types plus a free-text `custom…` escape hatch. The escape hatch is
the symptom: the model's vocabulary is *approximately* Postgres, so nothing guarantees a diagram can
be turned into a drizzle schema, or vice versa.

This design replaces "approximately Postgres" with a **checkable round-trip contract** against
drizzle, and deletes `custom…` on the way.

## The contract

One gate test defines "no gap". Against the repo's real schema (`packages/db`, **18 tables, 3
enums**):

```
@tickets/db schema  ──import──▶  Model  ──export──▶  schema.generated.ts
                                                            │
                                                        re-import
                                                            ▼
        assert deepEqual(describe(original), describe(regenerated))
        assert drizzleKitSql(original) === drizzleKitSql(regenerated)
```

Equality is **semantic, not textual**. `serial().primaryKey()` (inline) and a table-level
`primaryKey({ columns: [id] })` produce the same database; the model normalises to table-level
constraints, so a regenerated file is not byte-identical to a hand-written one. What must be
identical is what reaches Postgres.

Anything the model cannot hold is **reported at import, never silently dropped** (see *Scope*).

## Why introspection, not parsing

Drizzle ships `getTableConfig()`, which returns a table's resolved columns, primary keys, unique
constraints, checks, foreign keys and indexes. Verified against `packages/db`: it yields SQL types,
`notNull`, defaults (as `sql` chunks such as `now()`), named composite uniques, named FKs with
`onDelete`/`onUpdate`, and btree indexes. `isPgEnum` + `enumValues` yield the enums.

So the drizzle → UI direction needs **no TypeScript parsing at all**. We load the schema module and
introspect the objects it exports. The UI → drizzle direction is code generation, and the gate test
above is what keeps the generator honest.

`packages/db/src/schema/index.ts` is import-safe (no client, no env access) — the package root
(`src/index.ts`) is not, because it pulls in `client.ts`. The reader targets the schema barrel.

## What the model must grow

The current `Column` (name/type/nullable/default/title/description) and `Constraint`
(pk/unique/check/fk) get us most of the way. To reach SQL truth the model adds:

| Addition | Why |
| --- | --- |
| `Entity.schema` | drizzle's `pgSchema('x').table(...)` namespace (the real schema is all `public`, but the model must be able to say so) |
| `Column.identity` | `GENERATED ALWAYS/BY DEFAULT AS IDENTITY` |
| `Column.generated` | `GENERATED ALWAYS AS (expr) STORED` |
| arrays | carried in the type string as Postgres prints it: `text[]`, `integer[2]` |
| `Model.enums` | the JSON twin of `pgEnum(name, values)` |
| `UniqueConstraint.nullsNotDistinct` | changes uniqueness semantics under NULLs |
| `TableIndex.method` / `.where` / per-column ordering / expression columns | `USING gin`, partial indexes, `DESC NULLS LAST`, `lower(email)` |

Defaults stay **SQL text** (`now()`, `'{}'::jsonb`). The importer flattens drizzle's `sql` chunk
objects to text; the exporter re-emits them as `sql\`…\`` (or a plain literal when the default is one).

**Constraint names are captured, not re-derived.** Drizzle auto-names
`comment_reactions_comment_id_comments_id_fk`; the importer records the resolved name so export
reproduces it exactly and migrations don't churn.

## The transforms

Two pure engine modules, unit-testable with no DOM and no drizzle import:

- `engine/model/import-drizzle` — `(SchemaDescription, Model | null) → { model, report }`
- `engine/model/export-drizzle` — `Model → string` (drizzle TypeScript source)

Only a thin **reader** touches drizzle on the Node side: a dev-server route in
`apps/eer/vite-plugins/` that `ssrLoadModule`s the schema path, walks the exports with
`getTableConfig` / `isPgEnum`, and returns a plain-JSON `SchemaDescription`. Export writes a `.ts`
file the user reviews before committing — it never overwrites hand-written schema files unprompted.

The type catalogue is the one place `drizzle-orm` is imported **in the browser**: `engine/model/pg-types`
enumerates `pg-core`'s column builders and reads each one's `getSQLType()`. Measured cost: 87 KB
minified (~25 KB gzip), zero Node builtins. `getSQLType()` alone doesn't say which types take
parameters or how to group them (an unparameterised `bit` returns `bit(undefined)`), so each builder
is paired with a small annotation (group + param arity). A test asserts **every builder drizzle
exports is annotated** — a drizzle upgrade that adds a type turns the suite red instead of leaving a
silent gap in the picker.

## Re-import merges; it does not clobber

The diagram holds things drizzle has no home for: zones, colours, positions, column titles and
descriptions, authored edge labels. Import therefore **merges into the existing model**, matched by
table name and column name:

- unchanged tables keep zone, colour, position, titles, descriptions, labels;
- new tables are reported and land in a default zone;
- vanished tables are **reported, not deleted** — removal stays the user's call.

`packages/db/src/schema/schema-groups.ts` already assigns every table to a group with a label and a
colour. A first import seeds the diagram's zones from it.

## The type picker (the original complaint)

- Catalogue = drizzle's builders (~32 types), grouped, with inline params (`varchar(255)`, `numeric(10,2)`).
- Declared enums appear as their own group.
- An `[]` checkbox makes any type an array.
- **`custom…` is deleted.** A type in a file that nothing recognises loads with a warning, keeps its
  string (no silent rewrite), and renders in the picker as an invalid selection the user must fix
  before saving. This also lets `type-cell.tsx` drop the custom-mode workaround that previously ate
  typed text.
- `load-model` gains an alias map so existing files keep working: `int`/`int4` → `integer`,
  `int8` → `bigint`, `bool` → `boolean`, `decimal` → `numeric`, `timestamptz` →
  `timestamp with time zone`, `serial4` → `serial`, and so on.
- The seed (`models/items-platform.json`) is rewritten once into drizzle-canonical names. The existing
  `seed-equivalence.test.ts` fixture proves no relationship, cardinality, label, badge or title moved.

## Scope

**In:** tables, columns, constraints (pk/unique/check/fk with actions), indexes, enums, namespaces,
identity and generated columns, arrays.

**Out, but reported at import:** views, materialised views, sequences, RLS policies, roles, and
TS-only sugar that never reaches SQL — `relations()`, `$type<Foo>()`, `.$defaultFn()`, `.$onUpdate()`.
`.$defaultFn()` is detectable (`hasDefault` with no `default`); `$type` is compile-time only and
invisible at runtime, so it is documented as unrepresentable rather than detected.

The gate test asserts the real schema needs none of these. The day it does, the user gets a report
line — not a silent loss.

## Testing

1. **Gate** — the round-trip above, over all 18 tables and 3 enums, asserting `getTableConfig`
   deep-equality and identical drizzle-kit SQL.
2. **Generated file typechecks** — `tsc` over `schema.generated.ts` as part of the test, so the
   generator can't emit code that merely looks right.
3. **Pure unit tests** for both transforms: every construct in the table above, plus arrays, partial
   indexes, `nullsNotDistinct`, composite FKs with actions, identity columns.
4. **Merge tests** — re-import preserves zones/colours/positions/titles; new and removed tables are
   reported.
5. **Catalogue drift test** — every drizzle builder is annotated.
6. **Alias + unknown-type tests** — legacy files load; an unknown type warns and survives untouched.
7. **E2E** — pick an enum type, tick `[]`, save, reload; import the real schema and see the zones.

## Risks

- **Drizzle's introspection API is not a stability contract.** `getTableConfig` is exported but its
  shape can shift between minors. The gate test is the tripwire: a drizzle bump that changes the
  shape fails loudly.
- **Browser-side `drizzle-orm` import.** 87 KB minified is real weight in a diagram app. Accepted
  deliberately (the alternative — codegen with a drift test — was considered and declined).
- **Semantic, not textual, equality.** A regenerated schema file will not diff cleanly against a
  hand-written one. Export writes to a review path; adopting it as the source of truth is a separate
  decision, not part of this work.

## Types

Every named type used above, defined here.

```ts
// ---- the model (existing, with this design's additions marked +) ----

type FkAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';

interface Column {
  name: string;
  type: string;              // SQL text as Postgres prints it: 'varchar(255)', 'text[]'
  nullable: boolean;
  default: string | null;    // SQL text: "now()", "'{}'::jsonb"
  title?: string | null;        // UI-only: shown on the card
  description?: string | null;  // UI-only
  identity?: Identity | null;   // +
  generated?: Generated | null; // +
}

interface Identity { always: boolean }                    // +
interface Generated { expression: string; stored: true }  // + Postgres only has STORED

type Constraint =
  | { id: string; kind: 'pk'; name: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name: string | null; columns: string[];
      nullsNotDistinct?: boolean }                                        // +
  | { id: string; kind: 'check'; name: string | null; expression: string }
  | { id: string; kind: 'fk'; name: string | null; columns: string[]; refTable: string;
      refColumns: string[]; onDelete: FkAction | null; onUpdate: FkAction | null };

interface IndexColumn {                                   // +
  expression: string;                                     // a column name, or raw SQL
  isExpression: boolean;
  order?: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

interface TableIndex {
  id: string;
  name: string;
  columns: IndexColumn[];                                 // + (was string[])
  unique: boolean;
  method?: string;                                        // + 'btree' | 'gin' | ...
  where?: string | null;                                  // + partial-index predicate SQL
}

interface Entity {
  id: string;
  label: string;
  group: string;             // UI-only: the zone it sits in
  schema?: string | null;    // + Postgres namespace; null/absent = public
  columns: Column[];
  constraints: Constraint[];
  indexes: TableIndex[];
  color?: string | null;     // UI-only
  x?: number; y?: number;    // UI-only
}

interface EnumDecl { name: string; values: string[] }     // +

interface Model {
  meta: { title: string; description?: string };
  view: { routing: 'avoid' | 'direct' };
  groups: Group[];           // UI-only: zones and subgroups
  entities: Entity[];
  enums: EnumDecl[];         // +
  relationships: Relationship[];  // derived from fk constraints; see derive-relationships
}

interface Group { id: string; label: string; parent?: string | null; order: number; color?: string | null }

interface Relationship {
  id: string;                // 'rel:<entityId>:<constraintId>' for derived edges
  source: string; target: string;
  sourceField?: string; targetField?: string;
  cardinality: '1-1' | '1-n' | 'n-m';
  label?: string;
  kind?: string;
}

// ---- the wire format between the Node-side reader and the pure transforms ----

interface SchemaDescription {
  tables: TableDescription[];
  enums: EnumDecl[];
  unsupported: UnsupportedConstruct[];
}

interface TableDescription {
  name: string;
  schema: string | null;
  columns: ColumnDescription[];
  primaryKey: { name: string | null; columns: string[] } | null;
  uniques: { name: string; columns: string[]; nullsNotDistinct: boolean }[];
  checks: { name: string; expression: string }[];
  foreignKeys: {
    name: string; columns: string[]; refTable: string; refColumns: string[];
    onDelete: FkAction | null; onUpdate: FkAction | null;
  }[];
  indexes: { name: string; columns: IndexColumn[]; unique: boolean; method: string; where: string | null }[];
}

interface ColumnDescription {
  name: string;
  sqlType: string;           // straight from drizzle's getSQLType()
  notNull: boolean;
  default: string | null;    // sql chunks flattened to text
  identity: Identity | null;
  generated: Generated | null;
}

interface UnsupportedConstruct {
  kind: 'view' | 'materialized-view' | 'sequence' | 'policy' | 'role' | 'default-fn' | 'relations';
  where: string;             // 'comments.body' or 'ticketRelations'
  detail: string;            // what it is, and what happens on export
}

// ---- import result ----

interface ImportReport {
  addedTables: string[];
  changedTables: string[];
  removedTables: string[];   // reported, NOT deleted
  unsupported: UnsupportedConstruct[];
}

// ---- the type catalogue ----

type PgTypeGroup = 'numeric' | 'text' | 'temporal' | 'boolean' | 'uuid' | 'json'
                 | 'binary' | 'network' | 'geometric' | 'vector';

interface PgType {
  name: string;              // the SQL name drizzle's getSQLType() reports
  builder: string;           // the drizzle pg-core export it came from
  group: PgTypeGroup;
  params: 0 | 1 | 2;         // varchar(n) = 1, numeric(p,s) = 2
}

interface ParsedType {
  base: string;
  params: string[];
  array: boolean;            // + trailing '[]'
  known: boolean;            // + false = unknown type; picker shows it as invalid
}
```
