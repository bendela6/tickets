# @tickets/ui Gallery Navigation + Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sidebar navigation with per-component pages and a typed prop-controls playground in the @tickets/ui gallery, plus playground declarations for 24 demos.

**Architecture:** Engine-first: `controls.ts` (typed constructors + inference), playground validation + duplicate-slug guard in `collect-demos.ts`, `ControlsPanel`/`PlaygroundCard` (token-styled native inputs, app-independent), `GalleryShell` v2 (sidebar + `location.hash` selection). Then three demo waves add `playground` exports. Both hosts get everything with no host changes beyond one function swap in the web route.

**Tech stack:** React 19, TypeScript (const generics for inference), vitest (`expectTypeOf`), @testing-library/react (fireEvent — do NOT add user-event to the package), Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-07-23-ui-gallery-playground-design.md`

## Global constraints

- Conventional commits `feat(ui): …` / `feat(web): …`; one commit per task; repo green after every commit: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck && pnpm --filter @tickets/web test && pnpm build && pnpm --filter @tickets/ui tokens:verify`.
- Exact control vocabulary and defaults from the spec table: `select(options, {initial→options[0], label→key, allowNone→false})`, `boolean(initial→false, {label})`, `text(initial→'', {label, placeholder→''})`, `number(initial→0, {min, max, step→1, label})`. `allowNone` prepends "(unset)" → `undefined`.
- The panel uses NATIVE elements styled with Instrument tokens — never import components from `apps/web` into the package.
- Selection state lives in `location.hash` only; `#` / unknown hash = All view; `#slug` = single component; `#slug--state` = component + scroll to state.
- No hex/arbitrary color values anywhere (scanner gate).
- Playground `render` receives `ControlValues<C>` — fully inferred, no `any`.
- Demo playground controls may only reference props the component actually has — implementers verify against the component source and drop/adjust nonexistent ones, noting deviations in their report.

---

### Task 1: `controls.ts` — constructors, inference, `definePlayground`

**Files:**
- Create: `packages/web/ui/src/gallery/controls.ts`
- Test: `packages/web/ui/src/gallery/controls.test.ts`
- Modify: `packages/web/ui/src/gallery/index.ts` (add `export * from './controls';`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `SelectDef<T,N>`, `BooleanDef`, `TextDef`, `NumberDef`, `AnyControlDef`, `ControlValues<C>`, `PlaygroundDef<C>`, `AnyPlayground`, `select`, `boolean` (exported as `boolean` — shadows the global type name only inside importers that alias it; demos import it directly), `text`, `number`, `definePlayground`, `initialValues(controls)`.

- [ ] **Step 1: Write the failing test**

```ts
import { expectTypeOf } from 'vitest';
import { boolean, definePlayground, initialValues, number, select, text } from './controls';

describe('control constructors', () => {
  it('select defaults: initial=first option, allowNone=false', () => {
    const d = select(['a', 'b']);
    expect(d).toEqual({ kind: 'select', options: ['a', 'b'], initial: 'a', allowNone: false, label: undefined });
  });

  it('select with allowNone and no initial starts unset', () => {
    const d = select(['a', 'b'], { allowNone: true });
    expect(d.initial).toBeUndefined();
  });

  it('boolean/text/number defaults', () => {
    expect(boolean()).toEqual({ kind: 'boolean', initial: false, label: undefined });
    expect(text()).toEqual({ kind: 'text', initial: '', placeholder: '', label: undefined });
    expect(number()).toEqual({ kind: 'number', initial: 0, step: 1, min: undefined, max: undefined, label: undefined });
  });

  it('initialValues maps defs to their initial values', () => {
    const values = initialValues({
      variant: select(['primary', 'secondary'], { initial: 'secondary' }),
      size: select(['compact', 'regular'], { allowNone: true }),
      loading: boolean(true),
      label: text('hi'),
      count: number(3),
    });
    expect(values).toEqual({ variant: 'secondary', size: undefined, loading: true, label: 'hi', count: 3 });
  });

  it('definePlayground is identity and render values are inferred', () => {
    const p = definePlayground({
      controls: {
        variant: select(['primary', 'secondary']),
        size: select(['compact', 'regular'], { allowNone: true }),
        loading: boolean(),
        children: text('x'),
        max: number(1),
      },
      render: (v) => {
        expectTypeOf(v.variant).toEqualTypeOf<'primary' | 'secondary'>();
        expectTypeOf(v.size).toEqualTypeOf<'compact' | 'regular' | undefined>();
        expectTypeOf(v.loading).toEqualTypeOf<boolean>();
        expectTypeOf(v.children).toEqualTypeOf<string>();
        expectTypeOf(v.max).toEqualTypeOf<number>();
        return null;
      },
    });
    expect(typeof p.render).toBe('function');
    expect(p.render(initialValues(p.controls))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `pnpm --filter @tickets/ui test -- controls` → cannot resolve `./controls`.

- [ ] **Step 3: Implement `controls.ts`**

```ts
import type { ReactNode } from 'react';

export interface SelectDef<T extends string = string, N extends boolean = boolean> {
  kind: 'select';
  options: readonly T[];
  initial: T | undefined;
  allowNone: N;
  label: string | undefined;
}
export interface BooleanDef {
  kind: 'boolean';
  initial: boolean;
  label: string | undefined;
}
export interface TextDef {
  kind: 'text';
  initial: string;
  placeholder: string;
  label: string | undefined;
}
export interface NumberDef {
  kind: 'number';
  initial: number;
  min: number | undefined;
  max: number | undefined;
  step: number;
  label: string | undefined;
}
export type AnyControlDef = SelectDef | BooleanDef | TextDef | NumberDef;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControlValue<D> = D extends SelectDef<infer T, infer N>
  ? N extends true
    ? T | undefined
    : T
  : D extends BooleanDef
    ? boolean
    : D extends TextDef
      ? string
      : D extends NumberDef
        ? number
        : never;

export type ControlValues<C extends Record<string, AnyControlDef>> = { [K in keyof C]: ControlValue<C[K]> };

export interface PlaygroundDef<C extends Record<string, AnyControlDef> = Record<string, AnyControlDef>> {
  controls: C;
  render: (values: ControlValues<C>) => ReactNode;
}
export type AnyPlayground = PlaygroundDef;

export function select<const T extends readonly string[], const N extends boolean = false>(
  options: T,
  opts?: { initial?: T[number]; label?: string; allowNone?: N },
): SelectDef<T[number], N> {
  const allowNone = (opts?.allowNone ?? false) as N;
  return {
    kind: 'select',
    options,
    initial: opts?.initial ?? (allowNone ? undefined : options[0]),
    allowNone,
    label: opts?.label,
  };
}

function booleanControl(initial = false, opts?: { label?: string }): BooleanDef {
  return { kind: 'boolean', initial, label: opts?.label };
}
export { booleanControl as boolean };

function textControl(initial = '', opts?: { label?: string; placeholder?: string }): TextDef {
  return { kind: 'text', initial, placeholder: opts?.placeholder ?? '', label: opts?.label };
}
export { textControl as text };

function numberControl(
  initial = 0,
  opts?: { min?: number; max?: number; step?: number; label?: string },
): NumberDef {
  return { kind: 'number', initial, min: opts?.min, max: opts?.max, step: opts?.step ?? 1, label: opts?.label };
}
export { numberControl as number };

export function definePlayground<C extends Record<string, AnyControlDef>>(p: PlaygroundDef<C>): PlaygroundDef<C> {
  return p;
}

export function initialValues<C extends Record<string, AnyControlDef>>(controls: C): ControlValues<C> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(controls)) out[key] = def.initial;
  return out as ControlValues<C>;
}
```

- [ ] **Step 4: Add `export * from './controls';` to `index.ts`; run** `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck` → PASS.

- [ ] **Step 5: Commit** — `feat(ui): playground control constructors with typed inference`

---

### Task 2: playground validation + duplicate-slug guard in `collect-demos.ts`; drop dead import

**Files:**
- Modify: `packages/web/ui/src/gallery/collect-demos.ts`, `packages/web/ui/src/gallery/types.ts`, `packages/web/ui/src/gallery/state-grid.tsx:1` (delete the unused `import { cn } from '../cn';`)
- Test: `packages/web/ui/src/gallery/collect-demos.test.ts` (append)

**Interfaces:**
- Consumes: `AnyPlayground` from Task 1.
- Produces: `CollectedDemo` success-arm gains `playground?: AnyPlayground`; new export `prepareDemos(demos: CollectedDemo[]): CollectedDemo[]` = duplicate-slug guard (later duplicate → error entry `{ path: '#<slug>', error: 'duplicate demo slug "<slug>"' }`) then `sortDemos`. `collectDemos` applies `prepareDemos` to its own output (so single-glob duplicates are caught too).

- [ ] **Step 1: Append failing tests**

```ts
import { boolean as booleanControl, definePlayground, select } from './controls';
import { prepareDemos } from './collect-demos';

describe('playground validation', () => {
  const base = { meta: { title: 'B', group: 'G' }, states: [{ name: 's', render: () => null }] };

  it('carries a valid playground through', () => {
    const pg = definePlayground({ controls: { on: booleanControl() }, render: () => null });
    const out = collectDemos({ 'a': { ...base, playground: pg } });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.playground).toBe(pg);
  });

  it('rejects a malformed playground as an error entry', () => {
    const out = collectDemos({ 'a': { ...base, playground: { controls: { bad: { kind: 'nope' } }, render: () => null } } });
    expect(isDemoError(out[0]!)).toBe(true);
    if (isDemoError(out[0]!)) expect(out[0]!.error).toMatch(/playground/);
  });

  it('demo without playground is still fine', () => {
    const out = collectDemos({ 'a': base });
    const d = out[0]!;
    if (isDemoError(d)) throw new Error(d.error);
    expect(d.playground).toBeUndefined();
  });
});

describe('prepareDemos duplicate-slug guard', () => {
  it('turns a repeated slug into an error entry, keeping the first', () => {
    const a = collectDemos({ 'x': { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const b = collectDemos({ 'y': { meta: { title: 'Button', group: 'G' }, states: [{ name: 's', render: () => null }] } });
    const out = prepareDemos([...a, ...b]);
    expect(out.filter(isDemoError)).toHaveLength(1);
    expect(out.filter((d) => !isDemoError(d))).toHaveLength(1);
    const err = out.find(isDemoError)!;
    expect(err.error).toMatch(/duplicate demo slug "button"/);
  });
});
```
(Merge imports with the file's existing ones; `select` import only if used.)

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement**

`types.ts`: success arm becomes `{ slug: string; meta: DemoMeta; states: (DemoState & { slug: string })[]; playground?: AnyPlayground }` (import type from `./controls`). `DemoModule` gains `playground?: AnyPlayground`.

`collect-demos.ts` — extend `validate` after the states loop:
```ts
  if (m.playground !== undefined) {
    const p = m.playground as Partial<import('./controls').AnyPlayground> | null;
    if (!p || typeof p !== 'object' || typeof p.render !== 'function' || !p.controls || typeof p.controls !== 'object') {
      return { ok: false, error: 'playground must be { controls, render }' };
    }
    for (const def of Object.values(p.controls)) {
      const kind = (def as { kind?: unknown })?.kind;
      if (kind !== 'select' && kind !== 'boolean' && kind !== 'text' && kind !== 'number') {
        return { ok: false, error: `playground control has unknown kind "${String(kind)}"` };
      }
    }
  }
```
Success mapping adds `playground: v.demo.playground`. New export:
```ts
// Guard a (possibly merged) list against slug collisions, then sort. A later
// duplicate would double-render with colliding DOM ids and React keys — turn
// it into an error card instead.
export function prepareDemos(demos: CollectedDemo[]): CollectedDemo[] {
  const seen = new Set<string>();
  const guarded = demos.map((d) => {
    if ('error' in d) return d;
    if (seen.has(d.slug)) return { path: `#${d.slug}`, error: `duplicate demo slug "${d.slug}"` };
    seen.add(d.slug);
    return d;
  });
  return sortDemos(guarded);
}
```
`collectDemos` returns `prepareDemos(collected)` instead of `sortDemos(collected)`.
`state-grid.tsx`: delete the dead `cn` import.

- [ ] **Step 4: Run** package tests + typecheck → PASS (existing suites unaffected).

- [ ] **Step 5: Commit** — `feat(ui): playground validation and duplicate-slug guard in collectDemos`

---

### Task 3: `ControlsPanel` + `PlaygroundCard`

**Files:**
- Create: `packages/web/ui/src/gallery/controls-panel.tsx`, `packages/web/ui/src/gallery/playground-card.tsx`
- Test: `packages/web/ui/src/gallery/playground-card.test.tsx`
- Modify: `packages/web/ui/src/gallery/index.ts` (export both)

**Interfaces:**
- Consumes: Task 1 defs + `initialValues`; Task 2's `AnyPlayground`.
- Produces: `ControlsPanel({ controls, values, onChange })` where `onChange(key: string, value: string | number | boolean | undefined)`; `PlaygroundCard({ playground })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { boolean as booleanControl, definePlayground, select, text } from './controls';
import { PlaygroundCard } from './playground-card';

const pg = definePlayground({
  controls: {
    variant: select(['primary', 'secondary'], { label: 'variant' }),
    size: select(['compact', 'regular'], { allowNone: true }),
    loading: booleanControl(false),
    children: text('New ticket'),
  },
  render: (v) => (
    <button data-loading={v.loading} data-size={v.size ?? 'default'} data-variant={v.variant}>
      {v.children}
    </button>
  ),
});

describe('PlaygroundCard', () => {
  it('renders the preview with initial values', () => {
    render(<PlaygroundCard playground={pg} />);
    const btn = screen.getByText('New ticket');
    expect(btn.getAttribute('data-variant')).toBe('primary');
    expect(btn.getAttribute('data-size')).toBe('default'); // allowNone starts unset
  });

  it('select change re-renders the preview', () => {
    render(<PlaygroundCard playground={pg} />);
    fireEvent.change(screen.getByLabelText('variant'), { target: { value: 'secondary' } });
    expect(screen.getByText('New ticket').getAttribute('data-variant')).toBe('secondary');
  });

  it('allowNone select can return to (unset)', () => {
    render(<PlaygroundCard playground={pg} />);
    fireEvent.change(screen.getByLabelText('size'), { target: { value: 'compact' } });
    expect(screen.getByText('New ticket').getAttribute('data-size')).toBe('compact');
    fireEvent.change(screen.getByLabelText('size'), { target: { value: '' } });
    expect(screen.getByText('New ticket').getAttribute('data-size')).toBe('default');
  });

  it('checkbox and text changes flow through', () => {
    render(<PlaygroundCard playground={pg} />);
    fireEvent.click(screen.getByLabelText('loading'));
    expect(screen.getByText('New ticket').getAttribute('data-loading')).toBe('true');
    fireEvent.change(screen.getByLabelText('children'), { target: { value: 'Save' } });
    expect(screen.getByText('Save')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Implement `controls-panel.tsx`**

```tsx
import type { AnyControlDef } from './controls';

const inputClasses =
  'h-7 rounded-ctrl border border-control bg-raised px-2 font-sans text-ui text-ink focus:outline-none focus:ring-2 focus:ring-accent-subtle';

// One labeled row per control. Native elements only — this panel must not
// depend on apps/web primitives (they move into this package in P3).
export function ControlsPanel({
  controls,
  values,
  onChange,
}: {
  controls: Record<string, AnyControlDef>;
  values: Record<string, unknown>;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col gap-2.5">
      {Object.entries(controls).map(([key, def]) => (
        <label key={key} className="flex items-center justify-between gap-3 font-sans text-meta text-ink-2">
          <span className="font-mono text-label uppercase tracking-(--tracking-label) text-ink-3">
            {def.label ?? key}
          </span>
          {def.kind === 'select' && (
            <select
              className={inputClasses}
              value={(values[key] as string | undefined) ?? ''}
              onChange={(e) => onChange(key, e.target.value === '' ? undefined : e.target.value)}
            >
              {def.allowNone && <option value="">(unset)</option>}
              {def.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          {def.kind === 'boolean' && (
            <input
              type="checkbox"
              className="size-4 accent-(--color-accent)"
              checked={values[key] as boolean}
              onChange={(e) => onChange(key, e.target.checked)}
            />
          )}
          {def.kind === 'text' && (
            <input
              type="text"
              className={inputClasses}
              placeholder={def.placeholder}
              value={values[key] as string}
              onChange={(e) => onChange(key, e.target.value)}
            />
          )}
          {def.kind === 'number' && (
            <input
              type="number"
              className={`${inputClasses} w-20`}
              min={def.min}
              max={def.max}
              step={def.step}
              value={values[key] as number}
              onChange={(e) => onChange(key, e.target.value === '' ? def.initial : Number(e.target.value))}
            />
          )}
        </label>
      ))}
    </div>
  );
}
```

`playground-card.tsx`:
```tsx
import { useState } from 'react';
import { initialValues, type AnyPlayground } from './controls';
import { ControlsPanel } from './controls-panel';

export function PlaygroundCard({ playground }: { playground: AnyPlayground }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(playground.controls));
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-sans text-label font-medium uppercase tracking-wider text-ink-2">Playground</h3>
      <div className="flex items-start gap-6 rounded-card border border-hairline bg-raised p-4">
        <ControlsPanel
          controls={playground.controls}
          values={values}
          onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        />
        <div className="flex min-h-20 flex-1 items-start">{playground.render(values as never)}</div>
      </div>
    </section>
  );
}
```
Export both from `index.ts`.

- [ ] **Step 4: Run** package tests + typecheck + `tokens:verify` → PASS.

- [ ] **Step 5: Commit** — `feat(ui): ControlsPanel and PlaygroundCard`

---

### Task 4: `GalleryShell` v2 — sidebar + hash selection; wire hosts

**Files:**
- Modify: `packages/web/ui/src/gallery/gallery-shell.tsx` (rewrite), `apps/web/src/routes/gallery-route.tsx` (one-line: `sortDemos([...])` → `prepareDemos([...])`, import updated), `apps/web/src/ui/session-kind-glyph.demo.tsx` + `session-status-pill.demo.tsx` (swap `order` so pill=1, glyph=2)
- Test: `packages/web/ui/src/gallery/gallery-shell.test.tsx` (new)

**Interfaces:**
- Consumes: `prepareDemos`, `PlaygroundCard`, existing `StateGrid`/`DemoErrorCard`/`isDemoError`.
- Produces: same `GalleryShell({ demos, title, providers? })` signature — behavior change only. Dev app needs no edits.

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { GalleryShell } from './gallery-shell';
import { collectDemos } from './collect-demos';
import { boolean as booleanControl, definePlayground } from './controls';

const demos = collectDemos({
  'a': { meta: { title: 'Button', group: 'Form controls' }, states: [{ name: 'primary', render: () => <b>btn</b> }],
         playground: definePlayground({ controls: { on: booleanControl() }, render: () => <i>play</i> }) },
  'b': { meta: { title: 'Input', group: 'Form controls' }, states: [{ name: 'basic', render: () => <b>inp</b> }] },
});

function setHash(h: string) {
  window.location.hash = h;
  fireEvent(window, new HashChangeEvent('hashchange'));
}

describe('GalleryShell v2', () => {
  afterEach(() => { window.location.hash = ''; });

  it('renders all demos and a sidebar link per demo plus All', () => {
    render(<GalleryShell demos={demos} title="t" />);
    expect(screen.getByRole('link', { name: 'All' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Button' })).toBeTruthy();
    expect(screen.getByText('btn')).toBeTruthy();
    expect(screen.getByText('inp')).toBeTruthy();
    expect(screen.queryByText('play')).toBeNull(); // playground hidden in All view
  });

  it('hash selects a single component and shows its playground', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button');
    expect(screen.getByText('btn')).toBeTruthy();
    expect(screen.queryByText('inp')).toBeNull();
    expect(screen.getByText('play')).toBeTruthy();
  });

  it('state-anchor hash selects the owning component', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#button--primary');
    expect(screen.queryByText('inp')).toBeNull();
    expect(screen.getByText('btn')).toBeTruthy();
  });

  it('unknown hash falls back to All', () => {
    render(<GalleryShell demos={demos} title="t" />);
    setHash('#nope');
    expect(screen.getByText('inp')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify FAIL.**

- [ ] **Step 3: Rewrite `gallery-shell.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { PlaygroundCard } from './playground-card';
import { DemoErrorCard, StateGrid } from './state-grid';
import { isDemoError, type CollectedDemo } from './types';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

function selectionFromHash(demos: LiveDemo[]): string | null {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return null;
  const slug = raw.includes('--') ? raw.split('--')[0]! : raw;
  return demos.some((d) => d.slug === slug) ? slug : null;
}

export function GalleryShell({
  demos,
  title,
  providers = (children) => children,
}: {
  demos: CollectedDemo[];
  title: string;
  providers?: (children: ReactNode) => ReactNode;
}) {
  const live = demos.filter((d): d is LiveDemo => !isDemoError(d));
  const errors = demos.filter(isDemoError);
  const [selected, setSelected] = useState<string | null>(() => selectionFromHash(live));

  useEffect(() => {
    const onHash = () => setSelected(selectionFromHash(live));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // live is derived from props; demos identity is stable per host glob
  }, [demos]);

  // Spec: "#slug--state selects the component AND scrolls to the state". The
  // state cell only exists after the selection render, so scroll post-render.
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '');
    if (selected && raw.includes('--')) document.getElementById(raw)?.scrollIntoView();
  }, [selected]);

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setSelected((s) => s); // no-op state poke keeps previous behavior of re-render
  }

  const groups = [...new Set(live.map((d) => d.meta.group))];
  const shown = selected ? live.filter((d) => d.slug === selected) : live;

  return (
    <div className="flex min-h-screen bg-app font-sans text-ink">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-hairline bg-raised px-4 py-6">
        <a
          href="#"
          onClick={() => setSelected(null)}
          className={`rounded-ctrl px-2 py-1 text-ui ${selected === null ? 'bg-accent-subtle text-accent' : 'text-ink-2 hover:text-ink'}`}
        >
          All
        </a>
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <span className="px-2 font-mono text-label uppercase tracking-(--tracking-label) text-ink-3">{g}</span>
            {live
              .filter((d) => d.meta.group === g)
              .map((d) => (
                <a
                  key={d.slug}
                  href={`#${d.slug}`}
                  className={`rounded-ctrl px-2 py-1 text-ui ${selected === d.slug ? 'bg-accent-subtle text-accent' : 'text-ink-2 hover:text-ink'}`}
                >
                  {d.meta.title}
                </a>
              ))}
          </div>
        ))}
      </aside>
      <main className="flex-1 px-8 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-display font-semibold text-ink">{title}</h1>
              <p className="mt-1 text-meta text-ink-2">
                Instrument control library. Compare against docs/design/design-system.html.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 rounded-ctrl border border-control bg-raised px-3.5 text-ui text-ink hover:bg-inset"
            >
              Toggle theme
            </button>
          </header>
          {providers(
            <div className="flex flex-col gap-10">
              {shown.map((d) => (
                <div key={d.slug} className="flex flex-col gap-6">
                  <StateGrid demo={d} />
                  {selected === d.slug && d.playground && <PlaygroundCard playground={d.playground} />}
                </div>
              ))}
              {selected === null && errors.map((e) => <DemoErrorCard key={e.path} path={e.path} error={e.error} />)}
            </div>,
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Wire hosts** — `gallery-route.tsx`: import `prepareDemos` instead of `sortDemos`; `demos={prepareDemos([...packageDemos, ...webDemos])}`. Swap the `order` values in the two AI-session demo files (pill 1, glyph 2).

- [ ] **Step 5: Run full gate** (`ui` test/typecheck, `web` test/typecheck, `pnpm build`, `tokens:verify`) → PASS. Note: the tracking utility `tracking-(--tracking-label)` consumes a P1 token — first consumer, deliberate.

- [ ] **Step 6: Commit** — `feat(ui): gallery sidebar navigation with hash selection and playground pages`

---

### Task 5: Playground wave A — form controls (8 demos)

**Files (modify, all `apps/web/src/ui/`):** `button.demo.tsx`, `input.demo.tsx`, `textarea.demo.tsx`, `number-input.demo.tsx`, `checkbox.demo.tsx`, `switch.demo.tsx`, `radio-group.demo.tsx`, `field-label.demo.tsx`

Add to each file: `import { boolean, definePlayground, number, select, text } from '@tickets/ui/gallery';` (only the helpers used) and an `export const playground = definePlayground({...})`. The Button playground is EXACTLY the spec's canonical example. The rest per this table — verify each prop exists on the component before adding its control; drop/adjust with a report note if not:

| Demo | Controls | render notes |
|---|---|---|
| button | canonical example from the spec (variant/size+allowNone/loading with label 'show spinner'/disabled/children/…—omit `max`, that belongs to number-input) | spread props, children from text |
| input | `placeholder: text('Ticket title…')`, `size: select(['compact','regular'], { allowNone: true })`, `invalid: boolean()`, `disabled: boolean()` | `<div className="w-56"><Input {...v} /></div>` |
| textarea | `placeholder: text('Steps to reproduce…')`, `invalid: boolean()`, `disabled: boolean()` | `w-72` wrapper |
| number-input | `min: number(0,{min:0,max:100})`, `max: number(13,{min:0,max:100})`, `disabled: boolean()` | stateful fixture keeps its own `value` useState; spread min/max/disabled |
| checkbox | `label: text('Notify me')`, `indeterminate: boolean()`, `disabled: boolean()` | direct |
| switch | `label: text('KPI strip')`, `disabled: boolean()` | direct |
| radio-group | `label: text('Density')` | fixture with its own value state; options fixed |
| field-label | `children: text('Key')`, `required: boolean(true)`, `error: text('Key must be 2–24 chars')` | FieldLabel + FieldError; error text shown only when non-empty |

- [ ] Run gate (`web` typecheck+test, `ui` test, `tokens:verify`); visual sanity optional (controller does browser pass at the end).
- [ ] Commit — `feat(web): playgrounds for form-control demos (wave A)`

---

### Task 6: Playground wave B — pickers + display (11 demos)

**Files (modify, `apps/web/src/ui/`):** combobox, multi-combobox, status-select, date-picker, popover, status-badge, option-chip, type-badge, avatar, relative-date, session-status-pill `.demo.tsx`

| Demo | Controls | render notes |
|---|---|---|
| combobox | `placeholder: text('Priority')`, `clearable: boolean(true)`, `disabled: boolean()`, `size: select(['compact','regular'],{allowNone:true})` | reuse the existing PRIORITY_OPTIONS fixture + value state |
| multi-combobox | `placeholder: text('Labels')`, `disabled: boolean()`, `maxChips: number(3,{min:1,max:10})` | existing LABEL_OPTIONS fixture |
| status-select | `disabled: boolean()`, `size: select(['compact','regular'],{allowNone:true})` | existing STATUSES + legalTargets fixture |
| date-picker | `size: select(['compact','regular'],{allowNone:true})` (+ `disabled: boolean()` only if the prop exists) | existing value-state fixture |
| popover | `side: select(['top','right','bottom','left'],{allowNone:true})`, `align: select(['start','center','end'],{allowNone:true})` | pass to PopoverContent; verify prop pass-through exists |
| status-badge | `kind: select(['todo','active','blocked','done','dropped'])`, `label: text('In progress')` | direct |
| option-chip | `color: select([...11 colors from the demo's OPTION_COLORS])`, `label: text('frontend')` | direct |
| type-badge | `label: text('Task')` | direct |
| avatar | `name: text('Mara K.')`, `kind: select(['human','agent'])`, `size: select(['sm','md'],{allowNone:true})` | direct |
| relative-date | `value: text('2026-07-09T00:00:00Z')`, `overdue: boolean()` | keep the fixed `now` fixture prop |
| session-status-pill | `status: select(['starting','running','idle','awaiting_input','interrupted','exited','failed'])`, `exitCode: number(0,{min:0,max:255})` | pass exitCode only when status==='exited' |

- [ ] Gate; commit — `feat(web): playgrounds for picker and display demos (wave B)`

---

### Task 7: Playground wave C — overlays/AI (5 demos) + final verification

**Files (modify):** `apps/web/src/ui/`: tooltip, dialog, menu, toast `.demo.tsx`; `apps/web/src/components/agent/cost-meter.demo.tsx`

| Demo | Controls | render notes |
|---|---|---|
| tooltip | `content: text('Create a ticket · ⌘N')`, `side: select(['top','right','bottom','left'],{allowNone:true})` | wraps the existing trigger button; only pass `side` if Tooltip exposes it — verify |
| dialog | `title: text('Archive this ticket?')`, `body: text('It moves to the archive and leaves the board.')`, `confirmLabel: text('Archive')`, `destructive: boolean(true)` | fixture keeps its open-state; controls feed ConfirmDialog props |
| menu | `shortcut: text('E')`, `destructive: boolean(true)` | controls feed the demo's menu items |
| toast | `title: text('View saved')`, `actionLabel: text('Undo')` | fixture fires `toast({ title, action: { label: actionLabel, onClick: () => {} } })` |
| cost-meter | `costUsd: number(1.06,{min:0,max:20,step:0.01})`, `capped: boolean(true)`, `capUsd: number(5,{min:0,max:20})` | pass `capUsd` only when `capped` |

- [ ] **Final gates:** `pnpm typecheck` (17/17) · `pnpm --filter @tickets/ui test` · `pnpm --filter @tickets/web test` · `pnpm build` · `pnpm --filter @tickets/ui tokens:verify`.
- [ ] Commit — `feat(web): playgrounds for overlay and AI demos (wave C)`
- [ ] **Controller step (not subagent):** browser pass on web dev — sidebar selection, playground interaction on ≥3 components, both themes, All-view screenshot sweep intact.
