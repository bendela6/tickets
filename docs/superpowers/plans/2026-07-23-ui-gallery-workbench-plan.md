# @tickets/ui Phase 2 — Gallery Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the gallery engine in `@tickets/ui`, a standalone dev app on :4650, port all ~20 sections of web's monolithic `/gallery` route into colocated `*.demo.tsx` files, and make `/gallery` a thin consumer.

**Architecture:** Engine (`types` + `collectDemos` + `StateGrid` + `GalleryShell`) lives in `packages/web/ui/src/gallery/` and is consumed by two hosts: a minimal vite dev app inside the package (globs package demos — just the swatches seed in P2) and web's `gallery-route.tsx` (merges package demos + its own glob). Demo files colocate with components (`apps/web/src/ui/*.demo.tsx` until P3 moves them). A coverage test ratchets sibling-demo existence.

**Tech stack:** React 19, TypeScript, Tailwind v4 (`@tailwindcss/vite`, `@source`), vite, vitest + testing-library, `import.meta.glob`.

**Spec:** `docs/superpowers/specs/2026-07-23-ui-gallery-workbench-design.md`

## Global constraints

- Conventional commits `feat(ui): …` / `refactor(web): …`; one commit per task.
- Repo green after every commit: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/web typecheck && pnpm build`. `tokens:verify` must stay green (the scanner now scans demo files too — no hex/arbitrary color values in demos; use tokens).
- Demo contract (exact): `export const meta: DemoMeta` (`{ title: string; group: string; order?: number }`) and `export const states: DemoState[]` (`{ name: string; render: () => ReactNode }[]`). No default exports in demo files.
- Demo groups (exact strings): `Foundation`, `Form controls`, `Pickers`, `Display`, `Overlays`, `AI session`.
- Slugs: `kebab(meta.title)` for the demo, `` `${demoSlug}--${kebab(state.name)}` `` for a state (kebab: lowercase, non-alphanumeric runs → single `-`, trimmed).
- Port fidelity: every state shown in the old `apps/web/src/routes/gallery-route.tsx` (as of merge `a3b87f4`) must exist as a demo state; fixtures move verbatim (SAMPLE_STREAM, KINDS, OPTION_COLORS, PRIORITY_OPTIONS, LABEL_OPTIONS, STATUSES, SESSION_STATUSES, `NOW`).
- Dev app port 4650, `strictPort: true`.
- Demos import components RELATIVELY (`./button`) inside `src/ui`, and `@tickets/ui/cn` etc. for package modules — never `../routes/...`.

---

### Task 1: Engine — types + `collectDemos` (TDD)

**Files:**
- Create: `packages/web/ui/src/gallery/types.ts`, `packages/web/ui/src/gallery/collect-demos.ts`, `packages/web/ui/src/gallery/index.ts`
- Test: `packages/web/ui/src/gallery/collect-demos.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DemoMeta`, `DemoState`, `DemoModule`, `CollectedDemo = { slug: string; meta: DemoMeta; states: (DemoState & { slug: string })[] } | { path: string; error: string }`, `collectDemos(glob: Record<string, unknown>): CollectedDemo[]`, `sortDemos(demos: CollectedDemo[]): CollectedDemo[]` (exported comparator wrapper — Task 8 uses it to merge package + web demo lists), `kebab(s: string): string`. `index.ts` re-exports all of these (Task 2 adds the components to it).

- [ ] **Step 1: Write `types.ts`**

```ts
import type { ReactNode } from 'react';

export interface DemoMeta {
  title: string;
  group: string;
  order?: number;
}

export interface DemoState {
  name: string;
  render: () => ReactNode;
}

export interface DemoModule {
  meta: DemoMeta;
  states: DemoState[];
}

export type CollectedDemo =
  | { slug: string; meta: DemoMeta; states: (DemoState & { slug: string })[] }
  | { path: string; error: string };

export function isDemoError(d: CollectedDemo): d is { path: string; error: string } {
  return 'error' in d;
}
```

- [ ] **Step 2: Write the failing test**

`packages/web/ui/src/gallery/collect-demos.test.ts`:
```ts
import { collectDemos, kebab } from './collect-demos';
import { isDemoError } from './types';

const good = (title: string, group: string, order?: number) => ({
  meta: { title, group, order },
  states: [{ name: 'Default state', render: () => null }],
});

describe('kebab', () => {
  it('lowercases and collapses non-alphanumerics', () => {
    expect(kebab('Status badges — shape-coded')).toBe('status-badges-shape-coded');
    expect(kebab('Button')).toBe('button');
  });
});

describe('collectDemos', () => {
  it('collects valid modules with demo and state slugs', () => {
    const out = collectDemos({ './button.demo.tsx': good('Button', 'Form controls') });
    expect(out).toHaveLength(1);
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.slug).toBe('button');
    expect(d.states[0]!.slug).toBe('button--default-state');
  });

  it('sorts by group, then order (unset last), then title', () => {
    const out = collectDemos({
      'a': good('Zeta', 'Form controls'),
      'b': good('Alpha', 'Form controls', 2),
      'c': good('Beta', 'Form controls', 1),
      'd': good('Anything', 'Display'),
    });
    const titles = out.map((d) => (isDemoError(d) ? '!' : d.meta.title));
    expect(titles).toEqual(['Anything', 'Beta', 'Alpha', 'Zeta']);
  });

  it('turns malformed modules into error entries instead of throwing', () => {
    const out = collectDemos({
      './broken.demo.tsx': { meta: { title: 'X' } },              // no states
      './worse.demo.tsx': { meta: { title: 'Y', group: 'G' }, states: [{ name: 'a', render: 'nope' }] },
      './fine.demo.tsx': good('Fine', 'Display'),
    });
    const errors = out.filter(isDemoError);
    expect(errors).toHaveLength(2);
    expect(errors[0]!.path).toBe('./broken.demo.tsx');
    expect(errors[0]!.error).toMatch(/states/);
    expect(out.filter((d) => !isDemoError(d))).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test -- collect-demos`
Expected: FAIL — cannot resolve `./collect-demos`.

- [ ] **Step 4: Implement `collect-demos.ts`**

```ts
import type { CollectedDemo, DemoModule } from './types';

export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validate(mod: unknown): { ok: true; demo: DemoModule } | { ok: false; error: string } {
  const m = mod as Partial<DemoModule> | null;
  if (!m || typeof m !== 'object') return { ok: false, error: 'module is not an object' };
  if (!m.meta || typeof m.meta.title !== 'string' || typeof m.meta.group !== 'string') {
    return { ok: false, error: 'missing meta { title, group }' };
  }
  if (!Array.isArray(m.states) || m.states.length === 0) {
    return { ok: false, error: 'missing non-empty states[]' };
  }
  for (const s of m.states) {
    if (typeof s?.name !== 'string' || typeof s?.render !== 'function') {
      return { ok: false, error: 'each state needs { name: string, render: () => ReactNode }' };
    }
  }
  return { ok: true, demo: m as DemoModule };
}

function compare(a: CollectedDemo, b: CollectedDemo): number {
  if ('error' in a || 'error' in b) return 'error' in a ? 1 : -1;
  const g = a.meta.group.localeCompare(b.meta.group);
  if (g !== 0) return g;
  const ao = a.meta.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.meta.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.meta.title.localeCompare(b.meta.title);
}

// Re-sort a merged list (e.g. package demos + app demos in the web route).
export function sortDemos(demos: CollectedDemo[]): CollectedDemo[] {
  return [...demos].sort(compare);
}

export function collectDemos(glob: Record<string, unknown>): CollectedDemo[] {
  const collected: CollectedDemo[] = Object.entries(glob).map(([path, mod]) => {
    const v = validate(mod);
    if (!v.ok) return { path, error: v.error };
    const slug = kebab(v.demo.meta.title);
    return {
      slug,
      meta: v.demo.meta,
      states: v.demo.states.map((s) => ({ ...s, slug: `${slug}--${kebab(s.name)}` })),
    };
  });
  return sortDemos(collected);
}
```

`index.ts`: `export * from './types'; export * from './collect-demos';`

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck`
Expected: PASS (existing 20 + new).

- [ ] **Step 6: Commit**

```bash
git add packages/web/ui/src/gallery
git commit -m "feat(ui): gallery demo contract and collectDemos"
```

---

### Task 2: Engine — `StateGrid` + `GalleryShell` + package demo glob + exports

**Files:**
- Create: `packages/web/ui/src/gallery/state-grid.tsx`, `packages/web/ui/src/gallery/gallery-shell.tsx`, `packages/web/ui/src/gallery/demos.ts`
- Modify: `packages/web/ui/src/gallery/index.ts`, `packages/web/ui/package.json` (exports), `packages/web/ui/vitest.config.ts` (jsdom for tsx tests), `packages/web/ui/tsconfig.json` (jsx)
- Test: `packages/web/ui/src/gallery/state-grid.test.tsx`

**Interfaces:**
- Consumes: Task 1's types + `collectDemos`.
- Produces: `StateGrid({ demo })` (a non-error `CollectedDemo`), `GalleryShell({ demos, title, providers? })` where `providers?: (children: ReactNode) => ReactNode`; `packageDemos: CollectedDemo[]` from `demos.ts`; package exports `"./gallery"` and `"./gallery/demos"`.

- [ ] **Step 1: Config — tsx tests in the package**

`vitest.config.ts` becomes:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```
`tsconfig.json` compilerOptions gains `"jsx": "react-jsx"`. Add devDependencies: `@vitejs/plugin-react@^6.0.1`, `jsdom@^29.1.1`, `@testing-library/react@^16.3.2`, `react@^19.2.5`, `react-dom@^19.2.5` (versions mirror `packages/web/form/package.json`). Run `pnpm install`.

- [ ] **Step 2: Write the failing test**

`state-grid.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { StateGrid } from './state-grid';
import { collectDemos } from './collect-demos';
import { isDemoError } from './types';

const demo = collectDemos({
  './x.demo.tsx': {
    meta: { title: 'Button', group: 'Form controls' },
    states: [
      { name: 'primary', render: () => <button>New ticket</button> },
      { name: 'loading', render: () => <button>Creating…</button> },
    ],
  },
})[0]!;

describe('StateGrid', () => {
  it('renders the title, one labeled cell per state, and stable ids', () => {
    if (isDemoError(demo)) throw new Error(demo.error);
    render(<StateGrid demo={demo} />);
    expect(screen.getByRole('heading', { name: 'Button' })).toBeTruthy();
    expect(screen.getByText('primary')).toBeTruthy();
    expect(document.getElementById('button--loading')).toBeTruthy();
    expect(screen.getByText('New ticket')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @tickets/ui test -- state-grid`
Expected: FAIL — cannot resolve `./state-grid`.

- [ ] **Step 4: Implement `state-grid.tsx`**

```tsx
import { cn } from '../cn';
import type { CollectedDemo } from './types';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

// One component's demo: heading + a labeled cell per state. Cell ids are the
// screenshot/deep-link anchors (`#button--loading`).
export function StateGrid({ demo }: { demo: LiveDemo }) {
  return (
    <section id={demo.slug} className="flex flex-col gap-3">
      <h2 className="font-sans text-label font-medium uppercase tracking-wider text-ink-2">
        {demo.meta.title}
      </h2>
      <div className="flex flex-wrap items-start gap-4 rounded-card border border-hairline bg-raised p-4">
        {demo.states.map((state) => (
          <figure key={state.slug} id={state.slug} className="m-0 flex flex-col gap-1.5">
            <div className="flex items-start">{state.render()}</div>
            <figcaption className="font-mono text-label text-ink-3">{state.name}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function DemoErrorCard({ path, error }: { path: string; error: string }) {
  return (
    <section className="rounded-card border border-danger bg-danger-subtle p-4 font-mono text-meta text-danger">
      {path}: {error}
    </section>
  );
}
```

- [ ] **Step 5: Implement `gallery-shell.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import { DemoErrorCard, StateGrid } from './state-grid';
import { isDemoError, type CollectedDemo } from './types';

// Full gallery page: grouped nav + theme toggle + demo grids. `providers`
// wraps the demo area — web passes its Tooltip/Toast providers until P3
// moves those primitives into this package.
export function GalleryShell({
  demos,
  title,
  providers = (children) => children,
}: {
  demos: CollectedDemo[];
  title: string;
  providers?: (children: ReactNode) => ReactNode;
}) {
  const [, force] = useState(0);
  const groups = [...new Set(demos.filter((d) => !isDemoError(d)).map((d) => d.meta.group))];

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    force((n) => n + 1);
  }

  return (
    <div className="min-h-screen bg-app px-8 py-10 font-sans text-ink">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-sans text-display font-semibold text-ink">{title}</h1>
            <p className="mt-1 font-sans text-meta text-ink-2">
              Instrument control library. Compare against docs/design/design-system.html.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="h-9 rounded-ctrl border border-control bg-raised px-3.5 font-sans text-ui text-ink hover:bg-inset"
          >
            Toggle theme
          </button>
        </header>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-meta text-ink-2">
          {groups.map((g) => (
            <span key={g} className="font-medium uppercase tracking-wider text-ink-3">
              {g}
            </span>
          ))}
        </nav>
        {providers(
          <div className="flex flex-col gap-10">
            {demos.map((d) =>
              isDemoError(d) ? (
                <DemoErrorCard key={d.path} path={d.path} error={d.error} />
              ) : (
                <StateGrid key={d.slug} demo={d} />
              ),
            )}
          </div>,
        )}
      </div>
    </div>
  );
}
```
Note `text-display` on the h1 — the first consumer of a P1 type-scale token (deliberate, replaces the old `text-[22px]`).

- [ ] **Step 6: `demos.ts` + exports + index**

`demos.ts`:
```ts
import { collectDemos } from './collect-demos';

// The package's own demos. import.meta.glob is executed by the CONSUMER's
// vite (web or the dev app), relative to this file.
export const packageDemos = collectDemos(
  import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
);
```
`index.ts` adds: `export { StateGrid, DemoErrorCard } from './state-grid'; export { GalleryShell } from './gallery-shell';`
`package.json` exports adds: `"./gallery": "./src/gallery/index.ts", "./gallery/demos": "./src/gallery/demos.ts"`.
Note: `import.meta.glob` types need vite client types — add `"types": ["vitest/globals", "node", "vite/client"]` in tsconfig.

- [ ] **Step 7: Verify + commit**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck && pnpm build`
Expected: PASS.
```bash
git add -A && git commit -m "feat(ui): StateGrid, GalleryShell, and package demo glob"
```

---

### Task 3: Package dev app on :4650 + swatches seed demo

**Files:**
- Create: `packages/web/ui/dev/index.html`, `packages/web/ui/dev/main.tsx`, `packages/web/ui/dev/styles.css`, `packages/web/ui/dev/vite.config.ts`, `packages/web/ui/src/swatches.demo.tsx`
- Modify: `packages/web/ui/package.json` (script + devDeps), `packages/web/ui/tsconfig.json` (include dev)

**Interfaces:**
- Consumes: `GalleryShell`, `packageDemos` (Task 2), `SWATCHES` (P1).
- Produces: `pnpm --filter @tickets/ui dev` serving :4650.

- [ ] **Step 1: Seed demo `src/swatches.demo.tsx`**

```tsx
import { runtimeStyle } from './runtime-style';
import { SWATCHES } from './swatches';

export const meta = { title: 'Swatches', group: 'Foundation' };

export const states = [
  {
    name: 'presets',
    render: () => (
      <div className="flex gap-2">
        {SWATCHES.map((hex) => (
          <span
            key={hex}
            title={hex}
            className="size-8 rounded-ctrl border border-hairline bg-(--swatch)"
            style={runtimeStyle({ '--swatch': hex })}
          />
        ))}
      </div>
    ),
  },
];
```
(Dynamic user-data color via CSS var — the scanner does not flag `style` fed from data constants; SWATCHES is token-derived.)

- [ ] **Step 2: Dev app files**

`dev/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@tickets/ui — gallery</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

`dev/styles.css`:
```css
@import '@tickets/ui/tokens.css';
@source '../src';
```

`dev/main.tsx`:
```tsx
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { GalleryShell } from '../src/gallery';
import { packageDemos } from '../src/gallery/demos';

createRoot(document.getElementById('root')!).render(
  <GalleryShell demos={packageDemos} title="@tickets/ui — gallery" />,
);
```

`dev/vite.config.ts`:
```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 4650, strictPort: true },
});
```

Config placement (final form): the config lives at `packages/web/ui/vite.config.ts` (NOT in dev/) with `root: 'dev'` added to the `defineConfig` object, and the package script is `"dev": "vite"`. Delete the `dev/vite.config.ts` path from this task's file list — create `packages/web/ui/vite.config.ts` instead with the same content plus `root: 'dev'`. devDependencies added: `vite@^7` (mirror apps/web's version — check `apps/web/package.json` and match), `@tailwindcss/vite@^4.3.2`, `@fontsource/ibm-plex-sans@^5.2.8`, `@fontsource/ibm-plex-mono@^5.2.7`. `tsconfig.json` include becomes `["src", "dev"]`. Run `pnpm install`.

- [ ] **Step 3: Boot check**

Run: `pnpm --filter @tickets/ui dev` in background; `curl -s -o /dev/null -w "%{http_code}" http://localhost:4650/` → `200`; then curl the page and confirm it contains `id="swatches"` after JS render is not verifiable via curl — instead verify the module graph: `curl -s http://localhost:4650/main.tsx | grep -c gallery` ≥ 1. Kill the dev server.
Also: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck && pnpm --filter @tickets/ui tokens:verify` (scanner sees the new demo — must stay clean).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): standalone gallery dev app on 4650 with swatches seed demo"
```

---

### Task 4: Demo wave A — form controls (8 files)

**Files (create, all under `apps/web/src/ui/`):** `button.demo.tsx`, `input.demo.tsx`, `textarea.demo.tsx`, `number-input.demo.tsx`, `checkbox.demo.tsx`, `switch.demo.tsx`, `radio-group.demo.tsx`, `field-label.demo.tsx`

**Interfaces:**
- Consumes: demo contract from Task 1 (`import type { DemoMeta, DemoState } from '@tickets/ui/gallery'` — typing optional but encouraged: `export const meta = {...} satisfies DemoMeta`).
- Produces: demo files discovered by Task 8's glob; no imports from routes.

**Port source:** the old sections in `apps/web/src/routes/gallery-route.tsx` @ merge `a3b87f4` — "Buttons — variants" (lines 242-253), "Buttons — sizes" (255-262), "Text inputs" (264-290), "Checkbox · switch · radio" (292-310), "Dates & numbers" NumberInputDemo (207-210). Transcribe each rendered element into a named state. Do not invent new states; do not drop any.

- [ ] **Step 1: Write the 8 demo files**

Pattern (complete example — `button.demo.tsx`; the other seven follow the same shape with their section's JSX):
```tsx
import { Button } from './button';

export const meta = { title: 'Button', group: 'Form controls', order: 1 };

export const states = [
  { name: 'primary', render: () => <Button variant="primary">New ticket</Button> },
  { name: 'secondary', render: () => <Button variant="secondary">Save view</Button> },
  { name: 'ghost', render: () => <Button variant="ghost">Cancel</Button> },
  { name: 'destructive', render: () => <Button variant="destructive">Archive</Button> },
  { name: 'loading', render: () => <Button variant="primary" loading>Creating…</Button> },
  { name: 'disabled', render: () => <Button variant="secondary" disabled>Disabled</Button> },
  { name: 'size compact', render: () => <Button size="compact">Compact 28</Button> },
  { name: 'size regular', render: () => <Button size="regular">Regular 36</Button> },
  { name: 'size touch', render: () => <Button size="touch">Touch 44</Button> },
  { name: 'size icon', render: () => <Button size="icon" aria-label="More">⋯</Button> },
];
```
Stateful controls (NumberInput, RadioGroup) wrap a small fixture component INSIDE the demo file (hooks can't run in `render` directly):
```tsx
function NumberInputFixture() {
  const [estimate, setEstimate] = useState<number | null>(5);
  return <NumberInput value={estimate} onChange={setEstimate} min={0} max={13} />;
}
// state: { name: 'estimate 0–13', render: () => <NumberInputFixture /> }
```
`field-label.demo.tsx` covers FieldLabel + FieldError together (the old "Text inputs" invalid-key example, lines 268-280): states `label + required`, `error text` — importing both `./field-label` and `./field-error`.
State names: descriptive lowercase (`'invalid'`, `'compact'`, `'with placeholder'`) matching what the old section showed.

- [ ] **Step 2: Verify + commit**

Run: `pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/web test && pnpm --filter @tickets/ui tokens:verify`
Expected: green (demos compile; nothing renders them yet).
```bash
git add apps/web/src/ui
git commit -m "feat(web): form-control demo files (wave A)"
```

---

### Task 5: Demo wave B — pickers (5 files)

**Files (create under `apps/web/src/ui/`):** `combobox.demo.tsx`, `multi-combobox.demo.tsx`, `status-select.demo.tsx`, `date-picker.demo.tsx`, `popover.demo.tsx`

**Port source:** "Comboboxes — searchable single & multi" (gallery-route 312-338) with fixtures PRIORITY_OPTIONS (111-116), LABEL_OPTIONS (118-124), STATUSES (126-133); DatePickerDemo (198-205). Fixtures are copied verbatim into the demo file that uses them. All four are stateful → fixture components per the Task 4 pattern. `popover.demo.tsx` is NEW (no old section):
```tsx
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';

export const meta = { title: 'Popover', group: 'Pickers' };

export const states = [
  {
    name: 'basic',
    render: () => (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary">Open popover</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="font-sans text-ui text-ink">Anchored content.</p>
        </PopoverContent>
      </Popover>
    ),
  },
];
```
(Adjust part names to the actual exports of `./popover` — read the file first; if it exports different subcomponents, mirror its test's usage.)

- [ ] **Verify + commit** (same gate as Task 4): `feat(web): picker demo files (wave B)`

---

### Task 6: Demo wave C — display & badges (9 files)

**Files (create under `apps/web/src/ui/`):** `status-badge.demo.tsx`, `option-chip.demo.tsx`, `type-badge.demo.tsx`, `item-key.demo.tsx`, `kind-glyph.demo.tsx`, `avatar.demo.tsx`, `session-kind-glyph.demo.tsx`, `session-status-pill.demo.tsx`, `relative-date.demo.tsx`

**Port source:** "Status badges" (340-344, fixture KINDS 36-42), "Option chips — 11-color palette" (399-403, fixture OPTION_COLORS 84-96), "Type · key · avatars" (405-415), "AI session — status pills" (346-355, fixture SESSION_STATUSES 74-82), "AI session — kind glyphs" (357-360), "Dates & numbers" RelativeDate rows (427-431, fixture `NOW` line 136 — keep the fixed instant for determinism). `kind-glyph.demo.tsx` is NEW: one state per StatusKind (`todo/active/blocked/done/dropped`) rendering `<KindGlyph kind={...} />` inside a `text-kind-*`-colored span (mirror how `status-badge.tsx` wraps it).
Group: `Display` — except session-kind-glyph + session-status-pill which use group `AI session`.
Map-driven sections become one state per entry (e.g. 5 StatusBadge states named by kind, 11 OptionChip states named by color).

- [ ] **Verify + commit** (same gate): `feat(web): display and badge demo files (wave C)`

---

### Task 7: Demo wave D — overlays + agent composites (7 files)

**Files:**
- Create under `apps/web/src/ui/`: `menu.demo.tsx`, `dialog.demo.tsx`, `tooltip.demo.tsx`, `toast.demo.tsx`
- Create under `apps/web/src/components/agent/`: `message-stream.demo.tsx`, `cost-meter.demo.tsx`, `prompt-composer.demo.tsx`

**Port source:** MenuDemo (gallery-route 138-154), DialogDemo (156-174), TooltipDemo (176-182), ToastDemo (184-196) — each becomes a fixture component + one state (`'trigger'`); interaction still works live in the gallery. Agent: "message stream" (362-366) + "approval card" (368-385) as two states of `message-stream.demo.tsx` with SAMPLE_STREAM (44-72) moved in verbatim; "cost meter" (387-391) → three states (uncapped/capped/over); ComposerDemo (440-467) moves into `prompt-composer.demo.tsx` as fixture + one state. Group `Overlays` for the four ui files, `AI session` for agent files. Tooltip/Toast demos rely on the shell-level providers (web passes them in Task 8) — they will render provider-less in the package dev app only after P3, which is fine because these files live in apps/web until then.

- [ ] **Verify + commit** (same gate): `feat(web): overlay and AI-session demo files (wave D)`

---

### Task 8: `/gallery` becomes a thin consumer; delete the monolith

**Files:**
- Modify: `apps/web/src/routes/gallery-route.tsx` (full rewrite, ~40 lines)

**Interfaces:**
- Consumes: `GalleryShell` + `collectDemos` from `@tickets/ui/gallery`, `packageDemos` from `@tickets/ui/gallery/demos`, web providers `ToastProvider`/`TooltipProvider` from `../ui/toast` / `../ui/tooltip`.

- [ ] **Step 1: Rewrite the route**

```tsx
import { createRoute } from '@tanstack/react-router';
import { collectDemos, GalleryShell, sortDemos } from '@tickets/ui/gallery';
import { packageDemos } from '@tickets/ui/gallery/demos';
import { ToastProvider } from '../ui/toast';
import { TooltipProvider } from '../ui/tooltip';
import { rootRoute } from './root-route';

const webDemos = collectDemos(
  import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
);

function GalleryScreen() {
  return (
    <GalleryShell
      demos={sortDemos([...packageDemos, ...webDemos])}
      title="Instrument — primitives gallery"
      providers={(children) => (
        <TooltipProvider>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      )}
    />
  );
}

export const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: GalleryScreen,
});
```
Everything else in the old file is deleted (fixtures now live in demo files). Because each `collectDemos` call sorts only its own list, the route wraps the concatenation: `demos={sortDemos([...packageDemos, ...webDemos])}` — import `sortDemos` from `@tickets/ui/gallery` (defined in Task 1).

- [ ] **Step 2: Visual verification**

Run `pnpm dev` (or web dev directly), open `http://localhost:4620/gallery`: every old section present as a demo grid, both themes via toggle, dialog/toast/tooltip/menu interactions work, no error cards. Check `#button--loading` anchors resolve.

- [ ] **Step 3: Full gate + commit**

Run: `pnpm --filter @tickets/web test && pnpm --filter @tickets/web typecheck && pnpm --filter @tickets/ui test && pnpm build && pnpm --filter @tickets/ui tokens:verify`
```bash
git add -A && git commit -m "refactor(web): /gallery renders from globbed demo files"
```

---

### Task 9: Demo-coverage ratchet test + final sweep

**Files:**
- Test: `apps/web/src/ui/demo-coverage.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Non-visual helper modules exempted from the sibling-demo rule. Additions
// to this list are the documented exception path — justify in the PR.
const ALLOWLIST = new Set([
  'combobox-list', // internal list engine, exercised via combobox/multi-combobox demos
  'use-directory-tree', // hook
  'directory-tree', // fetch-coupled; demo lands with its P3 move
  'field-error', // covered by field-label.demo.tsx
]);

describe('demo coverage', () => {
  it('every ui component module has a sibling .demo.tsx (or an allowlist entry)', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(dir);
    const components = files
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => !/\.(test|demo)\.tsx?$/.test(f))
      .map((f) => f.replace(/\.tsx?$/, ''))
      .filter((name) => !['cn', 'variants'].includes(name)); // deleted in P1; guard against strays
    const missing = components.filter(
      (name) => !ALLOWLIST.has(name) && !files.includes(`${name}.demo.tsx`),
    );
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — it should pass immediately** (waves A–D covered everything else). If it fails, the failure list IS the port gap — write the missing demos, don't grow the allowlist.

- [ ] **Step 3: Final gates**

`pnpm typecheck && pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test && pnpm --filter @tickets/eer test && pnpm build && pnpm --filter @tickets/ui tokens:verify`
(eer: expect the same 7 pre-existing failures, nothing new.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/ui/demo-coverage.test.ts
git commit -m "test(web): demo-coverage ratchet for ui components"
```
