# EER ↔ drizzle: a lossless round-trip

**Date:** 2026-07-14 · **Revision:** 3 (amended after Grok + Sol validation, then reconciled with the UI spec) · **Status:** design, awaiting approval · **App:** `apps/eer`

## The ask

> "I have to be able to translate a drizzle table to our UI and the UI to drizzle without any gap."

Today `apps/eer` models tables as columns + constraints + indexes, and the type picker offers a
hand-written list of 21 Postgres types plus a free-text `custom…` escape hatch. The escape hatch is
the symptom: the model's vocabulary is *approximately* Postgres, so nothing guarantees a diagram can
become a drizzle schema, or the reverse.

This design replaces "approximately Postgres" with a **checkable round-trip contract** against
drizzle, and deletes `custom…` on the way.

Revision 2 fixes a fatal detector bug, names the concrete gate APIs, and closes the
under-specification the two validation passes found. Every runtime claim below was verified against
the installed **drizzle-orm 0.45.2** and the real `packages/db` schema; the probe results are quoted
inline.

## The contract

One gate test defines "no gap". Against the repo's real schema (`packages/db`, **18 tables, 3
enums**):

```
@tickets/db schema  ──import──▶  Model  ──export──▶  schema.generated.ts
        │                                                    │
        └──────────────── both sides ────────────────────────┘
                              ▼
   A. deepEqual(describe(original), describe(regenerated))      ← our canonical descriptor
   B. generateMigration(snapshot(original), snapshot(regen)) === []   ← drizzle-kit's own opinion
```

Both gates are concrete, verified APIs:

- **A** is a canonical descriptor we write (`describe()`, below). Raw `getTableConfig` output cannot
  be deep-equalled — it contains functions and back-references to table objects.
- **B** uses `drizzle-kit/api`, which is installed and exports
  `generateDrizzleJson`, `generateMigration`, `upPgSnapshot` (verified). An empty migration between
  the two snapshots means Postgres cannot tell them apart. No live database, no CLI scraping.

Equality is **semantic, not textual**. `serial().primaryKey()` (inline) and a table-level
`primaryKey({ columns: [id] })` produce the same database; the model normalises to table-level
constraints, so a regenerated file is not byte-identical to a hand-written one. What must be
identical is what reaches Postgres.

### `describe()` — the canonical descriptor

One function, used on both sides of the gate. It must:

- render every SQL fragment (defaults, CHECK bodies, generated expressions, index predicates and
  expression columns) through the same pg dialect, so `sql` chunk objects become stable text;
- preserve order where order is semantic — composite key columns, FK column pairs, index columns,
  enum values;
- sort where order is not — tables, constraints, indexes (by name);
- cover schemas, enums, identity options, generated expressions, all constraints and the full index
  configuration;
- exclude functions and object identity.

## Why introspection, not parsing

Drizzle ships `getTableConfig()`, which returns a table's resolved columns, primary keys, unique
constraints, checks, foreign keys and indexes; `isPgEnum` yields the enums. Verified against
`packages/db`: SQL types, `notNull`, defaults (as `sql` chunks such as `now()`), named composite
uniques, a `nullsNotDistinct` unique (`status_transitions_edge`), a CHECK (`ticket_links_no_self`),
a partial unique index (`ticket_values_single`), and named FKs with `onDelete`/`onUpdate`.

So drizzle → UI needs **no TypeScript parsing**. We load the schema module and introspect the
objects it exports. UI → drizzle is code generation, and the gate above is what keeps the generator
honest.

`packages/db/src/schema/index.ts` is import-safe (no client, no env). The package root
(`src/index.ts`) is not — it pulls in `client.ts`. The reader targets the schema barrel.

## Runtime-default detection (the bug revision 1 had)

Revision 1 said `.$defaultFn()` is detectable as "`hasDefault` with no `default`". **That is wrong**,
and it would have failed the gate on day one. Probe, `users.id`, declared `serial().primaryKey()`:

```
hasDefault: true   default: undefined   defaultFn: undefined   columnType: 'PgSerial'
```

`@tickets/db` has **16 serial columns**. The revision-1 heuristic would have reported all of them as
unsupported runtime defaults.

**The rule:** inspect `column.defaultFn` and `column.onUpdateFn` directly — both exist on the column
object and are `undefined` unless `.$defaultFn()` / `.$onUpdate()` was called. A column whose default
comes from its *type* (`serial`, `bigserial`, `smallserial`), from an identity, or from a generated
expression is never a runtime default. `UnsupportedConstruct.kind` therefore carries both
`default-fn` and `on-update`.

## Schema-qualified identity

Names alone are ambiguous once `pgSchema()` is in play. Database-object identity is **`(schema,
name)`** throughout:

- `Entity.schema` and `EnumDecl.schema` (drizzle's enum object exposes a `schema` field — verified);
- foreign keys carry `refSchema` alongside `refTable`;
- re-import matches tables by `(schema, name)`, not by name;
- an entity's model id is `name` when the schema is null/`public` (keeps every existing model file
  working) and `schema.name` otherwise.

## What the model must grow

| Addition | Why |
| --- | --- |
| `Entity.schema`, `EnumDecl.schema`, FK `refSchema` | schema-qualified identity |
| `Column.identity` | `GENERATED ALWAYS/BY DEFAULT AS IDENTITY`, with drizzle's full sequence options |
| `Column.generated` | `GENERATED ALWAYS AS (expr) STORED` |
| array **dimensions** | `text[]`, `integer[2]`, `integer[2][]` — a boolean cannot hold this |
| `Model.enums` | the JSON twin of `pgEnum(name, values)` |
| `UniqueConstraint.nullsNotDistinct` | changes uniqueness under NULLs; the real schema uses it |
| `TableIndex.method` / `.where` / `.only` / per-column `order`, `nulls`, `opClass` / expression columns | exactly the SQL-affecting fields `getTableConfig` exposes (verified keys: `name, columns, unique, only, method, where`; per-column: `name, keyAsName, type, indexConfig`) |

Anything drizzle can express that this list omits is **out of scope and reported at import** — never
silently dropped. Gate test B is what proves the omissions don't matter for the real schema.

> Note on the validation feedback: Sol listed index `concurrently` and `with` as SQL-affecting fields
> we must model. They are **not** exposed by `getTableConfig` in 0.45.2 — the config keys are
> `name, columns, unique, only, method, where`. `opClass` and column ordering live per-column inside
> `indexConfig`. We model what is exposed; the gate catches anything we got wrong.

## SQL text is SQL text

Every SQL fragment — defaults, CHECK bodies, generated expressions, index predicates, expression
index columns — is stored as **rendered SQL text**, produced by the reader through the pg dialect.

Export always re-emits them through `` sql`…` ``, escaping backticks and `${`. Revision 1 said the
exporter would "emit a plain literal when the default is one"; that is unimplementable, because once
flattened to a string you cannot distinguish the SQL literal `'x'` from a JS string default, a
number, or JSON. One representation, one emission path, no guessing.

## Constraint names are captured, not re-derived

Drizzle auto-names `comment_reactions_comment_id_comments_id_fk`. The importer records the resolved
name so export reproduces it exactly and migrations don't churn.

## The UI

**Spec of record:** the Claude Design doc *EER Modal Spec* (project `dc519bc9-8288-4ed6-bdd5-70d53ac8622d`),
18 frames: table editor (columns / constraints / indexes / type picker), its states (validation,
refusal, empty, 45-column scroll, unknown type), model settings + enum manager, import report, export
preview, and the three small modals.

Load-bearing decisions taken from it:

- The table editor is **one wide (1024px) modal with three tabs** — Columns / Constraints / Indexes —
  each showing a mono count. Errors aggregate onto the tab as a red count, so nothing hides behind an
  inactive tab. Switching tabs never loses unsaved edits.
- The modal takes its **natural height and the backdrop scrolls** (already shipped, commit `0ece040`).
  The only sanctioned inner scroll is horizontal, on a wide table or the export preview.
- Composite-key column chips are **numbered in pick order** and never re-sorted — order is semantic.
- Constraint name inputs show the name Postgres would generate, greyed, until overridden.
- FOREIGN KEY is the only blue-badged constraint card: it is the one that draws a canvas edge.
- Type is **only ever picked, never typed**. Enums sit in their own violet section, never mixed into
  the built-ins. An unknown type pins to the top of the picker, red and unselectable.
- Refusals (deleting an FK-targeted column, deleting an in-use enum) appear **under the thing you
  touched**, name the exact table/constraint, and link to it — they are refusals, not warnings.
- Enum values are numbered, draggable chips (DDL order is semantic). **Renaming an enum cascades** to
  every column pointing at it.
- Import is always a **dry run**: a report of added / changed / removed, applied only on confirm.

Four corrections to the design, each verified against drizzle 0.45.2 (see *The type catalogue*):

1. The picker's `box`, `path`, `polygon`, `circle` and `varbit` **do not exist as drizzle builders** —
   nor does `bytea`, which the *current* catalogue offers. They cannot round-trip and are dropped.
2. The picker is **missing `serial` / `bigserial` / `smallserial`**, which is what 16 columns of the
   real schema use. They are added.
3. The report's "kept verbatim — re-emitted on export unchanged" promise is **not implementable** for
   `$type<Foo>()`: it is compile-time only and invisible to `getTableConfig`. That section becomes
   *"cannot be reproduced — resolve before exporting"* and blocks export (below).
4. Export writes a review file, not `packages/db/src/schema` (below).

The design shows no affordance for identity columns, index `ONLY`, or per-column `opClass`. That is
accepted: they are covered by *Preserve-through-edit*, not by an editor.

## Unresolved state (removed tables, unknown types)

Revision 1 contradicted itself: it kept vanished tables in the model *and* exported the whole model —
so the next export would resurrect them. The UI spec resolves this better than revision 2 did: since
import is a dry run with an explicit **Apply**, the report *is* the consent.

- A table the import no longer finds is listed under **− REMOVED**, with what it costs on the canvas
  ("its card and 2 edges leave"). Apply deletes it. Cancel changes nothing. There is no stale state.
- A column type nothing recognises loads with a warning and keeps its string verbatim (no silent
  rewrite), and renders in the picker as an **invalid** selection.
- **Saving the model JSON is always allowed.** Unresolved state is not a reason to lose work.
- **Exporting to drizzle is blocked** while any unknown type or unreproducible construct exists. The
  export button says which.
- The import report separates *informational* (added / changed / removed) from *export-blocking*
  (unknown type, unreproducible construct).

## Preserve-through-edit (the highest-risk rule)

The table modal rebuilds constraints and indexes from editor drafts. Every field the UI does not
author — `where`, `only`, `method`, `opClass`, `nullsNotDistinct`, `identity`, `generated`, captured
constraint names — must survive an open-and-save untouched.

This is the failure mode this codebase has hit repeatedly (edges losing labels, constraints being
regenerated from stale hints). It gets a dedicated regression test: import the real schema, open and
save every table's modal unchanged, and assert `describe(model)` is a fixed point across three
round-trips.

Authoring UI for these fields is a **later** decision. The contract for this work is: **import
preserves them, edit does not destroy them, export emits them.**

## The transforms

Two pure engine modules — no DOM, no drizzle import, unit-testable:

- `engine/model/import-drizzle` — `(SchemaDescription, Model | null) → { model, report }`
- `engine/model/export-drizzle` — `Model → string` (drizzle TypeScript source)

Only a thin **reader** touches drizzle on the Node side: a dev-server route in
`apps/eer/vite-plugins/` that `ssrLoadModule`s the schema path, walks the exports with
`getTableConfig` / `isPgEnum`, renders SQL chunks to text, and returns a plain-JSON
`SchemaDescription`.

`SchemaDescription` carries **group metadata** (`SCHEMA_GROUPS` from `packages/db`: key, label,
colour, member tables), because the pure importer has no other way to reach it — revision 1 promised
zone seeding the declared transform could not perform. Tables in no group land in a default
`ungrouped` zone. `SCHEMA_GROUPS` colours are Instrument colour *names* (`indigo`, `teal`); the
reader resolves them to hex, falling back to the palette when a name is unknown.

### Reader / writer boundary (dev only)

- Routes exist only under `vite dev`; the production build has no filesystem surface.
- Import path: request-supplied, but **must** resolve inside the workspace root and end in `.ts`;
  default `packages/db/src/schema/index.ts`. A module that fails to load returns a 422 with the
  error, not a crash.
- Export path: confined to `apps/eer/exports/`, filename sanitised, written atomically, overwrite
  only within that directory. Export never writes to `packages/db`.

## The type catalogue

`apps/eer` gains a **declared** `drizzle-orm` dependency (it is imported directly in browser code and
in the vite middleware; relying on workspace hoisting is not acceptable). Measured browser cost of
`pg-core`: 87 KB minified (~25 KB gzip), zero Node builtins.

Builder discovery is deterministic: `getPgColumnBuilders()` returns exactly **32** builders
(verified). It is *not* exported from `drizzle-orm/pg-core` — the import path is
`drizzle-orm/pg-core/columns/all`. (Grok's validation named the wrong path; the count and the
`customType` observation were right.)

Policy:

- **`customType` is excluded** — it is a meta-factory, not a SQL type.
- **`decimal` is not in the registry** (it is an alias export of `numeric`); it lives in the alias map.
- Multi-word SQL names (`timestamp with time zone`, `double precision`) are the catalogue's canonical
  names. The picker may *display* the shorthand (`timestamptz`, `timetz`) — display name and stored
  SQL name are separate fields on the descriptor.
- **The registry is the whole picker.** A type drizzle cannot build cannot round-trip, so it is not
  offered. That removes `bytea` (in today's catalogue) and `box` / `path` / `polygon` / `circle` /
  `varbit` (in the UI spec's picker) — none of them are drizzle builders in 0.45.2. It adds the
  `serial` family, which the UI spec omitted and 16 columns of the real schema use.

A builder's SQL name is only readable from a *built column*, so each builder gets a **descriptor**
that says how to instantiate it, how to parse its SQL text back to parameters, and how to emit it as
TypeScript. Arity alone (`params: 0 | 1 | 2`) is not enough: `timestamp(3) with time zone`,
`interval day to second(3)`, vector dimensions and geometry modes all have their own grammar.

A **drift test** asserts every builder in the registry has a descriptor — a drizzle upgrade that adds
a type turns the suite red rather than leaving a silent hole in the picker.

## The type picker (the original complaint)

- Catalogue = the descriptors above, grouped, with inline params.
- Declared enums appear as their own group.
- Array dimensions are authored with an `[]` control (sized and nested dimensions supported).
- **`custom…` is deleted.** `type-cell.tsx` drops the custom-mode workaround that previously ate
  typed text.
- `load-model` gains an alias map: `int`/`int4` → `integer`, `int8` → `bigint`, `bool` → `boolean`,
  `decimal` → `numeric`, `timestamptz` → `timestamp with time zone`, `serial4` → `serial`, …
- **Index columns migrate** from `string[]` to `IndexColumn[]` at load, the way `fields` → `columns`
  migrated: `["ticket_id"]` → `[{ expression: "ticket_id", isExpression: false }]`. The indexes
  editor, `apply-model-edit` and `serialize-model` move with it.
- The seed (`models/items-platform.json`) is rewritten once. It has **two columns typed bare
  `"enum"`** (`users.kind`, `fields.type`) which no alias can rescue — the rewrite declares real
  model enums from their documented values (`human | agent`, `string | number | …`) and points the
  columns at them. `seed-equivalence.test.ts` proves no relationship, cardinality, label, badge or
  title moved.

## Scope

**In:** tables, columns, constraints (pk/unique/check/fk with actions), indexes (method, partial,
ordering, opClass, expressions), enums, namespaces, identity and generated columns, arrays.

**Out, reported at import, and export-blocking:** views, materialised views, sequences, RLS policies,
roles, and TypeScript-only sugar that never reaches SQL — `relations()`, `$type<Foo>()`,
`.$defaultFn()`, `.$onUpdate()`. We do not pretend to preserve what we cannot see: rather than
re-emitting them "verbatim" (impossible for `$type`, which is compile-time only), the import reports
them and **export is blocked** until they are resolved. That keeps "no gap" literally true — we never
write a file that lost something.

`defaultFn` / `onUpdateFn` are detected directly on the column object. `$type` and `mode: 'string'`
are invisible at runtime and are documented as unrepresentable rather than detected.

Verified: the real schema contains **no** `relations()`, `$type`, `$defaultFn`, `$onUpdate` or
`generatedAlwaysAs` — the only TS-only sugar is `mode: 'string'` on 23 timestamps, which the export
house style below reproduces. So this list is empty for `@tickets/db` today.

**Export house style** (does not affect SQL, so the gate is unaffected): timestamp and date columns
are emitted with `mode: 'string'`, matching the repo's existing convention.

## Relationship to existing code

`packages/db` already has `describeSchema()` — a deliberately thin introspection feeding the web
app's `/schema` ERD. It stays. The eer reader is the full-fidelity one; the two are **not** merged,
and neither depends on the other. This is a conscious duplication of ~30 lines of `getTableConfig`
walking, in exchange for the ERD page not being coupled to the editor's model.

This design **supersedes §9 of `2026-07-13-eer-real-db-modelling-design.md`**, which YAGNI'd index
methods, partial and expression indexes, namespaces, generated columns and DDL export. Under a
round-trip contract they are no longer optional.

## Testing

1. **Gate A + B** — the round-trip above, over all 18 tables and 3 enums.
2. **Generated file typechecks** — `tsc` over `schema.generated.ts` inside the test, so the generator
   cannot emit code that merely looks right.
3. **Preserve-through-edit** — open+save every table unchanged; `describe(model)` is a fixed point
   across three round-trips.
4. **Pure unit tests** for both transforms: every construct in the table above, plus sized/nested
   arrays, partial indexes, `nullsNotDistinct`, composite FKs with actions, identity, generated.
5. **Merge tests** — re-import preserves zones, colours, positions, titles; added / changed / removed
   tables are reported; Cancel changes nothing, Apply deletes the removed ones.
6. **Catalogue drift test** — every builder in `getPgColumnBuilders()` has a descriptor, and the
   picker offers nothing outside the registry (the `bytea` / `box` / `varbit` regression).
7. **Alias + unknown-type tests** — legacy files load; an unknown type warns, survives untouched, and
   blocks export.
8. **Escaping tests** — a default/CHECK/predicate containing a backtick or `${` generates valid TS.
9. **Enum rename cascades** — renaming an enum re-points every column using it; deleting one that is
   in use is refused, naming the dependent columns.
10. **E2E** — import the real schema, see the zones; pick an enum type, make it an array, save, reload.

## Risks

- **`getTableConfig` is not a stability contract.** Its shape can shift between drizzle minors. Gate
  B (drizzle-kit's own snapshot) is the tripwire, and it fails loudly.
- **Browser-side `drizzle-orm`.** 87 KB minified in a diagram app, accepted deliberately; the
  alternative (codegen + drift test) was considered and declined.
- **Semantic, not textual, equality.** A regenerated file will not diff cleanly against a
  hand-written one. Export writes to a review path; adopting generated output as the source of truth
  is a separate decision, not part of this work.
- **Scope.** This is a large piece of work: model migration (index columns), a new reader, two
  transforms, a rewritten catalogue, a seed rewrite, and new UI. It should be planned as phases with
  the gate test standing up early against a small hand-built fixture, not left to the end.

## Types

The runtime model lives in `apps/eer/src/engine/model/types/types.ts`. This section gives the
**accurate current shape of every type this design touches**, with additions marked `+`, followed by
the wire and report types in full.

```ts
// ---- existing types this design changes (verbatim shape, + = new field) ----

type RoutingMode = 'curved' | 'avoid' | 'ortho';
type Cardinality = '1-1' | '1-n' | 'n-1' | 'n-m';
type LineStyle = 'solid' | 'dashed';
type FkAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';

interface Column {
  name: string;
  type: string;                  // SQL text as Postgres prints it: 'varchar(255)', 'integer[2][]'
  title: string | null;          // UI-only, shown on the card
  description: string | null;    // UI-only
  nullable: boolean;
  default: string | null;        // rendered SQL text: "now()", "'{}'::jsonb"
  identity: Identity | null;     // +
  generated: Generated | null;   // +
}

interface Identity {                          // + drizzle's full sequence option set
  always: boolean;
  name: string | null;
  increment: string | null;
  minValue: string | null;
  maxValue: string | null;
  startWith: string | null;
  cache: string | null;
  cycle: boolean | null;
}

interface Generated { expression: string; stored: true }   // + Postgres only has STORED

type Constraint =
  | { id: string; kind: 'pk'; name: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name: string | null; columns: string[];
      nullsNotDistinct: boolean }                                          // +
  | { id: string; kind: 'check'; name: string | null; expression: string }
  | { id: string; kind: 'fk'; name: string | null; columns: string[];
      refSchema: string | null;                                            // +
      refTable: string; refColumns: string[];
      onDelete: FkAction | null; onUpdate: FkAction | null };

interface IndexColumn {          // + (index columns were `string[]`)
  expression: string;            // a column name, or raw SQL when isExpression
  isExpression: boolean;
  order: 'asc' | 'desc' | null;
  nulls: 'first' | 'last' | null;
  opClass: string | null;
}

interface TableIndex {
  id: string;
  name: string;
  columns: IndexColumn[];        // + (was string[])
  unique: boolean;
  method: string | null;         // + 'btree' | 'gin' | 'gist' | 'hash' | 'brin'
  only: boolean;                 // + ONLY, as exposed by getTableConfig
  where: string | null;          // + partial-index predicate, rendered SQL text
}

interface Entity {
  id: string;                    // `name`, or `schema.name` when schema is not public
  label: string;
  group: string;                 // UI-only: the zone it sits in
  description: string | null;
  schema: string | null;         // + null = public
  columns: Column[];
  constraints: Constraint[];
  indexes: TableIndex[];
  x: number; y: number; _w: number; _h: number;   // layout fills these
}

interface EnumDecl { name: string; values: string[]; schema: string | null }   // +

interface Model {
  meta: { title?: string; description?: string };
  view: { zoom: number; routing: RoutingMode };
  kinds: EdgeKind[];
  kindStyle: Map<string, LineStyle>;
  colors: ReadonlyMap<string, string>;   // id → hex; zones and entities both live here
  _savedLayout?: SavedLayout;
  groups: Group[];
  entities: Entity[];
  entityById: Map<string, Entity>;
  enums: EnumDecl[];                     // +
  relationships: Relationship[];         // derived from fk constraints
  relById: Map<string, Relationship>;
  _groupBounds: GroupBounds[];
  _content: { w: number; h: number };
}

interface Group { id: string; label: string; order: number; parent: string | null }
interface EdgeKind { id: string; label: string; style: LineStyle }

interface Relationship {
  id: string;                    // 'rel:<entityId>:<constraintId>' for derived edges
  source: string; sourceField: string;
  target: string; targetField: string;
  cardinality: Cardinality;
  cardinalityInferred: boolean;
  kind: string | null;
  label: string | null;
}

interface GroupBounds { id: string; label: string; x: number; y: number; w: number; h: number;
                        parent: string | null; level: number }
interface SavedLayout {
  entities: Map<string, { x: number; y: number }>;
  groups: Map<string, { x: number; y: number; w: number; h: number }>;
}

// ---- wire format: Node-side reader → pure transforms ----

interface SchemaDescription {
  tables: TableDescription[];
  enums: EnumDecl[];
  groups: SchemaGroupDescription[];      // from SCHEMA_GROUPS, colours resolved to hex
  unsupported: UnsupportedConstruct[];
}

interface SchemaGroupDescription { key: string; label: string; color: string; tables: string[] }

interface TableDescription {
  schema: string | null;
  name: string;
  columns: ColumnDescription[];
  primaryKey: { name: string | null; columns: string[] } | null;
  uniques: { name: string; columns: string[]; nullsNotDistinct: boolean }[];
  checks: { name: string; expression: string }[];
  foreignKeys: { name: string; columns: string[]; refSchema: string | null; refTable: string;
                 refColumns: string[]; onDelete: FkAction | null; onUpdate: FkAction | null }[];
  indexes: { name: string; columns: IndexColumn[]; unique: boolean; method: string | null;
             only: boolean; where: string | null }[];
}

interface ColumnDescription {
  name: string;
  sqlType: string;               // straight from a built column's getSQLType()
  notNull: boolean;
  default: string | null;        // sql chunks rendered to text through the pg dialect
  identity: Identity | null;
  generated: Generated | null;
}

interface UnsupportedConstruct {
  kind: 'view' | 'materialized-view' | 'sequence' | 'policy' | 'role'
      | 'default-fn' | 'on-update' | 'relations';
  where: string;                 // 'comments.body' or 'ticketRelations'
  detail: string;                // what it is, and what happens on export
  blocksExport: boolean;
}

// ---- import result ----

interface ImportReport {
  addedTables: ChangeRow[];
  changedTables: ChangeRow[];
  removedTables: ChangeRow[];    // deleted on Apply — the report is the consent
  unknownTypes: { table: string; column: string; type: string }[];
  unsupported: UnsupportedConstruct[];   // cannot be reproduced; blocks export
  blocksExport: boolean;
}

interface ChangeRow {
  table: string;
  detail: string;                // '+2 columns (gift, gift_message) · total numeric(12,2) → numeric(10,2)'
  canvasEffect: string;          // 'draws a new card + edge' | 'its card and 2 edges leave the canvas'
}

// ---- the type catalogue ----

type PgTypeGroup = 'numeric' | 'text' | 'temporal' | 'boolean' | 'uuid' | 'json'
                 | 'binary' | 'network' | 'geometric' | 'vector';

interface PgTypeDescriptor {
  builder: string;               // the getPgColumnBuilders() key it came from
  sqlName: string;               // 'timestamp with time zone', 'double precision'
  group: PgTypeGroup;
  params: PgTypeParam[];         // ordered; drives both the picker's inputs and emission
  emit(params: string[], arrays: ArrayDimension[]): string;   // → drizzle TS source
  parse(sqlText: string): string[] | null;                    // SQL text → params, null if no match
}

interface PgTypeParam { name: string; kind: 'int' | 'enum' | 'text'; options?: string[] }

interface ArrayDimension { size: number | null }   // integer[2][] → [{size:2},{size:null}]

interface ParsedType {
  base: string;
  params: string[];
  arrays: ArrayDimension[];
  known: boolean;                // false = unknown type: invalid in the picker, blocks export
}
```
