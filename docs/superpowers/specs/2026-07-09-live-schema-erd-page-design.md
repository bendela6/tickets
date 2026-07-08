# Live Schema ERD Page — Design

**Date:** 2026-07-09 · Branch: `redesign` · Component: `tickets-apps-web` + `tickets-apps-api` + `tickets-packages-db`

## Goal & context

Replace the hand-authored static ER-diagram artifact with a **live page in `apps/web`** whose data is derived from the real drizzle schema, so it never goes stale. The diagram renders the current tables, columns, keys, foreign-key relations, and hand-declared ownership **groups**.

Today the diagram is a self-contained HTML artifact with a JavaScript object literal (`TABLES`/`BANDS`/`GROUPS`) that a human maintains by reading `packages/db/src/schema/*.ts`. It drifts the moment the schema changes (it already lags migration `0007`). This feature makes the diagram a first-class, always-current page.

## Locked decisions

1. **Data source — derive from the drizzle schema at the API.** A new endpoint walks the exported drizzle table objects at runtime (`getTableConfig`) and returns metadata as JSON. No database query; reflects the code schema; auto-syncs with any schema change.
2. **Groups — declared config in code.** A hand-maintained `SCHEMA_GROUPS` map co-located with the schema in `packages/db`. Versioned, simple, no UI editing.
3. **Rendering — port the proven engine.** Lift the verified diagram engine from the artifact (orthogonal edge routing, crow's-foot connectors, nullable markers, hover-to-trace, group boxes) into a framework-agnostic web module fed by the API JSON, restyled with instrument tokens.

## Architecture

Data flow: **drizzle table objects → `describeSchema()` → `GET /api/schema` → React route → `renderErd(container, graph)`**.

Four units, each independently testable:

### A. `packages/db` — metadata source ("from drizzle")

- **`allTables`** — a registry array of every exported `pgTable` object, so callers can iterate the schema. Lives in `schema/registry.ts` (imports the table objects), re-exported from `schema/index.ts`. Adding a new table means adding it here, which the group invariant test then forces into `SCHEMA_GROUPS`.
- **`SCHEMA_GROUPS`** (`schema/schema-groups.ts`) — an ordered `SchemaGroup[]`: `{ key, label, color, tables }`. `color` names an instrument option hue. Declared order drives layout column order. **Invariant:** every table in `allTables` belongs to exactly one group.
- **`describeSchema()`** (`schema/describe-schema.ts`) — walks `allTables` via `getTableConfig()` (from `drizzle-orm/pg-core`), reading columns (name, SQL type, notNull), primary keys, foreign keys (referenced table + column), and unique constraints; merges each table's group key; returns a plain `SchemaGraph`. Throws if a table is missing from `SCHEMA_GROUPS` (keeps the config honest as the schema grows).

### B. `apps/api` — one read-only route

- **`routes/schema.routes.ts`** → `GET /api/schema` returns `describeSchema()` as JSON. No params, no DB access. Registered in `app.ts` via `registerSchemaRoutes(app, context)` (context unused but kept for signature consistency).

### C. `apps/web` — the ported engine

- **`components/schema/erd-engine.ts`** — `renderErd(container: HTMLElement, graph: SchemaGraph): () => void`. Framework-agnostic imperative renderer producing the card DOM + SVG edge layer, returning a cleanup function. Reuses the artifact's logic: group boxes, table cards with PK/FK/U badges and nullable `?` markers, crow's-foot + one-bar FK edges colored by target group, greedy interval lane packing, and hover-to-trace (hovering a table or FK row dims everything except its relations). Reads instrument CSS custom properties (`--color-*`, `--ins-opt-*`) so it follows the app's light/dark theme with no separate theme handling.
- **Layout change from the artifact:** the artifact hand-placed tables into fixed `BANDS` columns. Here layout is **group-driven** (see Layout algorithm below): the engine flows the declared groups into columns and stacks their tables, then routes edges from measured card positions. Diff markers (NEW/CHANGED/REMOVED) are dropped — the page always shows the current real schema.

### D. `apps/web` — the page

- **`routes/schema-route.tsx`** at path `/schema` — fetches `/api/schema` with TanStack Query, renders a scroll container, mounts `renderErd` in a `useEffect` (cleanup on unmount / data change), shows loading + error states. Registered in `router.ts`. Reachable by URL like `/gallery`; not added to project nav.

## Layout algorithm (group-driven)

1. Render each `SchemaGroup` (declared order) as a titled box; flow boxes into columns sized to the viewport width (wrapping masonry).
2. Within a group box, stack its table cards vertically.
3. After mount, measure every card and group rectangle.
4. Route each FK edge orthogonally: exit the source FK row on the near side, travel a vertical gutter between group columns and a horizontal channel between rows, enter the target table's `id` row. Apply the artifact's greedy interval lane assignment so overlapping edges get distinct lanes without spilling into cards.
5. Hover a table or FK row → highlight its connected edges and tables, dim the rest (reused from the artifact).

Verification of routing quality reuses the artifact's approach: after draw, assert no edge path passes through a card rectangle.

## Testing

- **db** — `describe-schema.test.ts`: asserts a known FK (`comment_reactions.comment_id → comments`), a composite PK (`ticket_type_child_types`), a nullable self-FK (`comments.parent_id → comments`), group membership of a sample table, and the every-table-in-exactly-one-group invariant (including that `describeSchema()` throws when a table is ungrouped).
- **api** — `schema.routes` returns `200` and a body matching the `SchemaGraph` shape (tables non-empty, each table has a known group key).
- **web** — a light mount test: the route fetches (mocked `/api/schema`) and calls `renderErd` without throwing, producing at least one table card in the container.

## Out of scope (YAGNI)

- No proposed/diff overlay — current schema only.
- No UI editing of groups (config-only, per decision 2).
- No graph library, pan/zoom, or auto-layout beyond the group-driven flow — horizontal scroll like the artifact.
- No auth/nav integration beyond a URL-reachable route.

## File change list

**New:** `packages/db/src/schema/schema-groups.ts`, `packages/db/src/schema/describe-schema.ts`, `packages/db/src/schema/describe-schema.test.ts`, `apps/api/src/routes/schema.routes.ts`, `apps/web/src/components/schema/erd-engine.ts`, `apps/web/src/routes/schema-route.tsx` (+ its test).
**Modified:** `packages/db/src/schema/index.ts` (export `allTables`, `SCHEMA_GROUPS`, `describeSchema`), `apps/api/src/app.ts` (register route), `apps/web/src/router.ts` (add route).

## Types

Every named type used above, defined here (doc self-contained per project convention).

```ts
// The full payload returned by GET /api/schema and consumed by renderErd.
type SchemaGraph = {
  tables: TableMeta[];
  groups: GroupMeta[];
};

type TableMeta = {
  name: string;                 // sql table name, e.g. "comment_reactions"
  group: string;                // SchemaGroup.key this table belongs to
  columns: ColumnMeta[];
  primaryKey: string[];         // column names composing the PK
  uniques: UniqueMeta[];
};

type ColumnMeta = {
  name: string;                 // sql column name
  type: string;                 // sql type label, e.g. "integer", "text", "timestamptz"
  notNull: boolean;
  pk: boolean;                  // part of the primary key
  fk: { table: string; column: string } | null;  // referenced table + column, or null
};

type UniqueMeta = {
  name: string;                 // constraint name
  columns: string[];            // column names in the unique constraint
};

// Payload form of a declared group (SchemaGroup minus nothing — same shape).
type GroupMeta = {
  key: string;                  // stable group id, e.g. "records"
  label: string;                // display label, e.g. "Ticket data"
  color: string;                // instrument option hue name, e.g. "orange"
  tables: string[];             // table names in this group, in render order
};

// Source config in packages/db (schema-groups.ts). Same shape as GroupMeta.
type SchemaGroup = GroupMeta;
```
