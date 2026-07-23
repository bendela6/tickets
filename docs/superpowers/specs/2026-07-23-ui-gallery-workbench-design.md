# @tickets/ui Phase 2 — Gallery Workbench Design

Phase 2 of the shared UI library roadmap (`docs/superpowers/plans/2026-07-23-shared-ui-library-roadmap.md`). Builds the component gallery as a reusable engine inside `@tickets/ui`, a standalone dev app in the package, and turns web's `/gallery` into a thin consumer. P1 (tokens package) is merged @ a3b87f4 and deployed.

## Decisions (locked with user)

1. **Sequencing:** P1 merged to main first; P2 implemented from main in a fresh worktree.
2. **Discovery:** demos are auto-discovered via `import.meta.glob('**/*.demo.tsx')` — no registry file.
3. **Demo contract:** each `*.demo.tsx` exports `meta: { title, group, order? }` and `states: { name, render }[]` (state matrix). No free-form default export in P2.
4. **Port scope:** ALL ~20 sections of the existing `apps/web/src/routes/gallery-route.tsx` are rewritten as colocated demo files in P2; the monolithic route body is deleted.

## Architecture

### 1. Gallery engine — `packages/web/ui/src/gallery/`

| File | Responsibility |
|---|---|
| `types.ts` | `DemoMeta { title: string; group: string; order?: number }`, `DemoState { name: string; render: () => ReactNode }`, `DemoModule { meta: DemoMeta; states: DemoState[] }` |
| `collect-demos.ts` | `collectDemos(globResult: Record<string, unknown>): CollectedDemo[]` — validates each module against the contract at runtime; invalid modules become `{ error: string, path }` entries (rendered as an inline error card, never a blank page); sorts by group → order (unset = last) → title; stable slug per demo (`kebab(title)`) and per state (`kebab(title)--kebab(state)`) |
| `state-grid.tsx` | Renders one demo: title header + labeled grid of its states, each state cell carrying `id={slug}` for screenshot addressing |
| `gallery-shell.tsx` | Full gallery page: grouped side nav, theme toggle (`data-theme` on root), wraps content in `TooltipProvider`/`ToastProvider`, renders `StateGrid` per demo. NOTE: providers live in apps/web until P3 — see Provider seam below |
| `demos.ts` | `export const packageDemos = collectDemos(import.meta.glob('../**/*.demo.tsx', { eager: true }))` — the package's own demos, exported for consumers |

Package exports added: `"./gallery": "./src/gallery/index.ts"`, `"./gallery/demos": "./src/gallery/demos.ts"`.

**Provider seam:** `TooltipProvider`/`ToastProvider` live in `apps/web/src/ui` until P3. The engine cannot import from the app, so `GalleryShell` takes an optional `providers?: (children: ReactNode) => ReactNode` wrapper prop. Web passes its providers; the dev app passes none until P3 moves them into the package (P3 then bakes them in and drops the prop).

### 2. Package dev app — `packages/web/ui/dev/`

- `index.html` + `main.tsx` + `styles.css` + `vite.config.ts`; script `"dev": "vite dev"` → port **4630**, strictPort.
- `styles.css`: `@import '@tickets/ui/tokens.css';` then `@source '../src';` — package-resident class literals (demo files, and P3's components later) are Tailwind-scanned here from day one.
- Fonts: `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` as package devDependencies, imported in `main.tsx` (mirrors web).
- Renders `GalleryShell` over `packageDemos` (no provider wrapper).
- Seed demo: `src/swatches.demo.tsx` — the package's one resident demo in P2 (group "Foundation"), rendering the SWATCHES presets as labeled color tiles; proves glob → collect → shell end-to-end.
- devDependencies added: `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@fontsource/*`, `react-dom`.

### 3. Web `/gallery` — thin consumer

`apps/web/src/routes/gallery-route.tsx` becomes:
```tsx
const webDemos = collectDemos(import.meta.glob('../**/*.demo.tsx', { eager: true }));
// GalleryShell over [...packageDemos, ...webDemos], providers = web's Tooltip/Toast providers
```
Same `/gallery` path. All section JSX, fixtures, and local demo components in the route file are deleted.

### 4. Demo files (the port)

Colocated with their components; every current gallery section is represented:

- `apps/web/src/ui/*.demo.tsx`: button (variants + sizes as separate demos or state groups — implementer's call, every current state preserved), input, textarea, checkbox, switch, radio-group, combobox, multi-combobox, status-select, status-badge, option-chip, type-badge, item-key, avatar, session-status-pill, session-kind-glyph, date-picker, number-input, relative-date, menu, dialog, tooltip, toast, field-label/field-error (one "form fields" demo).
- `apps/web/src/components/agent/*.demo.tsx`: message-stream (stream + approval card as states, SAMPLE_STREAM fixture moves in), cost-meter, prompt-composer (composer fixture with running toggle moves in).
- Interactive states (open dialog, fire toast, pickers with useState) are wrapped in tiny fixture components inside the demo file — `render` may return stateful fixtures; "state" names describe what's shown, not necessarily static markup.
- `RelativeDate` demos keep the fixed `NOW` reference instant (deterministic rendering).

## Testing

- Engine: `collect-demos.test.ts` — valid module collected + sorted correctly (group/order/title), invalid module (missing states, non-function render) yields error entry not throw, slug stability. `state-grid.test.tsx` — renders state labels + ids from a fixture module.
- Web: demo-coverage test — for every component module in `apps/web/src/ui` (every `.tsx` file excluding `*.test.tsx` and `*.demo.tsx`; exact list derived at plan time), a sibling `.demo.tsx` exists; fails listing missing names. Non-visual helper modules (e.g. `combobox-list` internals, `use-directory-tree`) may be exempted via an explicit allowlist in the test — the allowlist is the documented exception, not silence. This is the ratchet P3 inherits.
- Gates: `pnpm --filter @tickets/ui test && typecheck`, `pnpm --filter @tickets/web test && typecheck`, `pnpm build`, `pnpm --filter @tickets/ui tokens:verify` (scanner now also sees demo files — any hex snuck into demos gets caught), dev app boots on 4630 and renders the seed demo, `/gallery` on web dev shows every ported section in both themes.

## Out of scope

Moving components into the package (P3); per-state screenshot automation and design-sync push; Storybook/Ladle; eer demos; the P1 ratchet-hardening decision (separate follow-up); a `/gallery` production-bundle exclusion (route ships in prod today and continues to — revisit only if bundle size becomes a concern).
