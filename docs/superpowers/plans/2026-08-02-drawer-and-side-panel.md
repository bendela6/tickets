# Drawer and SidePanel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five hand-rolled panel implementations with two primitives in `@tickets/ui` — `Drawer` (overlay) and `SidePanel` (docked) — sharing one resize implementation, and adopt them at every call site.

**Architecture:** `Drawer` wraps radix `Dialog`, so focus trap, Esc, scroll lock and return-focus come from the library instead of a `useEffect` per call site. `SidePanel` is a plain docked `<aside>` that holds a column and never traps focus; when it opts into `overlayBelow` it renders its own children through `Drawer` below the breakpoint. Both draw width from `usePanelWidth`, which owns drag, keyboard stepping, clamping and persistence.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (preflight OFF), `radix-ui` ^1.6.1, vitest + @testing-library/react.

## Global Constraints

- **Spec of record:** `docs/superpowers/specs/2026-08-02-drawer-and-side-panel-design.md`. Read it before Task 1.
- **`@tickets/ui` is domain-free.** No string literal in a non-test, non-demo file under `src/components/` may be one of: `human`, `agent`, `ticket`, `epic`, `sprint`, `assignee`, `reporter`, `backlog`, `todo`, `blocked`, `triage`. Gated by `src/components/domain-free.test.ts`.
- **No arbitrary Tailwind values.** No `w-[…]`, no odd fractional steps. A runtime width rides a CSS custom property consumed as `w-(--panel-w)`, the idiom already used by `side-panel.tsx` and the eer entity cards.
- **Preflight is OFF.** Radix portals content outside the app tree; anything relying on inherited resets must set them explicitly.
- **Tailwind cannot scan a class built at runtime.** Never interpolate a width or tone into a class name.
- **Motion vocabulary is fixed:** `200ms` for open/close, `var(--ease-out)` for arrivals. No new duration or easing values.
- **`tokens.css` is marker-spliced by `scripts/build-tokens.mjs`.** Only the hand-authored tail (from `@keyframes ai-spin` down) may be edited by hand. Never touch a generated region; `pnpm --filter @tickets/ui tokens:verify` fails if you do.
- **Commit per task**, conventional commits scoped by app: `feat(ui): …`, `refactor(web): …`.

## File Structure

**Created**
- `packages/web/ui/src/components/panel/use-panel-width.ts` — width state, side-aware drag, keyboard stepping, clamping, persistence.
- `packages/web/ui/src/components/panel/use-persisted-flag.ts` — one boolean in `localStorage`; backs `collapsed` and `maximized` separately.
- `packages/web/ui/src/components/panel/use-is-narrow.ts` — media-query subscription for `overlayBelow`.
- `packages/web/ui/src/components/panel/index.ts`
- `packages/web/ui/src/components/panel/panel.test.tsx`
- `packages/web/ui/src/components/drawer/{drawer.tsx,index.ts,drawer.test.tsx,drawer.demo.tsx}`
- `packages/web/ui/src/components/side-panel/{side-panel.tsx,index.ts,side-panel.test.tsx,side-panel.demo.tsx}`

**Modified**
- `packages/web/ui/src/components/icon/registry.tsx` — add `maximize`, `minimize`.
- `packages/web/ui/src/components/icon/icon.test.tsx` — add both to the required-glyph list.
- `packages/web/ui/src/tokens/tokens.css` — two keyframes + two classes, appended to the hand-authored tail only.
- `packages/web/ui/src/components/index.ts` — export `drawer`, `side-panel`, `panel`.
- `apps/web/src/components/item-drawer.tsx`, `item-drawer.test.tsx`, `item-detail.tsx`
- `apps/web/src/components/shell/app-shell.tsx`
- `apps/web/src/components/eer/view/detail-panel/side-panel.tsx`, `side-panel.test.tsx`
- `packages/web/playground/src/shell/sidebar/sidebar.tsx`, `sidebar.test.tsx`

`panel/` holds mechanics, not a component, so it has no `.demo.tsx`. The gallery globs `*.demo.tsx` and simply finds nothing there.

**Why `panel/` is its own directory:** both `drawer/` and `side-panel/` import it, so it cannot live inside either without one component reaching into the other's internals.

---

### Task 1: Panel state hooks

**Files:**
- Create: `packages/web/ui/src/components/panel/use-persisted-flag.ts`
- Create: `packages/web/ui/src/components/panel/use-panel-width.ts`
- Create: `packages/web/ui/src/components/panel/use-is-narrow.ts`
- Create: `packages/web/ui/src/components/panel/index.ts`
- Test: `packages/web/ui/src/components/panel/panel.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type PanelSide = 'left' | 'right'`
  - `type PanelBreakpoint = 'md' | 'lg'`
  - `PANEL_KEY_STEP: 24`
  - `usePersistedFlag(key: string | undefined, fallback: boolean): readonly [boolean, (next: boolean) => void]`
  - `useIsNarrow(breakpoint: PanelBreakpoint | undefined): boolean`
  - `useViewportUnder(px: number): boolean`
  - `usePanelWidth(options: { side: PanelSide; defaultWidth: number; minWidth: number; maxWidth: number; storageKey?: string; label: string }): { width: number; setWidth: (px: number) => number; panelRef: RefObject<HTMLElement | null>; separatorProps: HTMLAttributes<HTMLDivElement> & { role: 'separator' } }`

Both media hooks land here rather than in either component, because `Drawer`
needs `useViewportUnder` and `SidePanel` needs `useIsNarrow`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/ui/src/components/panel/panel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePanelWidth, usePersistedFlag, type PanelSide } from './index';

afterEach(() => localStorage.clear());

// A minimal host: the hook needs a real element to measure, and the width is
// read back off the custom property exactly as the real components set it.
function Harness({
  side = 'left',
  storageKey,
  defaultWidth = 224,
}: {
  side?: PanelSide;
  storageKey?: string;
  defaultWidth?: number;
}) {
  const { width, panelRef, separatorProps } = usePanelWidth({
    side,
    defaultWidth,
    minWidth: 180,
    maxWidth: 400,
    storageKey,
    label: 'Test panel',
  });
  return (
    <aside ref={panelRef} data-testid="panel" style={{ ['--panel-w' as string]: `${width}px` }}>
      <div {...separatorProps} />
    </aside>
  );
}

const widthOf = () =>
  screen.getByTestId('panel').style.getPropertyValue('--panel-w');

describe('usePanelWidth', () => {
  it('starts at the default width', () => {
    render(<Harness />);
    expect(widthOf()).toBe('224px');
  });

  it('names the separator after the panel it resizes', () => {
    render(<Harness />);
    expect(screen.getByRole('separator', { name: 'Resize Test panel' })).toBeInTheDocument();
  });

  it('widens a left panel with ArrowRight and narrows it with ArrowLeft', () => {
    render(<Harness side="left" />);
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(widthOf()).toBe('248px');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(widthOf()).toBe('200px');
  });

  it('mirrors the keys for a right panel, where wider means leftward', () => {
    render(<Harness side="right" />);
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(widthOf()).toBe('248px');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(widthOf()).toBe('224px');
  });

  it('clamps at both ends', () => {
    render(<Harness defaultWidth={190} />);
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(widthOf()).toBe('180px');
    for (let i = 0; i < 20; i += 1) fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(widthOf()).toBe('400px');
  });

  it('clamps a stored width that no longer fits the current bounds', () => {
    localStorage.setItem('k', '5000');
    render(<Harness storageKey="k" />);
    expect(widthOf()).toBe('400px');
  });

  it('restores a stored width over the default, and ignores a corrupt one', () => {
    localStorage.setItem('k', '300');
    const { unmount } = render(<Harness storageKey="k" />);
    expect(widthOf()).toBe('300px');
    unmount();
    localStorage.setItem('k', 'not-a-number');
    render(<Harness storageKey="k" />);
    expect(widthOf()).toBe('224px');
  });

  it('persists only when a storageKey is given', () => {
    const { unmount } = render(<Harness />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Test panel' }), {
      key: 'ArrowRight',
    });
    expect(localStorage.length).toBe(0);
    unmount();

    render(<Harness storageKey="k" />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Test panel' }), {
      key: 'ArrowRight',
    });
    expect(localStorage.getItem('k')).toBe('248');
  });
});

describe('usePersistedFlag', () => {
  function FlagHarness({ storageKey, fallback }: { storageKey?: string; fallback: boolean }) {
    const [on, setOn] = usePersistedFlag(storageKey, fallback);
    return (
      <button type="button" onClick={() => setOn(!on)}>
        {on ? 'on' : 'off'}
      </button>
    );
  }

  it('falls back when nothing is stored, and round-trips both booleans', () => {
    const { unmount } = render(<FlagHarness storageKey="f" fallback={false} />);
    expect(screen.getByRole('button')).toHaveTextContent('off');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('f')).toBe('true');
    unmount();

    render(<FlagHarness storageKey="f" fallback={false} />);
    expect(screen.getByRole('button')).toHaveTextContent('on');
  });

  it('treats a stored false as a real choice, not as unset', () => {
    // The distinction matters: a panel whose default is open must stay closed
    // for a user who deliberately closed it.
    localStorage.setItem('f', 'false');
    render(<FlagHarness storageKey="f" fallback />);
    expect(screen.getByRole('button')).toHaveTextContent('off');
  });

  it('ignores an unrecognised stored value and uses the fallback', () => {
    localStorage.setItem('f', 'yes');
    render(<FlagHarness storageKey="f" fallback />);
    expect(screen.getByRole('button')).toHaveTextContent('on');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @tickets/ui test -- panel.test`
Expected: FAIL — `Failed to resolve import './index'`.

- [ ] **Step 3: Write `use-persisted-flag.ts`**

```ts
import { useState } from 'react';

// An unset key must not read as false: "never chosen" and "chosen false" are
// different answers, and only the first should defer to the caller's fallback.
function readFlag(key: string | undefined): boolean | undefined {
  if (!key) return undefined;
  const raw = localStorage.getItem(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export function usePersistedFlag(key: string | undefined, fallback: boolean) {
  const [value, setValue] = useState(() => readFlag(key) ?? fallback);
  const set = (next: boolean) => {
    setValue(next);
    if (key) localStorage.setItem(key, String(next));
  };
  return [value, set] as const;
}
```

- [ ] **Step 4: Write `use-panel-width.ts`**

```ts
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type PanelSide = 'left' | 'right';

export const PANEL_KEY_STEP = 24;

const clamp = (px: number, min: number, max: number) => Math.min(max, Math.max(min, px));

function readWidth(key: string | undefined): number | undefined {
  if (!key) return undefined;
  const stored = localStorage.getItem(key);
  if (stored === null) return undefined;
  const px = Number(stored);
  return Number.isFinite(px) && px > 0 ? px : undefined;
}

export function usePanelWidth({
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  label,
}: {
  side: PanelSide;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
  label: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  // A stored width wins over the default — that is the point of persisting it —
  // but it is clamped on read, so narrowing the bounds later cannot restore a
  // width the panel can no longer take.
  const [width, setWidthState] = useState(() =>
    clamp(readWidth(storageKey) ?? defaultWidth, minWidth, maxWidth),
  );

  const setWidth = useCallback(
    (px: number) => {
      const next = clamp(px, minWidth, maxWidth);
      setWidthState(next);
      return next;
    },
    [minWidth, maxWidth],
  );

  const persist = useCallback(
    (px: number) => {
      if (storageKey) localStorage.setItem(storageKey, String(px));
    },
    [storageKey],
  );

  // Pointer capture on the handle, so a fast drag that outruns the pointer
  // keeps resizing instead of dropping the gesture.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    let latest = width;
    const move = (e: PointerEvent) => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      // The dragged edge is the panel's inner edge, so the outer edge is the
      // fixed reference: a left panel grows rightward from its own left edge,
      // a right panel leftward from its right.
      latest = setWidth(side === 'left' ? e.clientX - rect.left : rect.right - e.clientX);
    };
    const end = (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      persist(latest);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // "Wider" is always away from the edge the panel is docked to.
    const widen = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const narrow = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key !== widen && event.key !== narrow) return;
    event.preventDefault();
    persist(setWidth(width + (event.key === widen ? PANEL_KEY_STEP : -PANEL_KEY_STEP)));
  };

  return {
    width,
    setWidth,
    panelRef,
    separatorProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-label': `Resize ${label}`,
      tabIndex: 0,
      onPointerDown,
      onKeyDown,
    },
  };
}
```

- [ ] **Step 5: Write `use-is-narrow.ts`**

```ts
import { useEffect, useState } from 'react';

// Below these a docked panel cannot sit beside the content without squeezing it.
const QUERIES = { md: '(max-width: 767px)', lg: '(max-width: 1023px)' } as const;

export type PanelBreakpoint = keyof typeof QUERIES;

function useMediaQuery(query: string | undefined): boolean {
  const [matches, setMatches] = useState(() =>
    query ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (!query) {
      setMatches(false);
      return;
    }
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    onChange();
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function useIsNarrow(breakpoint: PanelBreakpoint | undefined): boolean {
  return useMediaQuery(breakpoint && QUERIES[breakpoint]);
}

// True when the viewport itself is narrower than `px` — the drawer uses it to
// drop a resize handle there is no room to drag.
export function useViewportUnder(px: number): boolean {
  return useMediaQuery(`(max-width: ${px}px)`);
}
```

- [ ] **Step 6: Write `index.ts`**

```ts
export * from './use-is-narrow';
export * from './use-panel-width';
export * from './use-persisted-flag';
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `pnpm --filter @tickets/ui test -- panel.test`
Expected: PASS, 12 tests. The media hooks are covered through `Drawer` and
`SidePanel` in Tasks 2 and 3, where a mocked viewport can drive them against
real markup.

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui/src/components/panel
git commit -m "feat(ui): panel width, persisted-flag and viewport hooks"
```

---

### Task 2: `Drawer` and `DrawerControls`

**Files:**
- Modify: `packages/web/ui/src/components/icon/registry.tsx`
- Modify: `packages/web/ui/src/components/icon/icon.test.tsx`
- Modify: `packages/web/ui/src/tokens/tokens.css` (hand-authored tail only)
- Create: `packages/web/ui/src/components/drawer/{drawer.tsx,index.ts,drawer.demo.tsx}`
- Modify: `packages/web/ui/src/components/index.ts`
- Test: `packages/web/ui/src/components/drawer/drawer.test.tsx`

**Interfaces:**
- Consumes: `usePanelWidth`, `usePersistedFlag`, `useViewportUnder`, `PanelSide` from `../panel`; `cn` from `../../style/cn`; `runtimeStyle` from `../../style/runtime-style`; `Icon` from `../icon`.
- Produces:
  - `DRAWER_SIZES: { sm: 288; md: 400; lg: 620 }`
  - `Drawer(props: DrawerProps)` — props exactly as in the spec's Types section.
  - `DrawerControls(props: { className?: string })` — maximize/restore + close, reading `Drawer`'s context. Throws if rendered outside a `Drawer`.

- [ ] **Step 1: Add the two glyphs the controls need**

The registry has no maximize glyph. In `registry.tsx`, add these two lines to the `── actions ──` group, immediately after the `'minus'` entry:

```tsx
  'maximize':       { viewBox: '0 0 16 16', node: <path d="M9.5 6.5 13 3M10 3h3v3M6.5 9.5 3 13M6 13H3v-3" {...s} /> },
  'minimize':       { viewBox: '0 0 16 16', node: <path d="M13 3 9.5 6.5M9.5 4v2.5H12M3 13l3.5-3.5M6.5 12V9.5H4" {...s} /> },
```

In `icon.test.tsx`, add `'maximize', 'minimize',` to the required-glyph array in the first test (the `'plus', 'x', 'check', …` line).

Run: `pnpm --filter @tickets/ui test -- icon.test`
Expected: PASS. The colorless test renders every glyph; `{...s}` keeps both on `currentColor`.

- [ ] **Step 2: Add the slide keyframes**

Append to the **end** of `packages/web/ui/src/tokens/tokens.css`. This is below every generated marker, so `tokens:verify` is unaffected.

```css
/* Overlay drawers arrive from the edge they are docked to: 200ms is the
   open/close rung on the motion page, ease-out the arrival curve. Entry only —
   radix unmounts content immediately, so there is no exit to animate. */
@keyframes panel-slide-from-right {
  from {
    transform: translateX(100%);
  }
}

@keyframes panel-slide-from-left {
  from {
    transform: translateX(-100%);
  }
}

.panel-slide-right {
  animation: panel-slide-from-right 200ms var(--ease-out);
}

.panel-slide-left {
  animation: panel-slide-from-left 200ms var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .panel-slide-right,
  .panel-slide-left {
    animation: none;
  }
}
```

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: PASS — no diff in any generated region.

- [ ] **Step 3: Write the failing test**

Create `packages/web/ui/src/components/drawer/drawer.test.tsx`:

```tsx
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Drawer, DrawerControls } from './drawer';

// One test swaps matchMedia to fake a phone; put the setup stub back after each
// so the swap cannot leak into its neighbours.
const realMatchMedia = window.matchMedia;

afterEach(() => {
  localStorage.clear();
  window.matchMedia = realMatchMedia;
});

function Host({
  side = 'right',
  storageKey,
  maximizable = false,
}: {
  side?: 'left' | 'right';
  storageKey?: string;
  maximizable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open it
      </button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side={side}
        size="lg"
        storageKey={storageKey}
        maximizable={maximizable}
        label="Detail"
      >
        <DrawerControls />
        <p>Body text</p>
      </Drawer>
    </>
  );
}

const panel = () => screen.getByRole('dialog', { name: 'Detail' });
const widthOf = () => panel().style.getPropertyValue('--panel-w');

describe('Drawer', () => {
  it('opens on demand and names itself for assistive tech', async () => {
    render(<Host />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(panel()).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on the close control and returns focus to the trigger', async () => {
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('caps its width at the viewport minus a 48px tap strip', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    // size="lg" is 620px; the cap is expressed in CSS so both bounds survive a
    // resize without JS re-measuring.
    expect(widthOf()).toBe('min(620px, 100vw - 3rem)');
  });

  it('resizes by keyboard, mirrored for the side it is docked to', async () => {
    render(<Host side="right" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Detail' }), {
      key: 'ArrowLeft',
    });
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');
  });

  it('hides the maximize control unless asked for it', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.queryByRole('button', { name: 'Maximize' })).not.toBeInTheDocument();
  });

  it('maximizes to full width and restores the dragged width, not the default', async () => {
    render(<Host maximizable />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Detail' }), {
      key: 'ArrowLeft',
    });
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');

    await userEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    expect(widthOf()).toBe('calc(100vw - 3rem)');
    // The resize handle is meaningless while maximized.
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');
  });

  it('remembers width and maximized state under a storageKey', async () => {
    const { unmount } = render(<Host maximizable storageKey="d" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Detail' }), {
      key: 'ArrowLeft',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    unmount();

    render(<Host maximizable storageKey="d" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');
  });

  it('drops the resize handle when the viewport cannot fit the minimum width', async () => {
    // A phone is already showing the drawer at full width; there is no room
    // left to drag it into.
    window.matchMedia = ((media: string) => ({
      matches: true,
      media,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('refuses to render controls outside a Drawer', () => {
    // Rendering the controls loose would silently do nothing; failing loudly is
    // the difference between a caught mistake and a dead button.
    expect(() => render(<DrawerControls />)).toThrow(/within a Drawer/i);
  });
});
```

- [ ] **Step 4: Run the test and watch it fail**

Run: `pnpm --filter @tickets/ui test -- drawer.test`
Expected: FAIL — `Failed to resolve import './drawer'`.

- [ ] **Step 5: Write `drawer.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { cn } from '../../style/cn';
import { runtimeStyle } from '../../style/runtime-style';
import { Icon } from '../icon';
import { usePanelWidth, usePersistedFlag, useViewportUnder, type PanelSide } from '../panel';

export const DRAWER_SIZES = { sm: 288, md: 400, lg: 620 } as const;

export type DrawerSize = keyof typeof DRAWER_SIZES;

// Every drawer leaves this much of the page uncovered, so there is always a
// scrim left to tap on a narrow screen.
const TAP_STRIP = '3rem';
const TAP_STRIP_PX = 48;

type DrawerContextValue = { maximized: boolean; setMaximized: (next: boolean) => void; maximizable: boolean };

const DrawerContext = createContext<DrawerContextValue | null>(null);

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  side?: PanelSide;
  size?: DrawerSize;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  maximizable?: boolean;
  className?: string;
  children: ReactNode;
};

export function Drawer({
  open,
  onOpenChange,
  label,
  side = 'right',
  size = 'md',
  minWidth = 280,
  maxWidth = 960,
  storageKey,
  maximizable = false,
  className,
  children,
}: DrawerProps) {
  const { width, panelRef, separatorProps } = usePanelWidth({
    side,
    defaultWidth: DRAWER_SIZES[size],
    minWidth,
    maxWidth,
    storageKey: storageKey && `${storageKey}:width`,
    label,
  });
  const [maximized, setMaximized] = usePersistedFlag(
    storageKey && `${storageKey}:maximized`,
    false,
  );
  // On a viewport this narrow the drawer is already at its cap, so there is no
  // width left to drag it into.
  const tooNarrowToDrag = useViewportUnder(minWidth + TAP_STRIP_PX);

  // Both bounds live in CSS rather than JS: the cap has to follow a window
  // resize, and nothing here re-measures on one.
  const panelWidth = maximized
    ? `calc(100vw - ${TAP_STRIP})`
    : `min(${width}px, 100vw - ${TAP_STRIP})`;

  return (
    <DrawerContext.Provider value={{ maximized, setMaximized, maximizable }}>
      <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
          <RadixDialog.Content
            ref={panelRef as React.RefObject<HTMLDivElement>}
            // Radix warns without a description; this drawer's body is
            // arbitrary content, so there is nothing honest to point at.
            aria-describedby={undefined}
            style={runtimeStyle({ '--panel-w': panelWidth })}
            className={cn(
              'fixed inset-y-0 z-50 flex w-(--panel-w) flex-col outline-none',
              'border-gray-6 bg-surface-raised font-sans text-gray-12 shadow-lg',
              side === 'right' ? 'right-0 border-l-1 panel-slide-right' : 'left-0 border-r-1 panel-slide-left',
              className,
            )}
          >
            <RadixDialog.Title className="sr-only">{label}</RadixDialog.Title>
            {/* Nothing to drag once the drawer already fills the viewport. */}
            {maximized || tooNarrowToDrag ? null : (
              <div
                {...separatorProps}
                className={cn(
                  'absolute inset-y-0 z-10 w-1.5 cursor-col-resize hover:bg-indigo-9',
                  side === 'right' ? 'left-0' : 'right-0',
                )}
              />
            )}
            {children}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </DrawerContext.Provider>
  );
}

const CONTROL =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset hover:text-gray-12';

export function DrawerControls({ className }: { className?: string }) {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('DrawerControls must be rendered within a Drawer');
  }
  const { maximized, setMaximized, maximizable } = context;
  return (
    <div className={cn('flex shrink-0 items-center gap-0.5', className)}>
      {maximizable ? (
        <button
          type="button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          title={maximized ? 'Restore' : 'Maximize'}
          onClick={() => setMaximized(!maximized)}
          className={CONTROL}
        >
          <Icon name={maximized ? 'minimize' : 'maximize'} size="md" />
        </button>
      ) : null}
      <RadixDialog.Close aria-label="Close" title="Close" className={CONTROL}>
        <Icon name="x" size="md" />
      </RadixDialog.Close>
    </div>
  );
}
```

- [ ] **Step 6: Write `index.ts` and export from the package**

`packages/web/ui/src/components/drawer/index.ts`:

```ts
export * from './drawer';
```

In `packages/web/ui/src/components/index.ts`, add these lines in alphabetical position (`drawer` after `dropdown`'s neighbour `dialog-footer`, `panel` after `number-input`, `side-panel` after `section-header`):

```ts
export * from './drawer';
export * from './panel';
export * from './side-panel';
```

`./side-panel` does not exist until Task 3. Add only `./drawer` and `./panel` now; add `./side-panel` in Task 3.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `pnpm --filter @tickets/ui test -- drawer.test`
Expected: PASS, 9 tests.

- [ ] **Step 8: Write the gallery demo**

Create `packages/web/ui/src/components/drawer/drawer.demo.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../button';
import { Drawer, DrawerControls } from './drawer';

export const meta = {
  title: 'Drawer',
  group: 'Components',
  size: 'lg',
  impl: ['./drawer.tsx'],
};

function DrawerDemo({ side, maximizable }: { side: 'left' | 'right'; maximizable?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open {side}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side={side}
        size="md"
        maximizable={maximizable}
        label="Demo drawer"
      >
        <div className="flex shrink-0 items-center gap-2 border-b-1 border-gray-6 px-4 py-3">
          <span className="flex-1 font-sans text-14 font-500 text-gray-12">Demo drawer</span>
          <DrawerControls />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 font-sans text-13/19 text-gray-11">
          Drag the inner edge to resize. Esc closes.
        </div>
      </Drawer>
    </>
  );
}

export const states = [
  { name: 'right', render: () => <DrawerDemo side="right" /> },
  { name: 'left', render: () => <DrawerDemo side="left" /> },
  { name: 'maximizable', render: () => <DrawerDemo side="right" maximizable /> },
];
```

- [ ] **Step 9: Run the full package suite**

Run: `pnpm --filter @tickets/ui test`
Expected: PASS — including `domain-free.test.ts` and the gallery's `demos.smoke.test.tsx`, which renders every demo's states.

- [ ] **Step 10: Commit**

```bash
git add packages/web/ui/src/components/drawer packages/web/ui/src/components/icon packages/web/ui/src/components/index.ts packages/web/ui/src/tokens/tokens.css
git commit -m "feat(ui): Drawer built on radix Dialog, with resize and maximize"
```

---

### Task 3: `SidePanel`

**Files:**
- Create: `packages/web/ui/src/components/side-panel/{side-panel.tsx,index.ts,side-panel.demo.tsx}`
- Modify: `packages/web/ui/src/components/index.ts`
- Test: `packages/web/ui/src/components/side-panel/side-panel.test.tsx`

**Interfaces:**
- Consumes: `usePanelWidth`, `usePersistedFlag`, `useIsNarrow`, `PanelSide`, `PanelBreakpoint` from `../panel` (all built in Task 1); `Drawer` from `../drawer`; `Icon`, `cn`, `runtimeStyle`.
- Produces: `SidePanel(props: SidePanelProps)` — props exactly as in the spec's Types section.

- [ ] **Step 1: Write the failing test**

Create `packages/web/ui/src/components/side-panel/side-panel.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SidePanel } from './side-panel';

afterEach(() => localStorage.clear());

// Drives the media query SidePanel watches, and lets a test flip it after
// mount the way a real window resize would.
function mockViewport(initiallyNarrow: boolean) {
  const listeners = new Set<() => void>();
  let narrow = initiallyNarrow;
  window.matchMedia = ((media: string) => ({
    get matches() {
      return narrow;
    },
    media,
    onchange: null,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    // The media-query callback fires outside React's event system, so the
    // resulting state update has to be flushed explicitly.
    set(next: boolean) {
      narrow = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof SidePanel>> = {}) {
  return render(
    <SidePanel label="Navigation" defaultWidth={224} minWidth={180} maxWidth={400} {...props}>
      <p>Panel body</p>
    </SidePanel>,
  );
}

const aside = () => document.querySelector('aside') as HTMLElement;

describe('SidePanel', () => {
  it('renders its children at the default width', () => {
    mockViewport(false);
    renderPanel();
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(aside().style.getPropertyValue('--panel-w')).toBe('224px');
  });

  it('is not a dialog — it holds a column and never traps focus', () => {
    mockViewport(false);
    renderPanel();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Navigation' })).toBeInTheDocument();
  });

  it('drags to a new width, clamped at both ends', () => {
    mockViewport(false);
    renderPanel();
    const handle = screen.getByRole('separator', { name: 'Resize Navigation' });
    // jsdom gives every element a zero rect, so a left panel's width is read
    // straight off clientX.
    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('300px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5000 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('400px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('180px');

    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 350 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('180px');
  });

  it('collapses to a reopen rail and back', async () => {
    mockViewport(false);
    renderPanel({ collapsible: true, collapsedTo: 'rail' });
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();

    const reopen = screen.getByRole('button', { name: 'Show Navigation' });
    expect(reopen).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(reopen);
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Navigation' })).not.toBeInTheDocument();
  });

  it('collapses to a floating button that costs the page no column', async () => {
    mockViewport(false);
    renderPanel({ collapsible: true, collapsedTo: 'edge' });
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    // No aside at all — the layout reclaims the whole column, which is the
    // difference between this and collapsedTo="rail".
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show Navigation' })).toBeInTheDocument();
  });

  it('remembers width and collapsed state under a storageKey', async () => {
    mockViewport(false);
    const { unmount } = renderPanel({ collapsible: true, storageKey: 'nav' });
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Navigation' }), {
      key: 'ArrowRight',
    });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('248px');
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    unmount();

    renderPanel({ collapsible: true, storageKey: 'nav' });
    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(aside().style.getPropertyValue('--panel-w')).toBe('248px');
  });

  it('stays docked at every width unless overlayBelow is given', () => {
    mockViewport(true);
    renderPanel({ collapsible: true });
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reopens as a Drawer below the breakpoint when opted in', async () => {
    mockViewport(true);
    renderPanel({ collapsible: true, overlayBelow: 'lg' });
    // A narrow window forces it shut rather than squeezing the content.
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.getByText('Panel body')).toBeInTheDocument();
  });

  it('restores the docked panel when the window widens again', () => {
    const viewport = mockViewport(true);
    renderPanel({ collapsible: true, overlayBelow: 'lg' });
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
    viewport.set(false);
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @tickets/ui test -- side-panel.test`
Expected: FAIL — `Failed to resolve import './side-panel'`.

- [ ] **Step 3: Write `side-panel.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import { cn } from '../../style/cn';
import { runtimeStyle } from '../../style/runtime-style';
import { Drawer } from '../drawer';
import { Icon } from '../icon';
import {
  useIsNarrow,
  usePanelWidth,
  usePersistedFlag,
  type PanelBreakpoint,
  type PanelSide,
} from '../panel';

export type CollapsedTo = 'rail' | 'edge';

export type SidePanelProps = {
  label: string;
  side?: PanelSide;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  collapsible?: boolean;
  collapsedTo?: CollapsedTo;
  overlayBelow?: PanelBreakpoint;
  className?: string;
  children: ReactNode;
};

const TOGGLE =
  'flex size-7 shrink-0 items-center justify-center rounded-md text-gray-11 hover:bg-surface-inset hover:text-gray-12';

// Shared by the two states that have no panel on screen to hang a toggle off:
// collapsedTo="edge" and the narrow overlay. Fixed, so a shut panel costs the
// content no horizontal space.
function ReopenButton({
  label,
  side,
  expanded,
  onClick,
}: {
  label: string;
  side: PanelSide;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Show ${label}`}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'fixed top-3 z-40 flex size-9 items-center justify-center rounded-md',
        'border-1 border-gray-6 bg-surface-raised text-gray-11 shadow-sm hover:text-gray-12',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon name="rows" size="md" />
    </button>
  );
}

export function SidePanel({
  label,
  side = 'left',
  defaultWidth = 224,
  minWidth = 180,
  maxWidth = 400,
  storageKey,
  collapsible = false,
  collapsedTo = 'rail',
  overlayBelow,
  className,
  children,
}: SidePanelProps) {
  const { width, panelRef, separatorProps } = usePanelWidth({
    side,
    defaultWidth,
    minWidth,
    maxWidth,
    storageKey: storageKey && `${storageKey}:width`,
    label,
  });
  const [collapsed, setCollapsed] = usePersistedFlag(
    storageKey && `${storageKey}:collapsed`,
    false,
  );
  const narrow = useIsNarrow(overlayBelow);
  // Overlay open/shut is deliberately NOT the persisted `collapsed` preference.
  // A temporary peek at the overlay is not a preference worth remembering, and
  // writing it through would leave the panel collapsed once the window widens
  // again — losing the choice the user actually made while docked.
  const [overlayOpen, setOverlayOpen] = useState(false);

  if (narrow) {
    // Below the breakpoint the panel is an overlay: same children, same label,
    // with radix's focus trap and scroll lock on top.
    return (
      <>
        <ReopenButton
          label={label}
          side={side}
          expanded={overlayOpen}
          onClick={() => setOverlayOpen(true)}
        />
        <Drawer
          open={overlayOpen}
          onOpenChange={setOverlayOpen}
          side={side}
          size="sm"
          label={label}
        >
          {children}
        </Drawer>
      </>
    );
  }

  const open = () => setCollapsed(false);

  if (collapsed) {
    if (collapsedTo === 'edge') {
      return <ReopenButton label={label} side={side} expanded={false} onClick={open} />;
    }
    return (
      <button
        type="button"
        aria-label={`Show ${label}`}
        aria-expanded={false}
        onClick={open}
        className={cn(
          'flex h-full w-6 shrink-0 items-center justify-center bg-gray-2 text-gray-11',
          'hover:bg-surface-inset hover:text-gray-12',
          side === 'left' ? 'border-r-1 border-gray-6' : 'border-l-1 border-gray-6',
        )}
      >
        <Icon name={side === 'left' ? 'chevron-right' : 'chevron-left'} size="md" />
      </button>
    );
  }

  return (
    <aside
      ref={panelRef}
      aria-label={label}
      style={runtimeStyle({ '--panel-w': `${width}px` })}
      className={cn(
        'relative flex w-(--panel-w) shrink-0 flex-col bg-gray-2',
        side === 'left' ? 'border-r-1 border-gray-6' : 'border-l-1 border-gray-6',
        className,
      )}
    >
      <div
        {...separatorProps}
        className={cn(
          'absolute inset-y-0 z-10 w-1.5 cursor-col-resize hover:bg-indigo-9',
          side === 'left' ? 'right-0' : 'left-0',
        )}
      />
      {collapsible ? (
        <div
          className={cn(
            'flex shrink-0 border-b-1 border-gray-6 px-2 py-1',
            side === 'left' ? 'justify-start' : 'justify-end',
          )}
        >
          <button
            type="button"
            aria-label={`Hide ${label}`}
            aria-expanded
            onClick={() => setCollapsed(true)}
            className={TOGGLE}
          >
            <Icon name={side === 'left' ? 'chevron-left' : 'chevron-right'} size="md" />
          </button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </aside>
  );
}
```

- [ ] **Step 4: Write `index.ts` and export it**

`packages/web/ui/src/components/side-panel/index.ts`:

```ts
export * from './side-panel';
```

Add `export * from './side-panel';` to `packages/web/ui/src/components/index.ts`.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `pnpm --filter @tickets/ui test -- side-panel.test`
Expected: PASS, 9 tests.

- [ ] **Step 6: Write the gallery demo**

Create `packages/web/ui/src/components/side-panel/side-panel.demo.tsx`:

```tsx
import { SidePanel } from './side-panel';

export const meta = {
  title: 'SidePanel',
  group: 'Components',
  size: 'lg',
  impl: ['./side-panel.tsx'],
};

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-64 overflow-hidden rounded-lg border-1 border-gray-6">{children}</div>;
}

const body = (
  <nav className="flex flex-col gap-1 p-3 font-sans text-13/19 text-gray-11">
    <span>First</span>
    <span>Second</span>
    <span>Third</span>
  </nav>
);

export const states = [
  {
    name: 'left, collapsible',
    render: () => (
      <Frame>
        <SidePanel label="Navigation" collapsible>
          {body}
        </SidePanel>
        <div className="flex-1 p-3 font-sans text-13/19 text-gray-9">Content</div>
      </Frame>
    ),
  },
  {
    name: 'right, collapses to a rail',
    render: () => (
      <Frame>
        <div className="flex-1 p-3 font-sans text-13/19 text-gray-9">Content</div>
        <SidePanel label="Details" side="right" collapsible defaultWidth={240} maxWidth={420}>
          {body}
        </SidePanel>
      </Frame>
    ),
  },
];
```

- [ ] **Step 7: Run the full package suite and typecheck**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/ui typecheck`
Expected: PASS both.

- [ ] **Step 8: Commit**

```bash
git add packages/web/ui/src/components/side-panel packages/web/ui/src/components/panel packages/web/ui/src/components/index.ts
git commit -m "feat(ui): SidePanel, docked and optionally overlaying when narrow"
```

---

### Task 4: Adopt `Drawer` in the item drawer

**Files:**
- Modify: `apps/web/src/components/item-drawer.tsx`
- Modify: `apps/web/src/components/item-detail.tsx:297-299`
- Test: `apps/web/src/components/item-drawer.test.tsx`

**Interfaces:**
- Consumes: `Drawer`, `DrawerControls` from `@tickets/ui`.
- Produces: `ItemDrawer` keeps its exact prop shape — `{ projectKey, board, indexes, item, onClose }` — so `board-screen.tsx` and `all-items-screen.tsx` need no change.

- [ ] **Step 1: Update the two tests that will change behavior**

In `apps/web/src/components/item-drawer.test.tsx`:

Replace the `renderDrawer` helper's final wait line:

```tsx
  await screen.findByRole('complementary', { name: 'Item detail' });
```

with:

```tsx
  await screen.findByRole('dialog', { name: 'Item detail' });
```

Then replace this whole test:

```tsx
test('drawer is a full-width sheet below md and 620px from md up', async () => {
  await renderDrawer();
  const aside = screen.getByRole('complementary', { name: 'Item detail' });
  expect(aside.className).toContain('w-full');
  expect(aside.className).toContain('md:w-155');
});
```

with these two, which assert behavior rather than class names:

```tsx
test('drawer is 620px wide, capped to leave a tap-to-close strip', async () => {
  await renderDrawer();
  const panel = screen.getByRole('dialog', { name: 'Item detail' });
  expect(panel.style.getPropertyValue('--panel-w')).toBe('min(620px, 100vw - 3rem)');
});

test('maximizing fills the viewport and restores', async () => {
  await renderDrawer();
  await userEvent.click(screen.getByRole('button', { name: 'Maximize' }));
  const panel = screen.getByRole('dialog', { name: 'Item detail' });
  expect(panel.style.getPropertyValue('--panel-w')).toBe('calc(100vw - 3rem)');
  await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
  expect(panel.style.getPropertyValue('--panel-w')).toBe('min(620px, 100vw - 3rem)');
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm --filter @tickets/web test -- item-drawer`
Expected: FAIL — `Unable to find role="dialog"`; the current drawer renders an `aside`.

- [ ] **Step 3: Rewrite `item-drawer.tsx`**

Replace the whole file:

```tsx
import { Drawer } from '@tickets/ui';
import type { Board, Item } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';
import { ItemDetail } from './item-detail';

// Right-side peek over the board. Esc, the scrim, the focus trap and the scroll
// lock all come from Drawer; the board behind stays mounted.
export function ItemDrawer({
  projectKey,
  board,
  indexes,
  item,
  onClose,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  item: Item;
  onClose: () => void;
}) {
  return (
    <Drawer
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      side="right"
      size="lg"
      storageKey="item-drawer"
      maximizable
      label="Item detail"
    >
      {/* Keyed so switching items in-place resets edit drafts and tab state. */}
      <ItemDetail
        key={item.id}
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        item={item}
        variant="drawer"
        onClose={onClose}
      />
    </Drawer>
  );
}
```

- [ ] **Step 4: Swap the close button for `DrawerControls`**

In `apps/web/src/components/item-detail.tsx`, add `DrawerControls` to the existing `@tickets/ui` import, then replace lines 297-299:

```tsx
          <button type="button" aria-label="Close" onClick={onClose} className={ICON_BUTTON}>
            ×
          </button>
```

with:

```tsx
          <DrawerControls />
```

`DrawerControls` closes through radix, so `onClose` fires via `onOpenChange`. Leave the `onClose` prop in place — the page variant and the drawer's own callers still use it.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `pnpm --filter @tickets/web test -- item-drawer`
Expected: PASS, including the existing Escape, title-PATCH and status-PATCH tests.

- [ ] **Step 6: Run every suite that mounts the drawer**

Run: `pnpm --filter @tickets/web test -- item-drawer all-items-screen board-screen`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/item-drawer.tsx apps/web/src/components/item-drawer.test.tsx apps/web/src/components/item-detail.tsx
git commit -m "refactor(web): item drawer moves onto the shared Drawer"
```

---

### Task 5: Adopt both primitives in the app shell

**Files:**
- Modify: `apps/web/src/components/shell/app-shell.tsx`
- Test: `apps/web/src/components/shell/app-shell.test.tsx` (new — the shell has no test today)

**Interfaces:**
- Consumes: `Drawer`, `SidePanel` from `@tickets/ui`.
- Produces: `AppShell` keeps its prop shape — `{ activeProjectKey?, onNewTicket?, children }`.

Both changes are in one file, so they are one task: the mobile slide-over becomes a `Drawer` and the desktop panel becomes a `SidePanel`. `ActivityRail` stays outside `SidePanel` — it sits beside the panel on desktop but rides inside the mobile drawer, so which element hosts it is the shell's composition.

This is the only call site gaining behavior with no test to gate it, so the task starts by writing one.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/shell/app-shell.test.tsx`. It follows the mocking pattern the sibling `schema-panel.test.tsx` already uses — stub the router and the panels, and assert the shell's own composition.

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './app-shell';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: '/', search: {} } }),
}));

// The shell's own layout is under test, not what the panels put inside it.
vi.mock('./activity-rail', () => ({ ActivityRail: () => <div>rail</div> }));
vi.mock('./brand-mark', () => ({ BrandMark: () => <span>mark</span> }));
vi.mock('./mode-panel', () => ({ ModePanel: () => <div>panel body</div> }));

afterEach(() => localStorage.clear());

const renderShell = () => render(<AppShell><p>content</p></AppShell>);
const dockedWidth = () =>
  (document.querySelector('aside') as HTMLElement).style.getPropertyValue('--panel-w');

describe('AppShell', () => {
  it('docks the navigation in a resizable panel', () => {
    renderShell();
    expect(screen.getByText('panel body')).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Resize Navigation' })).toBeInTheDocument();
    expect(dockedWidth()).toBe('224px');
  });

  it('collapses the navigation and remembers that across a remount', async () => {
    const { unmount } = renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    unmount();

    renderShell();
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('remembers a resized width across a remount', () => {
    const { unmount } = renderShell();
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Navigation' }), {
      key: 'ArrowRight',
    });
    expect(dockedWidth()).toBe('248px');
    unmount();

    renderShell();
    expect(dockedWidth()).toBe('248px');
  });

  it('opens the mobile navigation as a dialog that Escape closes', async () => {
    // Esc did nothing here before: the old slide-over was a bare fixed aside.
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

Both branches of the shell are in the DOM at once under jsdom, which applies no
CSS — so `hidden md:flex` hides nothing here. The mobile drawer contributes no
markup until it is opened, which is what keeps `getByText('panel body')`
unambiguous in the first three tests.

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @tickets/web test -- app-shell`
Expected: FAIL — no separator, no `Hide Navigation`, and the mobile nav is an `aside` rather than a dialog.

- [ ] **Step 3: Replace the mobile slide-over and the desktop panel**

In `apps/web/src/components/shell/app-shell.tsx`, add the import:

```tsx
import { Drawer, SidePanel } from '@tickets/ui';
```

Replace the desktop block:

```tsx
      {/* Desktop: rail + panel */}
      <div className="hidden md:flex">
        <ActivityRail mode={mode} />
        <div className="flex w-56 flex-none flex-col overflow-y-auto border-r-1 border-gray-6">{panel}</div>
      </div>
```

with:

```tsx
      {/* Desktop: rail + resizable panel */}
      <div className="hidden md:flex">
        <ActivityRail mode={mode} />
        <SidePanel
          label="Navigation"
          storageKey="app-nav"
          defaultWidth={224}
          minWidth={180}
          maxWidth={400}
          collapsible
        >
          {panel}
        </SidePanel>
      </div>
```

Replace the mobile slide-over block:

```tsx
      {/* Mobile slide-over: rail row on top + panel */}
      {mobileNavOpen ? (
        <div className="md:hidden">
          <div aria-hidden className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileNavOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 bg-gray-1 shadow-lg">
            <ActivityRail mode={mode} onNavigate={() => setMobileNavOpen(false)} />
            <div className="flex flex-1 flex-col overflow-y-auto">{panel}</div>
          </aside>
        </div>
      ) : null}
```

with:

```tsx
      {/* Mobile: the same rail and panel, as an overlay */}
      <Drawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        side="left"
        size="sm"
        label="Navigation"
        className="flex-row bg-gray-1 md:hidden"
      >
        <ActivityRail mode={mode} onNavigate={() => setMobileNavOpen(false)} />
        <div className="flex flex-1 flex-col overflow-y-auto">{panel}</div>
      </Drawer>
```

`Drawer` defaults to `flex-col`; the shell wants the rail beside the panel, so `flex-row` comes through `className`.

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm --filter @tickets/web test -- app-shell`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full web suite and typecheck**

Run: `pnpm --filter @tickets/web test && pnpm typecheck`
Expected: PASS. Every route renders this shell, so a regression here surfaces across the suite.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shell/app-shell.tsx apps/web/src/components/shell/app-shell.test.tsx
git commit -m "refactor(web): app shell nav moves onto Drawer and SidePanel"
```

---

### Task 6: Adopt `SidePanel` in the eer detail panel

**Files:**
- Modify: `apps/web/src/components/eer/view/detail-panel/side-panel.tsx`
- Test: `apps/web/src/components/eer/view/detail-panel/side-panel.test.tsx`

**Interfaces:**
- Consumes: `SidePanel` from `@tickets/ui`, aliased on import to avoid shadowing the local component name.
- Produces: the local `SidePanel` export keeps its zero-prop signature, so `eer-viewer.tsx` needs no change.

- [ ] **Step 1: Rewrite the test for the shared component's contract**

The existing test asserts the old `--sidebar-w` property, the old button labels and a `window`-listener drag. Replace the whole file with:

```tsx
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { SidePanel } from './side-panel';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function render() {
  return renderDiagram(<SidePanel />, twoZoneRaw());
}

describe('SidePanel', () => {
  it('shows the detail content and defaults to 320px wide', async () => {
    const { container } = await render();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.style.getPropertyValue('--panel-w')).toBe('320px');
  });

  it('collapses to an expand-only rail and restores', async () => {
    await render();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Details' }));
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();

    const expand = screen.getByRole('button', { name: 'Show Details' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expand);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Details' })).not.toBeInTheDocument();
  });

  it('resizes by keyboard, clamped to the panel bounds', async () => {
    const { container } = await render();
    const aside = container.querySelector('aside') as HTMLElement;
    const handle = screen.getByRole('separator', { name: 'Resize Details' });
    // A right-docked panel widens leftward.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(aside.style.getPropertyValue('--panel-w')).toBe('344px');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(aside.style.getPropertyValue('--panel-w')).toBe('296px');

    for (let i = 0; i < 40; i += 1) fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(aside.style.getPropertyValue('--panel-w')).toBe('640px');
  });

  it('remembers its width across a remount', async () => {
    const first = await render();
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Details' }), {
      key: 'ArrowLeft',
    });
    first.unmount();

    const { container } = await render();
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside.style.getPropertyValue('--panel-w')).toBe('344px');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm --filter @tickets/web test -- eer/view/detail-panel`
Expected: FAIL — the property is still `--sidebar-w` and the buttons are still named "Collapse panel".

- [ ] **Step 3: Rewrite `side-panel.tsx`**

Replace the whole file:

```tsx
// The right-hand panel's chrome is now the shared SidePanel: collapse toggle,
// drag-to-resize edge and persisted width all come from @tickets/ui. This file
// is left holding only the bounds the diagram wants and the content itself.

import { SidePanel as Panel } from '@tickets/ui';
import { DetailPanel } from './detail-panel';

export function SidePanel() {
  return (
    <Panel
      label="Details"
      side="right"
      storageKey="eer-detail"
      defaultWidth={320}
      minWidth={240}
      maxWidth={640}
      collapsible
      collapsedTo="rail"
    >
      <DetailPanel />
    </Panel>
  );
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm --filter @tickets/web test -- eer/view/detail-panel`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the eer suite**

Run: `pnpm --filter @tickets/web test -- eer`
Expected: PASS — `eer-viewer.test.tsx` mounts this panel.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/eer/view/detail-panel
git commit -m "refactor(web): eer detail panel moves onto the shared SidePanel"
```

---

### Task 7: Adopt `SidePanel` in the playground sidebar

**Files:**
- Modify: `packages/web/playground/src/shell/sidebar/sidebar.tsx`
- Test: `packages/web/playground/src/shell/sidebar/sidebar.test.tsx`

**Interfaces:**
- Consumes: `SidePanel` from `@tickets/ui`.
- Produces: `Sidebar` keeps its props — `{ demos, selected, linkProps, onOpenPalette }`. `SIDEBAR_MIN`, `SIDEBAR_MAX` and `clampWidth` are still exported because `sidebar.test.tsx` and `gallery-shell.tsx` import them.

- [ ] **Step 1: Check what the existing test still asserts**

Run: `pnpm --filter @tickets/playground test -- sidebar`
Expected: PASS today. Read the output and note every test name — the list, filter and href tests must all still pass afterwards, because they cover the nav content this task does not touch.

- [ ] **Step 2: Update the chrome-level assertions**

In `sidebar.test.tsx`, the tests covering collapse, resize and the narrow overlay now describe `SidePanel`'s contract. Change every occurrence of:

- `'Show component list'` → `'Show Components'`
- `'Hide component list'` → `'Hide Components'`
- `'Resize component list'` → `'Resize Components'`
- `--sidebar-width` → `--panel-w`

Leave the list, filter, href and palette tests untouched.

- [ ] **Step 3: Rewrite the chrome half of `sidebar.tsx`**

Keep the filter box, the `All` link and the grouped demo links exactly as they are. Replace everything from the `useIsNarrow` helper down to the closing `</aside>` so the file becomes:

```tsx
import { useState } from 'react';
import { cn, Icon, SidePanel, type CollectedDemo } from '@tickets/ui';
import type { GalleryNavigation } from '../navigation';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 400;
const SIDEBAR_DEFAULT = 224;

export const clampWidth = (px: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, px));

export function Sidebar({
  demos,
  selected,
  linkProps,
  onOpenPalette,
}: {
  demos: LiveDemo[];
  selected: string | null;
  linkProps: GalleryNavigation['linkProps'];
  onOpenPalette: () => void;
}) {
  const [filterQuery, setFilterQuery] = useState('');

  const groups = [...new Set(demos.map((d) => d.meta.group))];
  const filtered = demos.filter((d) =>
    d.meta.title.toLowerCase().includes(filterQuery.toLowerCase()),
  );
  const shownGroups = groups.filter((g) => filtered.some((d) => d.meta.group === g));

  return (
    <SidePanel
      label="Components"
      storageKey="gallery-sidebar"
      defaultWidth={SIDEBAR_DEFAULT}
      minWidth={SIDEBAR_MIN}
      maxWidth={SIDEBAR_MAX}
      collapsible
      collapsedTo="edge"
      overlayBelow="lg"
      className="bg-surface-raised"
    >
      <nav className="pg-scroll flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-6">
        <div className="flex h-7.5 min-w-0 shrink-0 items-center gap-1.5 rounded-lg border-1 border-gray-6 bg-surface-inset px-1.5 pl-2.5">
          <input
            type="text"
            placeholder="Filter components…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-13/19 text-gray-11 outline-none placeholder:text-gray-9"
          />
          <button
            type="button"
            onClick={onOpenPalette}
            className="h-4.5 shrink-0 rounded-sm border-1 border-gray-7 bg-surface-raised px-1.5 text-11/13 tracking-wider text-gray-9 hover:text-gray-11"
          >
            ⌘K
          </button>
        </div>

        <a
          {...linkProps({ slug: null })}
          className={cn(
            'shrink-0 truncate rounded-md px-2 py-1 text-13/19',
            selected === null ? 'bg-indigo-3 text-indigo-9' : 'text-gray-11 hover:text-gray-12',
          )}
        >
          All
        </a>
        {shownGroups.map((group) => (
          <div key={group} className="flex shrink-0 flex-col gap-0.5">
            <span className="truncate px-2 font-mono text-11/13 uppercase tracking-wider text-gray-9">
              {group}
            </span>
            {filtered
              .filter((d) => d.meta.group === group)
              .map((d) => (
                <a
                  key={d.slug}
                  {...linkProps({ slug: d.slug })}
                  title={d.meta.title}
                  className={cn(
                    'shrink-0 truncate rounded-md px-2 py-1 text-13/19',
                    selected === d.slug
                      ? 'bg-indigo-3 text-indigo-9'
                      : 'text-gray-11 hover:text-gray-12',
                  )}
                >
                  {d.meta.title}
                </a>
              ))}
          </div>
        ))}
      </nav>
    </SidePanel>
  );
}
```

The `Icon` import is gone from this file's own markup — `SidePanel` draws the toggles now. Remove it from the import if your editor flags it as unused; `cn` is still needed. `loadFlag`/`loadLayout`/`saveFlag`/`saveLayout` and `runtimeStyle` are no longer imported here, but `persisted-layout` stays in the package for the resizable-panels layouts that still use it.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm --filter @tickets/playground test -- sidebar`
Expected: PASS.

- [ ] **Step 5: Run the playground suite**

Run: `pnpm --filter @tickets/playground test`
Expected: PASS — `gallery-shell.test.tsx` mounts the sidebar.

- [ ] **Step 6: Commit**

```bash
git add packages/web/playground/src/shell/sidebar
git commit -m "refactor(playground): gallery sidebar moves onto the shared SidePanel"
```

---

### Task 8: Whole-repo verification

**Files:** none — this task only runs checks and fixes what they surface.

- [ ] **Step 1: Typecheck the monorepo**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: Run every suite**

Run: `pnpm --filter @tickets/ui test && pnpm --filter @tickets/web test && pnpm --filter @tickets/playground test`
Expected: PASS.

- [ ] **Step 3: Verify the token boundary held**

Run: `pnpm --filter @tickets/ui tokens:verify`
Expected: PASS — proves the keyframes went into the hand-authored tail and no generated region moved.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 5: Confirm the seven behavior changes by hand**

Start the stack per the `running-the-stack` skill (`pnpm dev`; web on :4620, gallery on :4650) and check each:

1. The app-shell desktop nav drags between 180 and 400px, collapses, and both survive a reload.
2. The eer detail panel's width survives a reload.
3. The item drawer and mobile nav slide in from their edge.
4. The item drawer drags wider and maximizes.
5. Opening a drawer locks body scroll; closing returns focus to the trigger.
6. Esc closes the mobile nav.
7. The playground sidebar still collapses to a floating button and overlays below 1024px.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(ui): address issues found verifying Drawer and SidePanel"
```

---

## Notes for the implementer

**jsdom gives every element a zero-size rect.** `getBoundingClientRect()` returns all zeros, so a left panel's drag width reduces to `clientX` and a right panel's to `-clientX` (clamped to the minimum). The `SidePanel` drag test relies on this; do not add a rect stub to make the numbers prettier, because the clamp behavior it proves is the real contract.

**Radix `Dialog` needs a `Title`.** Without one it logs a console warning on every open. `Drawer` renders the `label` in a `sr-only` title, which is also what names the dialog for `getByRole('dialog', { name })`.

**The eer panel's old drag math measured from `window.innerWidth`.** The shared hook measures from the panel's own rect instead, which is correct for both a docked panel and a fixed overlay, and does not assume the panel touches the viewport edge.

**Do not add `role="complementary"` to the drawer.** It is a dialog now; `aside` inside a dialog would give it two competing roles.
