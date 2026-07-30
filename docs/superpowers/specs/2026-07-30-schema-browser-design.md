# Live schema browser — design

**Date:** 2026-07-30 · **Status:** locked; two-phase, phase 1 first

`/schema` today renders the schema the *code declares*, not the schema that is *deployed*.
[`apps/api/src/routes/schema.routes.ts`](../../../apps/api/src/routes/schema.routes.ts) says
so outright — "the schema graph is derived from the drizzle table objects, not the
database" — so a pending migration, a hand-applied change, or a drifted environment is
invisible, and the answer is byte-identical for every database on the server. The renderer
is a 299-line imperative `renderErd` with raw `style=` props and its own `erd.css`,
predating the Instrument design system.

Meanwhile `apps/eer` is a mature interactive EER viewer — a pure calculation engine
(geometry, orthogonal routing, deterministic packing, colour inheritance, focus sets,
search) with ~62 tests — that renders a JSON model and is reachable only on its own dev
port, wired to nothing.

This spec does two things: it makes the schema screen read the **real catalog of a
selectable database**, and it replaces the legacy renderer with the eer diagram, moved into
web as a generic module.

## The rule

**The screen shows what is deployed, and the diagram knows nothing about databases.**

Everything follows from that pair. "What is deployed" forces `pg_catalog` introspection
over code introspection, and forces a database selector — a dropdown over a code-derived
graph would be a no-op control. "Knows nothing about databases" forces the diagram to be a
controlled component taking a model prop, which is what keeps it generic and what puts the
selector in the shell rather than the toolbar.

## Two phases

Phase 1 lands the data layer against the **existing** legacy renderer. Phase 2 swaps the
renderer. Each is independently shippable, and if the finished screen looks wrong in phase
2 the data layer is already trusted.

| | Phase 1 — live introspection | Phase 2 — the eer module |
|---|---|---|
| Adds | `introspectDatabase()`, two API routes, database dropdown, sidebar mode | the eer module, the `SchemaGraph → Model` adapter |
| Renders with | the legacy `renderErd` | the eer diagram |
| Deletes | nothing | `erd-engine.ts`, `erd.css`, `apps/eer` |
| Proves | live catalog reads against real databases | the diagram renders the graph the data layer already produces |

---

# Phase 1 — live introspection

## Where introspection lives

`packages/db` owns Postgres access, so `introspectDatabase(name): Promise<SchemaGraph>`
lands there beside `describe-schema.ts`. It returns the **same `SchemaGraph` shape** the
code-derived path returns, which is what lets phase 1 run against the legacy renderer
unchanged and phase 2 swap renderers without touching the data layer.

`describeSchema()` itself stays exactly as it is. It is not dead code: it is the SSOT check
in [`model-conformance.test.ts`](../../../packages/db/src/schema/model-conformance.test.ts).
Only the *route* stops calling it.

It reads `pg_catalog`, never `information_schema` — the catalog exposes index method,
partial-index predicates, and check-constraint expressions that `information_schema` does
not model:

| Fact | Source |
|---|---|
| tables | `pg_class` (`relkind in ('r','p')`) + `pg_namespace` |
| columns, notnull, type, default | `pg_attribute` + `pg_type` + `pg_attrdef` |
| pk / unique / fk / check | `pg_constraint` (`contype in ('p','u','f','c')`) |
| fk actions | `pg_constraint.confdeltype` / `confupdtype` |
| indexes | `pg_index` + `pg_am` (method) + `pg_get_expr` (partial `WHERE`) |
| enums | `pg_type` (`typtype='e'`) + `pg_enum`, ordered by `enumsortorder` |

System namespaces (`pg_*`, `information_schema`) are excluded.

## Grouping is hybrid, and that is deliberate

[`schema-groups.ts`](../../../packages/db/src/schema/schema-groups.ts) is **finer-grained
than Postgres namespaces**, and says so: a hand-listed `tables` entry wins group membership
"regardless of the table's real Postgres schema", so `core.users` renders in WORKSPACE, not
WORKDIRS. Grouping purely by namespace would therefore collapse the curated seven-group
layout into raw namespaces — a visible downgrade for the database we look at most.

So grouping resolves in two steps:

1. a table matching `SCHEMA_GROUPS` takes its curated group, via the already-exported
   `resolveGroupKey` — no second copy of that logic;
2. anything unmatched falls back to **one group per Postgres namespace**, coloured by index
   from the Instrument option hues.

`tickets` and `tickets_dev` render curated; an unrelated database renders by namespace;
neither needs configuration. The fallback also means **a table that exists in the database
but not in the code appears** — in a namespace group rather than vanishing. On a screen
whose whole purpose is showing what is deployed, that drift being visible is a feature.

`GroupMeta.color` stays an Instrument option **hue name** (`'blue'`, `'indigo'`, …), not a
hex. Resolving names to values is the client's job, which is what makes the diagram
theme-aware in phase 2.

## API surface

```
GET /api/schema/databases        → { databases: string[], current: string }
GET /api/schema?database=<name>  → SchemaGraph      (defaults to POSTGRES_DATABASE)
```

`GET /api/schema` keeps its path and payload shape; only its source changes. Web is its
only consumer, so nothing else moves.

Databases are enumerated with
`SELECT datname FROM pg_database WHERE NOT datistemplate AND datallowconn ORDER BY datname`.

### Connection safety

- **The server and credentials are always the configured ones.** `environment.postgres`
  supplies host, port, user, and password; only the *database name* varies. No caller
  supplies a host, a user, a password, or a DSN.
- **The name is validated against the enumerated set before it reaches a connection URL.**
  A caller string is never interpolated into a DSN unchecked — an unknown name is a 400,
  not a connection attempt.
- **Reads only.** Catalog `SELECT`s; the introspector issues no DDL or DML.
- **A short-lived connection per request**, opened and closed around the introspection
  (`max: 1`). A dropdown change is infrequent; per-request connect/close beats a pool cache
  keyed by database that can leak handles.

**Accepted blast radius, stated plainly:** this lets the web UI read the catalog of any
database those credentials can reach on that server, including `tickets` from a dev
browser. That is the API's existing reach, not an escalation — the API process already
holds these credentials. An `SCHEMA_BROWSER_DATABASES` env allowlist is the fence if that
changes; it is deliberately **not** built now.

## The sidebar mode

The rail is a clean registry, so this is small and idiomatic:

- `'schema'` joins the `Mode` union in
  [`mode-for-path.ts`](../../../apps/web/src/components/shell/mode-for-path.ts), with a
  `pathname.startsWith('/schema')` branch;
- an `ITEMS` entry joins
  [`activity-rail.tsx`](../../../apps/web/src/components/shell/activity-rail.tsx) beside
  Tasks / Terminals / Agents / Signals;
- `schema-panel.tsx` follows `signals-panel.tsx`'s shape.

**The database dropdown lives in that panel, not in the diagram's toolbar.** The panel
selects a data source; the diagram receives a model. That separation is what keeps the
phase-2 module generic.

Selection is held in the route search param — `/schema?database=tickets_dev`. The panel
writes it, the route reads it, and the view is deep-linkable and shareable. The param is
absent for the default database rather than being written redundantly.

---

# Phase 2 — the eer module

## Shape and location

A module in web, not a package: **`apps/web/src/components/eer/`**, following web's existing
`components/<subsystem>/` convention (`agent/`, `signals/`, `schema/`, `rich-text/`).

```
apps/web/src/components/eer/
  engine/     ~138 files — pure calculation, unchanged
  state/      7   — DiagramProvider + reducer
  hooks/      5   — use-diagram-gestures
  view/       ~55 — diagram/, detail-panel/, top-bar/, error-banner/, modal/, eer-viewer/
  adapter/    2   — SchemaGraph → Model, plus the mirrored SchemaGraph types
  index.ts
```

~209 files move, ~62 of them tests. `engine/` has no DOM or React imports, so relocation
does not touch it beyond the colour tokens.

A package was considered and rejected. The deciding argument for one was keeping
`@tickets/db` and `drizzle-kit` out of web — but with the round-trip tooling going to
`packages/db` instead (below), web takes **zero** new dependencies either way, and the
package's remaining benefit did not justify the scaffolding.

## Public surface

```tsx
<EerDiagram model={model} />                   // controlled, read-only
schemaGraphToModel(graph: SchemaGraph): Model  // pure adapter
loadModel(raw: unknown): LoadResult            // existing validator, unchanged
```

The route fetches `/api/schema?database=…`, adapts, and passes the model in. The local
mirror of `SchemaGraph` in `erd-types.ts` survives as the adapter's input type, preserving
its "no runtime dependency on the db package" property.

Two integration items that are real work, not incidental:

- `eer-viewer.tsx` uses `flex h-screen`; inside web's shell it must fill its route
  container, not the viewport.
- `use-diagram-gestures` binds wheel-zoom on the viewport and needs containment so it does
  not fight page scroll.

## Read-only: what that removes, and what it does not

The screen renders a live database, which cannot be edited from a diagram, so the editor
goes: 36 files (table/group modals, constraints, indexes, enums editors, the drizzle type
picker) plus `models-client.ts`, the models file API, and `use-model-loader` (the prop
replaces it).

Two things that look droppable are **load-bearing and stay**:

- **`apply-model-edit`** — [`diagram-reducer.ts:215`](../../../apps/eer/src/state/diagram-reducer/diagram-reducer.ts#L215)
  routes every edit through it, and dragging a card *is* a model edit (x/y).
- **`pg-types` + `descriptors`** — pure data with zero imports; `load-model` needs
  `parseType`/`formatType` to normalise column types. Only `pg-types.test.ts` has a runtime
  drizzle import, and that test goes to `packages/db` with the round-trip tooling.

`derive-relationships` mentions `serialize-model` in a comment only — it imports types
alone and is unaffected.

## Theme — adopting the `@tickets/ui` presets

eer's private `@theme` block is deleted. Its ~440 colour-class occurrences remap onto
Instrument's 12-step scale, and because Instrument's `[data-theme]` block flips the
`--ins-*` values, the diagram becomes **light/dark aware** instead of dark-only.

| eer | Instrument | Note |
|---|---|---|
| `bg-gray-950` | `bg-gray-1` | eer's scale is dark-first, Instrument's light-first — a reversal, not a rename |
| `text-gray-50` | `text-gray-12` | primary ink |
| `text-3xs/2xs/xs/sm/base/lg` | `text-9/10/11/12/13/16` | exact px, 1:1; `measure-entity`'s 13/12/11px canvas fonts stay honest |
| `rounded-2xl` | `rounded-xl` | one site; `2xl` is retired in Instrument |
| `GROUP_PALETTE` hex | `var(--color-<hue>-9)` | eight entries |

The palette swap is nearly free because the colour engine is **pure string passthrough**:
[`group-color.ts`](../../../apps/eer/src/engine/colors/group-color/group-color.ts) selects a
string by index and [`color-mix.ts`](../../../apps/eer/src/ui/color-mix.ts) interpolates it
into `color-mix(in srgb, ${color} …)`. Nothing parses hex, so `var(--color-indigo-9)`
substitutes verbatim and the zone → entity → edge inheritance chain keeps working. The same
`--ins-<hue>-9` anchors are already hardcoded in `vite-plugins/drizzle-api.ts`, so this is
adopting an existing mapping, not inventing one.

Landing in `apps/web/src` puts the code inside `@tickets/ui`'s `tokens:verify` ROOTS,
inheriting the radius/border/ring/z ratchets. **`eer-baseline.json` is deleted, not
repointed**: 73 of its 75 entries are the private palette that is going away, and the
remaining two — the dot-grid gradient and `GROUP_PALETTE` — get fixed rather than excused.
`scan-hardcoded-values.mjs`'s `apps/eer` root and `vocabulary.ts`'s "deliberately absent"
comment both go.

eer's own `verify-tailwind.mjs` dissolves with the app. Its rules that the Instrument
ratchet does not already cover — no DOM style API, no CSS-in-JS, no CSSOM injection,
100-char class strings, no fractional spacing steps — are ported into the shared scanner or
dropped, **decided per rule during the sweep and recorded in the plan**, not silently lost.

## The drizzle round-trip goes to `packages/db`

Import/export is dev tooling over the tickets schema, so it goes where that schema lives.
`packages/db` already has `drizzle-orm`, `drizzle-kit`, `tsx`, and `vitest`, and already
owns `describe-schema.ts`. ~19 files: `describe-drizzle`, `render-sql`, `import-drizzle`,
`export-drizzle`, the `pg-types` drift test, and the round-trip gate with its fixtures —
exposed as db scripts rather than vite dev routes.

That also **retires the `ssrLoadModule` arbitrary-code-execution surface** in
`vite-plugins/drizzle-api.ts` rather than relocating it into web's dev server, which
deleting the app would otherwise force.

`describeDrizzle` and `describeSchema` are near-duplicates. Landing them side by side makes
consolidation possible; it is a **follow-up**, not part of this change.

## Files

**Phase 1 — added**

| File | What |
|---|---|
| `packages/db/src/schema/introspect-database.ts` | `pg_catalog` → `SchemaGraph` |
| `packages/db/src/schema/introspect-database.test.ts` | against a real database |
| `packages/db/src/schema/list-databases.ts` | `pg_database` enumeration + name validation |
| `apps/web/src/components/shell/schema-panel.tsx` | the database dropdown |

**Phase 1 — changed:** `apps/api/src/routes/schema.routes.ts` (+ its test),
`packages/db/src/schema/index.ts`, `apps/web/src/components/shell/mode-for-path.ts` (+ its
test), `activity-rail.tsx`, `app-shell.tsx`, `apps/web/src/routes/schema-route.tsx`.

**Phase 2 — moved:** ~209 files `apps/eer/src/{engine,state,hooks,components,ui}` →
`apps/web/src/components/eer/`; ~19 files → `packages/db`.

**Phase 2 — deleted:** `apps/eer` entirely (app shell, both stylesheets, all four configs,
`verify-tailwind.mjs`, the editor, the models API and its seed JSON, the vite plugins);
`apps/web/src/components/schema/erd-engine.ts` + its test, `erd.css`; the `eer` pane in
`mprocs.yaml`; `packages/web/ui/scripts/eer-baseline.json` and its scanner root.

Docker and nginx need no changes — neither references eer; the app was never deployed.

## Verification

| Check | Proves |
|---|---|
| `pnpm --filter @tickets/db test` | introspection against a real database; the round-trip gate still proves losslessness |
| `pnpm --filter @tickets/api test` | both routes, including a rejected unknown database name |
| `pnpm --filter @tickets/web test` | the ~62 moved tests pass unchanged — they assert behaviour, not classes |
| `pnpm verify:tokens` | green with no eer baseline |
| `pnpm typecheck` · `pnpm build` | the workspace after `@tickets/eer` is gone |
| `/schema` driven in a browser | both themes; dropdown switches databases; deep link with `?database=` restores selection |

The moved tests passing **unchanged** is the load-bearing signal for phase 2: if the sweep
had changed behaviour rather than tokens, they would fail.

## Commits

One per task, conventional and scoped. Phase 1: `feat(db)` introspector, `feat(api)`
routes, `feat(web)` dropdown + sidebar mode. Phase 2: `refactor(db)` round-trip tooling,
`refactor(web)` move, `refactor(web)` token sweep, `feat(web)` adapter + route swap,
`chore` delete `apps/eer`, `chore(ui)` retire the baseline.

## Follow-ups (not this change)

- Consolidate `describeDrizzle` and `describeSchema`.
- Diff the code-derived graph against the live one to surface drift explicitly — the
  natural payoff of having both, and a real answer to "is this environment migrated?".
- `SCHEMA_BROWSER_DATABASES` allowlist, if the accepted blast radius stops being acceptable.
- The "Tickets EER" app registration in the Signals collector goes stale; diagram errors
  report under Tickets Web afterward.
- `models/items-platform.json` is checked-in seed data that exists only in git history
  after this change.

## Types

```ts
// The introspection payload. Identical shape from the code-derived and live paths.
type SchemaGraph = { tables: TableMeta[]; groups: GroupMeta[]; enums: EnumMeta[] };

type TableMeta = {
  name: string;
  schema: string | null;   // the Postgres schema; null = public
  group: string;           // GroupMeta.key
  columns: ColumnMeta[];
  primaryKey: string[];
  uniques: UniqueMeta[];
  checks: CheckMeta[];
  indexes: IndexMeta[];
};

type ColumnMeta = {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  // The REFERENCED table's schema, never the referencing table's — an fk
  // routinely crosses schemas (terminal.sessions.workdir_id -> core.workdirs.id).
  fk: { schema: string | null; table: string; column: string } | null;
};

type UniqueMeta = { name: string; columns: string[] };
type CheckMeta = { name: string; expression: string };
type IndexMeta = {
  name: string;
  columns: string[];
  unique: boolean;
  method: string | null;
  where: string | null;
};

// `tables` holds QUALIFIED names (see qualifiedName); `color` is an Instrument
// option hue NAME ('blue', 'indigo', …), resolved to a value by the client.
type GroupMeta = { key: string; label: string; color: string; tables: string[] };
type EnumMeta = { name: string; values: string[]; schema: string | null };

// A table's or enum's identity: bare name in public, `schema.name` otherwise.
function qualifiedName(schema: string | null, name: string): string;

// GET /api/schema/databases
type DatabaseList = { databases: string[]; current: string };

// The diagram's props. `model` is the eer Model produced by schemaGraphToModel.
type EerDiagramProps = { model: Model; className?: string };

// The validator's result; `model` is null when `errors` is non-empty.
interface LoadResult { model: Model | null; errors: string[]; warnings: string[] }
```

The eer diagram model, moving unchanged from
`apps/eer/src/engine/model/types/types.ts` to
`apps/web/src/components/eer/engine/model/types/types.ts`. Underscore-prefixed fields are
derived by layout rather than authored.

```ts
interface Model {
  meta: { title?: string; description?: string };
  view: { zoom: number; routing: RoutingMode };
  kinds: EdgeKind[];
  kindStyle: Map<string, LineStyle>;
  colors: ReadonlyMap<string, string>;  // colour overrides, id → colour string
  _savedLayout?: SavedLayout;           // hand-arranged positions; pack re-applies them
  groups: Group[];
  entities: Entity[];
  entityById: Map<string, Entity>;
  enums: EnumDecl[];
  relationships: Relationship[];
  relById: Map<string, Relationship>;
  _groupBounds: GroupBounds[];
  _content: { w: number; h: number };
}

type RoutingMode = 'curved' | 'avoid' | 'ortho';
type Cardinality = '1-1' | '1-n' | 'n-1' | 'n-m';
type LineStyle = 'solid' | 'dashed';
type FkAction = 'cascade' | 'restrict' | 'set null' | 'set default' | 'no action';

interface Entity {
  id: string;
  label: string;
  group: string;                // Group.id
  description: string | null;
  schema: string | null;        // null = public
  columns: Column[];
  constraints: Constraint[];
  indexes: TableIndex[];
  x: number; y: number;         // layout fills these
  _w: number; _h: number;
}

// Nesting is unbounded — a parent may itself be nested — the chain just has to
// stay acyclic (enforced at load and on edit).
interface Group { id: string; label: string; order: number; parent: string | null }

interface Column {
  name: string;
  type: string;
  title: string | null;
  description: string | null;
  nullable: boolean;
  default: string | null;
  identity: Identity | null;
  generated: Generated | null;
}

interface Identity {
  always: boolean;
  name: string | null;
  increment: string | null;
  minValue: string | null;
  maxValue: string | null;
  startWith: string | null;
  cache: string | null;
  cycle: boolean | null;
}

interface Generated { expression: string; stored: true }  // Postgres only has STORED

// An `fk` constraint is what draws an edge — edges are derived, never authored.
type Constraint =
  | { id: string; kind: 'pk'; name: string | null; columns: string[] }
  | { id: string; kind: 'unique'; name: string | null; columns: string[]; nullsNotDistinct: boolean }
  | { id: string; kind: 'check'; name: string | null; expression: string }
  | {
      id: string;
      kind: 'fk';
      name: string | null;
      columns: string[];
      refSchema: string | null;
      refTable: string;
      refColumns: string[];
      onDelete: FkAction | null;
      onUpdate: FkAction | null;
    };

interface TableIndex {
  id: string;
  name: string;
  columns: IndexColumn[];
  unique: boolean;
  method: string | null;   // 'btree' | 'gin' | 'gist' | 'hash' | 'brin'
  only: boolean;
  where: string | null;    // partial-index predicate, rendered SQL text
}

interface IndexColumn {
  expression: string;      // a column name, or raw SQL when isExpression
  isExpression: boolean;
  order: 'asc' | 'desc' | null;
  nulls: 'first' | 'last' | null;
  opClass: string | null;
}

interface EnumDecl { name: string; values: string[]; schema: string | null }

interface EdgeKind { id: string; label: string; style: LineStyle }

interface Relationship {
  id: string;
  source: string; sourceField: string;
  target: string; targetField: string;
  cardinality: Cardinality;
  cardinalityInferred: boolean;
  kind: string | null;
  label: string | null;
}

interface GroupBounds {
  id: string; label: string;
  x: number; y: number; w: number; h: number;
  parent: string | null;
  level: number;           // nesting depth: 0 = root zone, 1 = subgroup, 2+ deeper
}

interface SavedLayout {
  entities: Map<string, { x: number; y: number }>;
  groups: Map<string, { x: number; y: number; w: number; h: number }>;
}
```
