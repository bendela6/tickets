# @tickets/eer

Interactive **EER model viewer** — a React + TypeScript + Tailwind app (same stack as
`apps/web`). Ported from the standalone `docs/opus/eer-viewer` prototype (since deleted).

```sh
pnpm --filter @tickets/eer dev     # http://localhost:4630  (also launched by `pnpm dev`)
pnpm --filter @tickets/eer build
pnpm --filter @tickets/eer typecheck
pnpm --filter @tickets/eer verify:tailwind
```

## Architecture

React owns the scene; `src/engine/` is pure calculation with no DOM/React imports —
a `DiagramProvider` reducer holds the model/view/ui, components render straight
from context, and a gesture hook dispatches into the reducer instead of mutating
the DOM:

- `src/state/` — `DiagramProvider` (`diagram-provider.tsx`) owns a `useReducer`
  (`diagram-reducer.ts`: model + view + ui) and derives edge geometry (frozen
  mid-gesture, exactly like the legacy live redraw); slice contexts
  (`diagram-context.ts`) so components only re-render for the slice they read; the
  imperative surface (`DiagramActions`: fit/rearrange/search/…) is
  memoized once and reached via `useDiagramActions()`.
- `src/engine/` — the framework-agnostic diagram engine (TypeScript), one
  function/module per folder with its own test: `model/` (validate + normalize the
  JSON model), `geometry/` (card sizing + port positions, mirrors the rendered
  Tailwind box model), `layout/` (deterministic group packing, fit/center math), `routing/` (A\*
  obstacle-avoiding orthogonal router: curved / avoid / ortho), `colors/` (zone →
  entity → edge colour inheritance), `focus/` (focus-set selectors: related-to-
  entity, related-to-group, connected ports, field edges), and `search/` (ranked
  model search).
- `src/components/diagram/` — renders the DOM/SVG scene from context: `diagram/`
  (the `.viewport` shell, mounted unconditionally so the gesture hook always has
  an element to bind to), `world/`, `zone-boxes/`, `entity-cards/`, `edges-svg/`.
- `src/hooks/use-diagram-gestures/` — the interaction state machine (pan/zoom,
  entity drag, group drag, group resize, click-select, keyboard), ported from the
  legacy imperative engine's `wireGlobal`; dispatches into the reducer instead of
  mutating DOM.
- `src/components/` (`top-bar/`, `detail-panel/`, `checks-overlay/`,
  `error-banner/`) — React + Tailwind chrome that reads context and calls
  `DiagramActions`.

## Styling boundary

All authored presentation lives in Tailwind utilities backed by generic theme
tokens. `src/styles/tailwind.css` contains only the Tailwind import, `@theme`
tokens, and `@custom-variant` lines; it has no application selectors. Tokens
are scale-shaped, never usage-named: colors are plain families with full
50–950 ramps (`gray-*`, `blue-*`, … — the 400s anchor the design's hues),
radii/shadows override standard steps (`lg`, `xl`, …), and there is no
`--radius-card`-style variable — component-specific values live in the
component. Arbitrary values (`h-[34px]`, `text-[0.82rem]`) are banned. Runtime diagram geometry and user-selected colors
enter components as typed CSS custom properties (per-element `color-mix()`
recipes are built by `src/ui/color-mix.ts`, since a var() inside a `:root`
token resolves at `:root`), and utilities consume them with the `(--var)`
syntax, e.g. `w-(--card-width)`. Direct style declarations, additional
stylesheets, CSS-in-JS, CSSOM injection, and arbitrary-value utilities are all
rejected by `verify:tailwind`, which runs automatically before build,
typecheck, and tests. It also caps class strings at 100 chars (the prettier
printWidth) — longer lists must be split into grouped `cn()` lines, one
concern per line — and rejects fractional spacing steps (`h-8.5`): sizes stay
on integer utilities. The one sanctioned exception is `src/styles/debug.scss`, a
dev-only helper of `dd*` dotted-outline classes; nothing in the app may depend
on it.

## The model

Driven entirely by JSON — `src/model/eer-model.json` (the opus event-sourcing schema).
Point the viewer at another model with `?model=<url>` (fetched over http). The format
is documented in [`docs/opus/eer-schema.md`](../../docs/opus/eer-schema.md).

## Editor

Dev-only model editing on top of the read-only diagram, backed by a file API
that doesn't exist in the built app:

- **Models API** — `vite-plugins/models-api.ts` is a Vite dev-server middleware
  (`configureServer`, not shipped in `build`) serving `GET/POST /api/models`
  and `GET/PUT/DELETE /api/models/:id` against JSON files in `apps/eer/models/`
  (one file per model, named `<slug>.json`; `src/api/models-client.ts` is the
  fetch wrapper, and hides itself once the endpoint 404s, i.e. in a production
  build). The one file checked into the repo, `models/items-platform.json`, is
  the seed model — never save over it with scratch/test data.
- **Model menu** (top bar) — a `<select>` of every model the API lists, plus
  **New** (title → seeded starter model → created + loaded), **Edit model**
  (rename/describe/delete the current model), and **Save** (serializes the
  live model + colour overrides back to its file; the dot next to Save tracks
  `ui.dirty`, and switching models with unsaved changes prompts to discard).
- **Modals** — `src/components/editor/` (`EditorModals`, mounted once in
  `eer-viewer.tsx`, owns "which modal is open for which id" via
  `useEditor().openModal({kind, id?})`/`closeModal()`, reachable from any
  descendant without prop-drilling): **+ Add** opens a chooser for a new
  zone / subgroup / table (`AddChooser` → `GroupModal`/`TableModal` in create
  mode, no `id`); **Edit** — on the detail panel's entity/group header — opens
  the same `TableModal`/`GroupModal` in edit mode (`id` set, existing
  fields/colour prefilled). Each routed modal is remounted (keyed on
  `kind:id`) whenever its target changes, so switching straight from editing
  one table/group to another never leaves stale draft state behind.
- **Real relational schema, not a role hint** — each table (`Entity`) owns
  `columns` (name, Postgres `type`, `nullable`, `default`, plus display
  `title`/`description`), `constraints` (`pk` | `unique` | `check` | `fk` —
  all but `check` can span multiple columns; an `fk` also carries `refTable`,
  `refColumns`, and optional `onDelete`/`onUpdate` actions), and `indexes`
  (name, columns, `unique`, method, an optional partial `WHERE`, and
  per-column order/nulls/opClass). PK/FK badges on the card are never stored
  directly — they're derived from a table's constraints (`columnRoles`), so
  they can't disagree with the schema.
- **Connections are derived, not authored** — there is no separate connection/
  edge editor. **A `fk` constraint is what draws an edge**: `TableModal`'s
  constraints editor (add/edit/remove a constraint, composite columns via a
  multi-select, `refTable`/`refColumns` picked from existing tables, an
  `onDelete`/`onUpdate` action select) is where you author it, and
  `deriveRelationships` regenerates one edge per resolvable `fk` constraint on
  every edit — add a `fk` constraint and the edge appears; remove it, rename
  its column, or repoint `refTable` and the edge updates or disappears with it.
  An edge's cardinality is derived too: `1-1` when the fk's columns are
  exactly covered by a `pk`/`unique` constraint on the referencing table,
  `1-n` otherwise. The columns grid's type picker (`TypeCell`) draws its
  catalogue from drizzle's own column-builder registry (`pg-types.ts` /
  `descriptors.ts`) — every type drizzle 0.45 can build, grouped
  (numeric/text/temporal/boolean/uuid/json/network/geometric/vector), with
  inline parameters (`varchar(n)`, `numeric(p,s)`), an `[]` array-dimension
  toggle, and the model's declared enums surfaced as their own selectable
  group. There is no free-text escape hatch: a type the catalogue doesn't
  recognise (e.g. hand-edited into a model file) parses as an invalid
  selection that the picker flags and that blocks export until it's fixed.
- **Legacy files still load** — a model authored in the old shape (per-field
  `role: 'pk'|'fk'` plus `ref`/`refField`) is accepted and normalised into
  `constraints` on read (`load-model.ts`'s `synthesizeLegacyConstraints`); it
  is never round-tripped back into that shape — the next Save writes the
  current `columns`/`constraints`/`indexes` shape instead.
- **Layout + colour persistence** — dragging a card/zone or overriding a
  colour (per-entity swatch in `TableModal`, per-zone/subgroup swatches in
  `GroupModal`) only changes in-memory state until **Save**;
  `serializeModel` writes both the current `x`/`y`/box geometry and the colour
  override map into the same model JSON, so a reload of a saved model
  reproduces layout and colours exactly, not just data.

## drizzle round-trip

The diagram round-trips losslessly to a drizzle-orm Postgres schema. Import
introspects a drizzle schema module at runtime; export regenerates drizzle
TypeScript from the model. This is proven, not asserted: a gate test
(`src/test/gate/roundtrip.gate.test.ts`) imports the real `@tickets/db`
schema (18 tables, 3 enums), exports it, re-imports the generated file, and
asserts (a) our canonical descriptor (`describeDrizzle`) is deep-equal
before/after and (b) `drizzle-kit` itself generates an EMPTY migration
between the two schemas — i.e. Postgres cannot tell them apart — and that the
generated file typechecks under `tsc --strict`. A second gate runs the same
four assertions over a hand-written kitchen-sink fixture that exercises the
full type/constraint/index/enum/namespace vocabulary the real schema doesn't
happen to touch.

**Using it** — the top bar's **Import** and **Export** buttons (dev only,
`import.meta.env.DEV`). Import is always a dry run: "Re-scan" fetches and
diffs a module path (default `packages/db/src/schema/index.ts`) against the
current model and shows a report — tables added/changed/removed, each with
its canvas effect — and applies nothing until you click **Apply import**; the
report is the consent. Export shows a preview of the generated source and a
**Write file** button.

**In scope**: tables, columns (including identity and generated-stored
columns, arrays), constraints (pk/unique/check/fk with `onDelete`/`onUpdate`,
composite, `NULLS NOT DISTINCT`), indexes (method, partial `WHERE`,
per-column order/nulls/opClass), enums, and `pgSchema` namespaces.

**What blocks export**: an unknown column type (see the type picker above),
or a construct that cannot be reproduced from runtime introspection —
TypeScript-only sugar that never reaches SQL. The reader introspects a
*running* schema (`getTableConfig`), so it sees only what reaches Postgres:
`relations()`, `.$defaultFn()` and `.$onUpdate()` leave a runtime trace and
are **detected and reported** at import (not silently dropped), blocking
export until resolved; `$type<>()` and a column's `mode: 'string'` are pure
compile-time casts with no runtime footprint, so they are **documented as
unrepresentable** rather than detected. The real `@tickets/db` schema uses
none of these today.

**Where export writes** — a reviewable `.ts` file into `apps/eer/exports/`
only (filename-sanitised, atomic write). It never writes to `packages/db`:
adopting generated output as the real schema is a deliberate, separate human
step, not something this tool does.

Import/export are dev-server routes (`vite-plugins/drizzle-api.ts`) and are
absent from a production build.

## Controls

`wheel` zoom · `middle-drag` pan · `left-drag` move an entity or a whole zone ·
`click` entity → focus its relationships · `click` a zone → show only its connections ·
`hover` a field → light its edges · `click` an edge → isolate it · `Esc` clear.
Top bar: search, zone/edge filters, **Lines** mode (curved → avoid → ortho), Fit,
and Rearrange. The right-hand detail panel collapses (chevron) and resizes (drag
its left edge). In dev, `window.__eer` exposes `getState()`, `getGeometry()`,
`dispatch()`, and `actions`.
