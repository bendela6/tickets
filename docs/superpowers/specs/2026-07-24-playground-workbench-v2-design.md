# @tickets/playground — Workbench v2 Design

Builds on the merged gallery playground (d707c59). Two thrusts: (1) extract the workbench into its own package so `@tickets/ui` stays a near-zero-dep component library, and (2) upgrade the workbench with code visibility, a real layout, and power features — using best-in-class libraries chosen via the add-package flow.

## Decisions (locked with user)

1. **Keep our engine** (no Storybook/Ladle): flexibility, dual-theme via token architecture, design-sync screenshot flow, demos rendered inside the real app.
2. **New package `packages/web/playground` (`@tickets/playground`)** owns the workbench UI, dev app, and all heavy deps. **The demo CONTRACT stays in `@tickets/ui/gallery`** (`types.ts`, `controls.ts`, `collect-demos.ts`, `demos.ts` glob) — demo files import only the contract, so after P3 colocates demos inside ui there is no ui → playground circular dependency. Dependency DAG: playground → ui, never reverse.
3. **Libraries** (approved via add-package comparison): **shiki** (highlighting, `shiki/core` + lazy TSX grammar), **react-resizable-panels** (workbench panes), **cmdk** (⌘K palette/search), **axe-core** (a11y audit, lazy). JSX snippet formatting is **inline** (wrap-when->3-props rule; no prettier). All four are `dependencies` of `@tickets/playground` only.
4. **Lazy-loading is a requirement, not an optimization**: web's `/gallery` ships in the prod bundle; shiki and axe-core load via dynamic `import()` inside their tabs. cmdk (82 kB) and react-resizable-panels load statically.

## Architecture

```
packages/web/ui (@tickets/ui)                    unchanged deps (clsx, tailwind-merge)
└── src/gallery/          CONTRACT ONLY: types.ts, controls.ts, collect-demos.ts,
                          demos.ts (package demo glob) + NEW demo-sources.ts (?raw glob)

packages/web/playground (@tickets/playground)    NEW — deps: @tickets/ui, shiki,
├── package.json                                  react-resizable-panels, cmdk, axe-core
├── vite.config.ts        root 'dev', port 4650 (moves from ui)
├── dev/                  workbench app (moves from ui/dev) → pnpm --filter @tickets/playground dev
└── src/
    ├── gallery-shell.tsx, state-grid.tsx,        MOVED from ui/src/gallery (engine UI)
    │   controls-panel.tsx, playground-card.tsx
    ├── component-page.tsx        NEW: tabbed page (Preview | Code | Source | A11y) +
    │                             resizable controls rail (PanelGroup autoSaveId)
    ├── code-snippet.ts           NEW: JSX generator from control values
    ├── source-tab.tsx            NEW: shiki-rendered demo file source
    ├── a11y-tab.tsx              NEW: axe-core audit of the preview subtree
    ├── theme-split.tsx           NEW: dual-theme side-by-side stage
    ├── matrix-mode.tsx           NEW: 2-control cross-product grid
    ├── props-table.tsx           NEW: control-def-derived docs table
    ├── command-palette.tsx       NEW: cmdk ⌘K jump-to-component
    └── highlight.ts              NEW: lazy shiki singleton (core + tsx + github light/dark themes)
```

Hosts: web's `gallery-route.tsx` imports `@tickets/playground` (still lazy-loadable at route level later); ui's old `dev/` folder and engine files are deleted after the move (`@tickets/ui/gallery` keeps exporting the contract). ~35 mechanical import repoints (engine internals, both hosts; demo files unchanged).

**Tailwind scanning seam (the P2 swatches lesson, generalized):** tokens.css's `@source './'` covers only `ui/src` — consumers would never generate the playground's own class literals. The playground therefore ships `src/styles.css` = `@import '@tickets/ui/tokens.css'; @source './';` (relative to itself → playground src), exported as `@tickets/playground/styles.css`. Web's `main.tsx` swaps its `@tickets/ui/tokens.css` import for `@tickets/playground/styles.css`; the dev app uses the same entry. Any future consumer that renders the workbench imports the playground's CSS entry, and one that only uses components keeps importing ui's tokens.css.

## Features

**Component page (tabs + rail).** Selecting a component shows tabs — `Preview` (states grid + playground, as today), `Code`, `Source`, `A11y` — with the controls rail in a `react-resizable-panels` horizontal group (`autoSaveId="playground-workbench"`, rail 20–40%). All view unchanged (grids only).

**JSX snippet (Code tab).** Generated from current control values: playground def gains `component?: string` (defaults to `meta.title` with spaces stripped); props at `initial`/`undefined` omitted; `true` renders as bare flag; `children` control renders as element children; >3 set props → one per line. Shiki-highlighted, Copy button. Snippet re-renders live with control changes.

**Source tab.** The demo file's real source: `@tickets/ui/gallery/demo-sources.ts` exports `packageDemoSources` via `import.meta.glob('../**/*.demo.tsx', { query: '?raw', import: 'default', eager: true })`; web passes its own `webDemoSources` glob. `collectDemos` gains an optional `sources` param pairing path → slug so the shell can hand each page its source string. Shiki-highlighted with the dual github theme (light/dark follow `data-theme`).

**Dual-theme stage.** Preview toggle "Split themes": renders the states grid (and playground preview) twice side by side, each inside a wrapper `div[data-theme='light'|'dark']` — works because tokens re-declare under `[data-theme]` selectors, so a wrapper re-themes its subtree. Default off.

**Matrix mode.** On the Preview tab, when a playground has ≥2 select controls: pick an X and Y control → grid of `render(values)` over the cross-product (other controls hold their current values). Cells labeled, anchored ids for screenshots.

**Props table.** Below the playground: name, control type, options/range, default (from `initial`), "(unset) allowed" — derived entirely from the control defs.

**⌘K palette + sidebar filter.** `cmdk` dialog (⌘K / Ctrl+K) listing all demos grouped, fuzzy filtered, Enter → `location.hash`. A plain filter input above the sidebar reuses cmdk's list inline.

**A11y tab.** Lazy `import('axe-core')`, `axe.run(previewContainer, { resultTypes: ['violations'] })` on demand (button per state / whole grid), violations rendered as Instrument cards (impact chip, description, target selector, help link). Includes a "re-run" after playground changes.

## Testing

- Extraction is regression-gated: all 46 existing ui gallery tests keep passing from their new home (moved tests move with their files; contract tests stay in ui); web 388 + coverage ratchet untouched; both hosts boot.
- New units: `code-snippet` (omission of defaults/undefined, boolean flags, children, >3-prop wrapping, quoting), `collect-demos` sources pairing, `matrix-mode` cross-product + held values, `props-table` rendering from defs.
- Component: tab switching keeps playground state; palette filters and navigates (jsdom, cmdk renders fine); theme-split renders two stages with correct `data-theme` attrs.
- Mock `axe-core` and `shiki` in unit tests (dynamic imports — inject via seam); one smoke test each that the lazy loader resolves the real module is allowed in package tests.
- Gates: standard battery + `tokens:verify` (panel/tab classes are scanned — playground package needs its own `@source` coverage: its CSS entry imports `@tickets/ui/tokens.css` and adds `@source './'` relative to the playground src). Browser pass both hosts, both themes.

## Out of scope

Prettier; stage background/viewport presets; event log panel; URL-encoded control values; measure overlay; per-demo error boundaries (P3 checklist item, unchanged); excluding /gallery from prod bundle (boundary now exists; decision deferred); eer; P3 component moves.
