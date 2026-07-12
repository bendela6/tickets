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

All authored presentation lives in Tailwind utilities backed by named theme
tokens. `src/styles/tailwind.css` contains only the Tailwind import, `@theme`
tokens (type scale, tracking, radii, shadows, transition-property sets), and
`@custom-variant` lines; it has no application selectors. Static values are
tokens or standard-scale utilities — arbitrary values (`h-[34px]`,
`text-[0.82rem]`) are banned. Runtime diagram geometry and user-selected colors
enter components as typed CSS custom properties (per-element `color-mix()`
recipes are built by `src/ui/color-mix.ts`, since a var() inside a `:root`
token resolves at `:root`), and utilities consume them with the `(--var)`
syntax, e.g. `w-(--card-width)`. Direct style declarations, additional
stylesheets, CSS-in-JS, CSSOM injection, and arbitrary-value utilities are all
rejected by `verify:tailwind`, which runs automatically before build,
typecheck, and tests. It also caps class strings at 100 chars (the prettier
printWidth) — longer lists must be split into grouped `cn()` lines, one
concern per line. The one sanctioned exception is `src/styles/debug.scss`, a
dev-only helper of `dd*` dotted-outline classes; nothing in the app may depend
on it.

## The model

Driven entirely by JSON — `src/model/eer-model.json` (the opus event-sourcing schema).
Point the viewer at another model with `?model=<url>` (fetched over http). The format
is documented in [`docs/opus/eer-schema.md`](../../docs/opus/eer-schema.md).

## Controls

`wheel` zoom · `middle-drag` pan · `left-drag` move an entity or a whole zone ·
`click` entity → focus its relationships · `click` a zone → show only its connections ·
`hover` a field → light its edges · `click` an edge → isolate it · `Esc` clear.
Top bar: search, zone/edge filters, **Lines** mode (curved → avoid → ortho), Fit,
Rearrange, and **Self-check** (also `window.__eer.actions.runChecks()` in dev — the
dev handle also exposes `getState()`, `getGeometry()`, and `dispatch()`).
