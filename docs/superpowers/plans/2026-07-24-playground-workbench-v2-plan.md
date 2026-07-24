# @tickets/playground Workbench v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the gallery workbench into `packages/web/playground` (`@tickets/playground`), then build workbench v2 to the pulled design: tabbed component pages with a resizable rail, generated-JSX Code tab, real Source tab, A11y audit, split themes, matrix mode, and a ⌘K palette.

**Architecture:** Task 1 is the atomic package extraction (engine UI + dev app move; contract stays in `@tickets/ui/gallery`; the `styles.css` @source seam). Then contract additions (path + raw-source glob), the Preview-tab design refresh, and one task per feature cluster — each feature task installs its own already-approved library. The pulled design (`docs/design/pulls/playground-workbench.dc.html`, screens 1a–1i) is the visual source of truth; tasks cite exact line ranges.

**Tech stack:** React 19, TS, Tailwind v4 tokens, vitest/testing-library, shiki (custom `instrument-dark` TextMate theme), react-resizable-panels, cmdk, axe-core.

**Spec:** `docs/superpowers/specs/2026-07-24-playground-workbench-v2-design.md` (incl. the binding "Design of record" section).

## Global constraints

- Conventional commits `feat(playground): …` / `feat(ui): …` / `refactor(web): …`; one commit per task; repo green after every commit: `pnpm --filter @tickets/ui test+typecheck && pnpm --filter @tickets/playground test+typecheck && pnpm --filter @tickets/web test+typecheck && pnpm build && pnpm --filter @tickets/ui tokens:verify`.
- Dependency DAG: playground → ui only. Demo files import ONLY `@tickets/ui/gallery`. Libraries (shiki, react-resizable-panels, cmdk, axe-core) are `dependencies` of `@tickets/playground` exclusively, installed in the task that first uses each (approval already given via add-package).
- shiki and axe-core load via dynamic `import()` behind their tabs — never statically imported from any module the route loads eagerly.
- Hook-owning playground/demo renders: NAMED MODULE-LEVEL fixture components, zero lint suppressions.
- Design fidelity: implement to `docs/design/pulls/playground-workbench.dc.html` line refs given per task; map design hexes to existing tokens (e.g. `#ECEAE3`→`bg-inset`, `#E0DDD5`→`border-hairline`, `#918D80`→`text-ink-3`); the ONLY new raw colors permitted are the code-block syntax palette inside the shiki theme JSON + code-block surface classes (scanner: theme JSON lives in a `.json` file — not scanned; the few surface classes use an allowed `var()`-based inline style or the ink tokens).
- No hex/arbitrary color values in `className` strings anywhere (tokens:verify gate).
- Port 4650 stays the workbench dev port.

---

### Task 1: Extract `@tickets/playground` (atomic move + styles seam)

**Files:**
- Create: `packages/web/playground/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/styles.css`, `src/index.ts`, `src/test/setup.ts` (moved), `vite.config.ts` (moved from ui)
- Move (git mv, ui → playground `src/`): `gallery-shell.tsx`, `state-grid.tsx`, `controls-panel.tsx`, `playground-card.tsx`, `gallery-shell.test.tsx`, `state-grid.test.tsx`, `playground-card.test.tsx`, and the whole `packages/web/ui/dev/` folder → `packages/web/playground/dev/`
- Modify: `packages/web/ui/package.json` (remove dev script + dev-app devDeps that move; drop moved exports), `packages/web/ui/src/gallery/index.ts` (contract-only exports), `apps/web/package.json` (+`@tickets/playground`), `apps/web/src/main.tsx` (css import swap), `apps/web/src/routes/gallery-route.tsx` (GalleryShell from playground), `pnpm-workspace.yaml` unchanged (glob covers it)
- Delete: `packages/web/ui/vite.config.ts` (moved), ui's `vitest.config.ts` KEEPS jsdom (contract tests import react types)

**Interfaces:**
- Consumes: existing engine (post-d707c59).
- Produces: `@tickets/playground` exports `"."` → `./src/index.ts` (re-exports `GalleryShell`, `StateGrid`, `DemoErrorCard`, `ControlsPanel`, `PlaygroundCard`) and `"./styles.css"` → `./src/styles.css`. `@tickets/ui/gallery` keeps ONLY: types, controls, collect-demos (incl. `prepareDemos`, `sortDemos`), `./gallery/demos`. Moved files' relative contract imports become `@tickets/ui/gallery`.

- [ ] **Step 1: Scaffold**

`packages/web/playground/package.json`:
```json
{
  "name": "@tickets/playground",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  },
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@tickets/ui": "workspace:*"
  },
  "devDependencies": {
    "@fontsource/ibm-plex-mono": "^5.2.7",
    "@fontsource/ibm-plex-sans": "^5.2.8",
    "@tailwindcss/vite": "^4.3.2",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^26.1.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "jsdom": "^29.1.1",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "typescript": "^6.0.3",
    "vite": "^8.0.12",
    "vitest": "^4.1.10"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```
`tsconfig.json`: copy ui's, `include: ["src", "dev"]`. `vitest.config.ts`: copy ui's (react plugin, jsdom, globals, `setupFiles: ['./src/test/setup.ts']`, include `src/**/*.test.{ts,tsx}`).

`src/styles.css`:
```css
@import '@tickets/ui/tokens.css';
/* Consumers' Tailwind must scan the playground's own class literals. */
@source './';
```

- [ ] **Step 2: git mv the engine + dev app + test setup; create `src/index.ts`**

```bash
for f in gallery-shell state-grid controls-panel playground-card; do
  git mv packages/web/ui/src/gallery/$f.tsx packages/web/playground/src/$f.tsx 2>/dev/null
  git mv packages/web/ui/src/gallery/$f.test.tsx packages/web/playground/src/$f.test.tsx 2>/dev/null
done
git mv packages/web/ui/src/test/setup.ts packages/web/playground/src/test/setup.ts
git mv packages/web/ui/dev packages/web/playground/dev
git mv packages/web/ui/vite.config.ts packages/web/playground/vite.config.ts
```
(`controls-panel` has no test file — the loop's 2>/dev/null covers it. If ui's vitest.config referenced the moved setup file, remove that `setupFiles` entry.)

`src/index.ts`:
```ts
export { GalleryShell } from './gallery-shell';
export { DemoErrorCard, StateGrid } from './state-grid';
export { ControlsPanel } from './controls-panel';
export { PlaygroundCard } from './playground-card';
```

- [ ] **Step 3: Repoint moved files' imports**

In the four moved components + three tests: relative contract imports (`./types`, `./controls`, `./collect-demos`, `../cn`) become `@tickets/ui/gallery` and `@tickets/ui/cn` respectively. `dev/main.tsx`: engine imports become relative to the new location (`../src` for the index, `@tickets/ui/gallery/demos` for `packageDemos`); `@fontsource` imports unchanged. `dev/styles.css` becomes exactly one line: `@import '../src/styles.css';` (relative self-import — the package can't import its own name).

- [ ] **Step 4: Slim `@tickets/ui`**

`src/gallery/index.ts` → `export * from './types'; export * from './collect-demos'; export * from './controls';`. package.json: remove `"dev"` script; remove devDeps that only served the dev app (`@fontsource/*`, `@tailwindcss/vite`, `vite`, `react-dom`, `@types/react-dom` — KEEP `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `react` for remaining tsx-adjacent tests; verify by running ui tests after). Keep exports `./tokens.css ./cn ./variants ./runtime-style ./swatches ./gallery ./gallery/demos`.

- [ ] **Step 5: Repoint web**

`apps/web/package.json`: add `"@tickets/playground": "workspace:*"`. `main.tsx`: `import '@tickets/ui/tokens.css'` → `import '@tickets/playground/styles.css'`. `gallery-route.tsx`: `GalleryShell` now from `@tickets/playground`; `collectDemos`/`prepareDemos` stay from `@tickets/ui/gallery`; `packageDemos` stays from `@tickets/ui/gallery/demos`. `pnpm install`.

- [ ] **Step 6: Gate + boot**

Full global gate; plus dev boot: `pnpm --filter @tickets/playground dev` background → curl :4650 → 200 → kill. Expected: ui tests shrink (moved suites now run in playground), combined count unchanged (ui ≈ 41 − shell/grid/card suites; playground picks them up); web 388.

- [ ] **Step 7: Commit** — `refactor(playground): extract workbench package from @tickets/ui`

---

### Task 2: Contract additions — success-entry `path` + raw demo sources

**Files:**
- Modify: `packages/web/ui/src/gallery/types.ts` (success arm gains `path: string`), `collect-demos.ts` (carry path through; `prepareDemos` duplicate branch keeps its synthetic path), `collect-demos.test.ts` (+2 tests)
- Create: `packages/web/ui/src/gallery/demo-sources.ts`
- Modify: `packages/web/ui/package.json` (+export `"./gallery/demo-sources": "./src/gallery/demo-sources.ts"`)

**Interfaces:**
- Produces: success `CollectedDemo` has `path` (the glob key); `packageDemoSources: Record<string, string>` from `demo-sources.ts`:
```ts
export const packageDemoSources = import.meta.glob('../**/*.demo.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
```
Consumers look up a demo's source as `sources[demo.path]` (same relative glob root as `demos.ts`, so keys align).

- [ ] Tests first (append): success entries expose the glob key as `path`; keys of a demos glob and a sources glob with identical patterns match (simulate with two literal objects sharing keys). RED → implement → GREEN → full ui+web gate (web glob consumers unaffected — `path` is additive) → commit `feat(ui): demo paths and raw-source glob in gallery contract`.

---

### Task 3: Preview-tab design refresh (states cards, rail v2, props table)

Design refs (all in `docs/design/pulls/playground-workbench.dc.html`): states grid 113-125, playground stage 127-132, props table 134-145, rail 152-188.

**Files:**
- Modify: `packages/web/playground/src/state-grid.tsx` (per-state cards + `STATES` label), `controls-panel.tsx` (row anatomy), `playground-card.tsx` (stage + Reset + helper text + PropsTable slot)
- Create: `packages/web/playground/src/props-table.tsx`
- Test: extend `state-grid.test.tsx` (cards render one section per state with caption), new `props-table.test.tsx`, extend `playground-card.test.tsx` (Reset re-seeds values)

**Binding anatomy (from design, tokens for hexes):**
- State cell: `flex flex-col items-center gap-3 rounded-card border border-hairline bg-raised px-2.5 pb-3 pt-5` + caption `font-mono text-label text-ink-3`; grid `grid grid-cols-4 gap-2.5` (responsive: `grid-cols-2 xl:grid-cols-4`); uppercase `STATES` mono label above.
- Playground stage: `flex min-h-32 items-center justify-center rounded-card border border-hairline bg-raised p-7` under `PLAYGROUND` label.
- Rail rows: `grid grid-cols-[96px_1fr] items-center gap-2.5 border-b border-hairline py-2.5`; label `font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3`; header row `CONTROLS` + accent `Reset` button (`onClick` → `setValues(initialValues(playground.controls))`); footer helper `<p>` text-label ink-3: "Unset props fall back to the component default and are omitted from generated code."
- PropsTable (from control defs): columns PROP/TYPE/OPTIONS / RANGE/DEFAULT/UNSET? — grid `grid-cols-[110px_100px_1fr_100px_64px]`; type = def.kind (`enum` for select), options joined `·`, number range `min – max`, default from `initial` (`—` when undefined), unset `yes/no` from allowNone. Full component:
```tsx
import type { AnyControlDef } from '@tickets/ui/gallery';

const cell = 'font-mono text-meta';
function row(def: AnyControlDef): { type: string; options: string; def: string; unset: string } {
  switch (def.kind) {
    case 'select':
      return { type: 'enum', options: def.options.join(' · '), def: def.initial ?? '—', unset: def.allowNone ? 'yes' : 'no' };
    case 'boolean':
      return { type: 'boolean', options: '—', def: String(def.initial), unset: 'no' };
    case 'text':
      return { type: 'string', options: '—', def: def.initial || '—', unset: 'no' };
    case 'number':
      return { type: 'number', options: def.min !== undefined || def.max !== undefined ? `${def.min ?? '…'} – ${def.max ?? '…'}` : '—', def: String(def.initial), unset: 'no' };
  }
}

export function PropsTable({ controls }: { controls: Record<string, AnyControlDef> }) {
  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-raised">
      <div className="grid grid-cols-[110px_100px_1fr_100px_64px] gap-3 border-b border-hairline px-3.5 py-2 font-mono text-label uppercase tracking-(--tracking-caps) text-ink-3">
        <span>Prop</span><span>Type</span><span>Options / range</span><span>Default</span><span>Unset?</span>
      </div>
      {Object.entries(controls).map(([name, def], i) => {
        const r = row(def);
        return (
          <div key={name} className={`grid grid-cols-[110px_100px_1fr_100px_64px] items-center gap-3 px-3.5 py-2 ${i > 0 ? 'border-t border-hairline' : ''}`}>
            <span className={`${cell} font-medium text-ink`}>{name}</span>
            <span className={`${cell} text-ink-3`}>{r.type}</span>
            <span className={`${cell} text-ink-2`}>{r.options}</span>
            <span className={`${cell} text-ink-2`}>{r.def}</span>
            <span className={`${cell} text-ink-3`}>{r.unset}</span>
          </div>
        );
      })}
    </div>
  );
}
```
- [ ] TDD per component (tests shown to implementer via existing patterns in the same files); full gate; commit `feat(playground): preview tab redesigned to workbench spec`.

---

### Task 4: ComponentPage tabs + resizable rail

**Files:**
- Install: `pnpm --filter @tickets/playground add react-resizable-panels`
- Create: `packages/web/playground/src/component-page.tsx` (+ test)
- Modify: `gallery-shell.tsx` (single-component view renders `<ComponentPage demo sources={sources?.[demo.path]} />`; shell gains optional `sources?: Record<string, string>` prop; All view unchanged)

**Interfaces:**
- Produces: `ComponentPage({ demo, source }: { demo: LiveDemo; source?: string })` with internal `tab` state `'preview' | 'code' | 'source' | 'a11y'`; the shell holds `sources?: Record<string, string>` and renders `<ComponentPage demo={demo} source={sources?.[demo.path]} />`. Header tabs (design 103-108: underline, accent active) then per tab; Preview tab = `PanelGroup direction="horizontal" autoSaveId="playground-workbench"` — stage Panel (defaultSize 70) | `PanelResizeHandle` (9px hit area, hairline→accent line, design 149) | rail Panel (defaultSize 30, minSize 20, maxSize 34 ≈ design's 240–380px band). Code/Source/A11y tabs render placeholder `<TabPending>` component this task (`<p className="text-meta text-ink-3">…coming in this build</p>`) replaced by Tasks 5/8 — placeholder is a REAL component with a test asserting tab switching preserves playground state (mount Code tab then back; playground values persist because ComponentPage keeps PlaygroundCard mounted via CSS `hidden` toggling, not unmount: `<div className={tab === 'preview' ? '' : 'hidden'}>`).
- [ ] TDD (tab switch test, rail render, autoSaveId present); gate; commit `feat(playground): tabbed component page with resizable controls rail`.

---

### Task 5: Code + Source tabs (shiki, snippet generator)

**Files:**
- Install: `pnpm --filter @tickets/playground add shiki`
- Create: `src/instrument-dark.json` (TextMate theme), `src/highlight.ts`, `src/code-snippet.ts` (+ test), `src/code-tab.tsx`, `src/source-tab.tsx` (+ combined test with mocked highlighter)
- Modify: `component-page.tsx` (wire real tabs), `gallery-route.tsx` (pass `sources={{ ...packageDemoSources, ...webDemoSources }}` where `const webDemoSources = import.meta.glob('../**/*.demo.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>`), `dev/main.tsx` (pass `sources={packageDemoSources}` from `@tickets/ui/gallery/demo-sources`)

**instrument-dark.json** (design 1c/1d palette, the one place raw hexes are permitted):
```json
{
  "name": "instrument-dark",
  "type": "dark",
  "colors": { "editor.background": "#25231D", "editor.foreground": "#EDEBE3" },
  "tokenColors": [
    { "scope": ["entity.name.tag", "support.class.component", "keyword", "storage.type", "storage.modifier"], "settings": { "foreground": "#A9A2F2" } },
    { "scope": ["entity.other.attribute-name", "variable.other.readwrite", "variable.parameter"], "settings": { "foreground": "#A6A296" } },
    { "scope": ["string", "string.quoted"], "settings": { "foreground": "#7FCB97" } },
    { "scope": ["constant.numeric", "constant.language"], "settings": { "foreground": "#EFA36C" } },
    { "scope": ["punctuation", "meta.brace", "keyword.operator", "comment"], "settings": { "foreground": "#79756A" } }
  ]
}
```

**highlight.ts** (lazy singleton, injectable for tests):
```ts
let highlighterPromise: Promise<(code: string) => string> | null = null;

export function setHighlighterForTests(fn: ((code: string) => string) | null) {
  highlighterPromise = fn ? Promise.resolve(fn) : null;
}

export function getHighlighter(): Promise<(code: string) => string> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, tsx, theme] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('@shikijs/langs/tsx'),
      import('./instrument-dark.json'),
    ]);
    const shiki = await createHighlighterCore({
      themes: [theme.default ?? theme],
      langs: [tsx],
      engine: createJavaScriptRegexEngine(),
    });
    return (code: string) => shiki.codeToHtml(code, { lang: 'tsx', theme: 'instrument-dark' });
  })();
  return highlighterPromise;
}
```
(Exact shiki v4 import shapes: implementer verifies against the installed package's docs/types and adapts import specifiers if they differ — behavior contract, lazy + core + tsx + custom theme, is fixed.)

**code-snippet.ts** (complete):
```ts
import type { AnyControlDef } from '@tickets/ui/gallery';

function fmt(v: unknown): string {
  if (typeof v === 'string') return `"${v.replace(/"/g, '\\"')}"`;
  return `{${String(v)}}`;
}

// Generate the JSX for the current control values. Omits props at their
// initial/undefined values; `true` renders as a bare flag; the `children`
// control renders as element children; >3 set props wrap one-per-line.
export function generateSnippet(
  component: string,
  controls: Record<string, AnyControlDef>,
  values: Record<string, unknown>,
): { code: string; omitted: string[] } {
  const omitted: string[] = [];
  const props: string[] = [];
  let children = '';
  for (const [key, def] of Object.entries(controls)) {
    const v = values[key];
    if (key === 'children') {
      children = typeof v === 'string' ? v : '';
      continue;
    }
    if (v === undefined || v === def.initial) {
      omitted.push(key);
      continue;
    }
    props.push(v === true ? key : `${key}=${fmt(v)}`);
  }
  const open =
    props.length > 3
      ? `<${component}\n  ${props.join('\n  ')}\n>`
      : props.length > 0
        ? `<${component} ${props.join(' ')}>`
        : `<${component}>`;
  const code = children ? `${open}${props.length > 3 ? '\n  ' : ''}${children}${props.length > 3 ? '\n' : ''}</${component}>` : `${open.replace(/>$/, ' />')}`;
  return { code, omitted };
}
```
Component name: `demo.meta.title.replace(/\s+/g, '')`.

**code-tab.tsx**: `GENERATED FROM CURRENT CONTROLS` mono label; code block = `rounded-card p-5 font-mono text-ui pg-code-block`. The design fixes the block surface DARK (`#25231D`) in BOTH themes, so no theme-flipping token fits — add one static rule to the playground's `styles.css`: `.pg-code-block { background: #25231D; }` plus the line-number rules from the source-tab step. (Permitted: the hardcoded-value scanner's roots are `apps/web/src` and `apps/eer/src` only — package CSS is not scanned, and this is a design-mandated fixed surface like the shiki theme colors.) Highlighted HTML injected via `dangerouslySetInnerHTML` from `getHighlighter()`, loading state = plain `<pre>` with text; `⧉ Copy` ghost button (navigator.clipboard.writeText, existing useCopy-style inline state); omitted footnote `size unset → omitted · …` from `omitted` array.
**source-tab.tsx**: header filename (`demo.path.split('/').pop()!.toUpperCase()`) + `${source.split('\n').length} lines`; same block; line numbers via shiki's rendered lines + CSS counters (`.pg-code-block code { counter-reset: line } .pg-code-block .line::before { counter-increment: line; content: counter(line); … }` in styles.css); Copy button. `source === undefined` → muted "source unavailable" note.
- [ ] Tests: `code-snippet.test.ts` (omission incl. allowNone-undefined, boolean flag, children, >3 wrap, self-close when no children, quote escaping, omitted list); tab tests with `setHighlighterForTests((c) => `<pre>HL:${c}</pre>`)`. Gate incl. `pnpm build` (verifies shiki chunks split — check `apps/web/dist/assets` has a separate shiki chunk, report its name). Commit `feat(playground): code and source tabs with instrument shiki theme`.

---

### Task 6: Split themes + matrix mode

Design refs: split 438-472, matrix 475-515.

**Files:**
- Create: `src/theme-split.tsx` (+ test), `src/matrix-mode.tsx` (+ test)
- Modify: `component-page.tsx` (header gains Split-themes switch — token-styled native checkbox-as-switch like design 98; Preview stage wraps in ThemeSplit when on), `playground-card.tsx` or stage container (matrix entry: when playground has ≥2 select controls, a `Matrix` toggle in the stage; matrix replaces the states grid while active)

**theme-split.tsx**: `({ children })` renders 2-col grid; each panel `rounded-card border p-4` with `data-theme="light"` / `data-theme="dark"` on the wrapper + its own `bg-app` + mono caption `light`/`dark`. Test: both wrappers present with correct `data-theme` attrs and captions.
**matrix-mode.tsx** (logic exported for tests):
```ts
export function matrixValues(
  controls: Record<string, AnyControlDef>,
  values: Record<string, unknown>,
  xKey: string,
  yKey: string,
): { x: string[]; y: string[]; cell: (xi: number, yi: number) => Record<string, unknown> } {
  const xDef = controls[xKey]; const yDef = controls[yKey];
  if (xDef?.kind !== 'select' || yDef?.kind !== 'select') throw new Error('matrix axes must be select controls');
  return {
    x: [...xDef.options], y: [...yDef.options],
    cell: (xi, yi) => ({ ...values, [xKey]: xDef.options[xi], [yKey]: yDef.options[yi] }),
  };
}
```
UI: axis selects (`rows: <control> ▾` / `columns: <control> ▾`, native selects listing the playground's select-control keys, defaults = first two), right caption `matrix: <y> × <x>` mono; grid `grid` with `gridTemplateColumns: '104px repeat(N, 1fr)'` inline (computed layout — allowed), uppercase mono axis labels, each cell a raised card rendering `playground.render(cell(xi,yi))`. Tests: cross-product size, held values, non-select rejection.
- [ ] Gate; commit `feat(playground): split-theme stage and matrix mode`.

---

### Task 7: ⌘K command palette + sidebar filter

Design ref: 518-583 (+ sidebar filter input 43-46).

**Files:**
- Install: `pnpm --filter @tickets/playground add cmdk`
- Create: `src/command-palette.tsx` (+ test)
- Modify: `gallery-shell.tsx` (sidebar filter input with `⌘K` chip; global keydown for meta+K/ctrl+K opens palette; palette navigates via `location.hash`)

**command-palette.tsx**: `Command.Dialog` (open/onOpenChange), search input row (`⌕` glyph + input + right hint "Jump to component…"), groups per demo group, `Command.Item` per demo `onSelect={() => { window.location.hash = `#${slug}`; onOpenChange(false); }}`, selected row styling accent-subtle, footer hints bar `↑↓ navigate · ↵ open · esc close` (mono label on `bg-app`). Style via cmdk's data attrs + token classes (`[&_[cmdk-item][data-selected=true]]:bg-accent-subtle` utility selectors are fine). Sidebar filter input: controlled text filtering the sidebar list (`title.toLowerCase().includes(q)`); ⌘K chip opens the dialog.
- [ ] Tests: palette lists demos grouped; typing filters (cmdk built-in — assert an item disappears); select updates `location.hash`; sidebar filter narrows links. Gate; commit `feat(playground): command palette and sidebar filter`.

---

### Task 8: A11y tab (axe-core)

Design refs: findings 369-410, all-clear 413-435.

**Files:**
- Install: `pnpm --filter @tickets/playground add axe-core`
- Create: `src/a11y-tab.tsx` (+ test), `src/axe.ts` (lazy loader with test seam, same shape as highlight.ts: `getAxe(): Promise<(el: Element) => Promise<AxeResults>>` + `setAxeForTests`)
- Modify: `component-page.tsx` (wire tab; the audit runs against the PREVIEW container ref — the hidden-not-unmounted preview div from Task 4, so the audit sees real rendered states + playground)

**a11y-tab.tsx**: meta line `last audit · <relative time> · axe-core <version>` (version from result `testEngine.version`; before first run: `no audit yet`), `Run audit` secondary button; results: violations → cards per design (impact chip: `critical|serious` → `bg-danger-subtle text-danger`, `moderate|minor` → `bg-opt-orange-subtle text-opt-orange`; rule id; description; first target selector in a mono inset chip; `Learn more ↗` → `helpUrl`); zero violations → kind-done-subtle banner `✓ No violations found · <n> elements checked` (n = `passes.reduce((a,p)=>a+p.nodes.length,0)` — implementer verifies the field shape against axe types and adapts, reporting the choice).
- [ ] Tests with `setAxeForTests` returning canned results (2 violations incl. impact mapping; empty → banner). Gate; commit `feat(playground): a11y audit tab`.

---

### Task 9: Final sweep

- [ ] Full global gate + `pnpm --filter @tickets/eer test` (same 7 pre-existing failures only).
- [ ] Bundle check: `apps/web/dist/assets` — shiki/axe in separate lazy chunks, main bundle delta vs pre-branch reported.
- [ ] Controller (not subagent): browser pass on :4650 and web dev — tabs, snippet updates live, source renders, split themes, matrix, ⌘K, a11y run, Reset, rail drag persistence, both themes.
- [ ] Commit any residue; final whole-branch review follows per SDD.
