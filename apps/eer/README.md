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
  imperative surface (`DiagramActions`: fit/rearrange/search/runChecks/…) is
  memoized once and reached via `useDiagramActions()`.
- `src/engine/` — the framework-agnostic diagram engine (TypeScript), one
  function/module per folder with its own test: `model/` (validate + normalize the
  JSON model), `geometry/` (card sizing + port positions, mirrors the rendered
  Tailwind box model), `layout/` (deterministic group packing, fit/center math), `routing/` (A\*
  obstacle-avoiding orthogonal router: curved / avoid / ortho), `colors/` (zone →
  entity → edge colour inheritance), `focus/` (focus-set selectors: related-to-
  entity, related-to-group, connected ports, field edges), `search/` (ranked model
  search), `checks/` (the runnable quality assertions behind Self-check).
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
- **Connections are derived, not authored** — there is no separate connection/
  edge editor. An edge exists because some field has `role: 'fk'` plus a `ref`
  (and optional `refField`, defaulting to `'id'`); toggling a field's role to
  FK and picking a reference table (`FieldGrid`, inside `TableModal`) is what
  draws it, and clearing either removes it (`apply-model-edit`'s
  `deriveRelationships`).
- **Layout + colour persistence** — dragging a card/zone or overriding a
  colour (per-entity/group swatch in `TableModal`/`GroupModal`, or the
  overview's `ColorsForm`) only changes in-memory state until **Save**;
  `serializeModel` writes both the current `x`/`y`/box geometry and the colour
  override map into the same model JSON, so a reload of a saved model
  reproduces layout and colours exactly, not just data.

## Controls

`wheel` zoom · `middle-drag` pan · `left-drag` move an entity or a whole zone ·
`click` entity → focus its relationships · `click` a zone → show only its connections ·
`hover` a field → light its edges · `click` an edge → isolate it · `Esc` clear.
Top bar: search, zone/edge filters, **Lines** mode (curved → avoid → ortho), Fit,
Rearrange, and **Self-check** (also `window.__eer.actions.runChecks()` in dev — the
dev handle also exposes `getState()`, `getGeometry()`, and `dispatch()`).
