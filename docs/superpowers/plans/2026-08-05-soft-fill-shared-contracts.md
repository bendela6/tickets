# Soft Fill Shared Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four shared recipes the Soft Fill input layer depends on — a `Popup` shell, an `OptionRow` with three independent channels, a `Chip`, and an inward mode for `focusRing` — and prove each against the four controls that already need them.

**Architecture:** Two layers, not one. `Popup` owns anchoring and geometry and knows nothing about its contents, so the coming swatch and icon grids use it unchanged; `OptionRow` owns a single row and its three visual channels. `ComboboxList` stops being a bespoke listbox and becomes a composition of the two. `Chip` and the inward `focusRing` are independent of both.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (`--spacing: 1px`), radix-ui (`Popover`), vitest + @testing-library/react.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-08-05-soft-fill-shared-contracts-design.md`. Design source: `19 Input Layer FINAL Soft Fill.dc.html` (read via DesignSync `get_file`, never WebFetch).
- **`--spacing` is 1px, so a number in a class name IS pixels.** `px-9` is 9px, `h-34` is 34px.
- **Never assert a token value in a test.** Assert naming rules, shapes, and what must NOT exist. Reference `CONTROL_LADDER` and `focusRing()` rather than restating rungs.
- **Never write `ring-*` on a control** — call `focusRing()`. Adapter trap 9.
- **`ring-<number>` takes integers only**; `ring-1.5` compiles to nothing. Adapter trap 10.
- **A regenerated safelist does not reach a running dev server.** After `pnpm --filter @tickets/ui tokens:build`, verify against `pnpm --filter @tickets/web build`, not :4620. Adapter trap 11.
- Interpolated classes reach CSS only via the safelist; run `pnpm --filter @tickets/ui tokens:build` after any change to an interpolated class and commit the regenerated `safelist.css`.
- Conventional commits scoped by app: `feat(ui): …`, `refactor(ui): …`.
- Checks: `pnpm --filter @tickets/ui test` · `pnpm typecheck --force`.

## File Structure

| Path | Responsibility |
| --- | --- |
| `packages/web/ui/src/style/focus-ring/focus-ring.ts` | **Modify.** Add the `inward` placement. |
| `packages/web/ui/src/components/inputs/popup/popup.tsx` | **Create.** The shell: anchoring, 4px offset, radius 6, 5px padding, elevation. |
| `packages/web/ui/src/components/inputs/popup/index.ts` | **Create.** Barrel. |
| `packages/web/ui/src/components/inputs/option-row/option-row.tsx` | **Create.** One row, three independent channels. |
| `packages/web/ui/src/components/inputs/option-row/index.ts` | **Create.** Barrel. |
| `packages/web/ui/src/components/inputs/chip/chip.tsx` | **Create.** Rung-2 fill, ladder-sized, full-square remove. |
| `packages/web/ui/src/components/inputs/chip/index.ts` | **Create.** Barrel. |
| `packages/web/ui/src/components/inputs/combobox-list/combobox-list.tsx` | **Modify.** Compose `Popup` + `OptionRow`; split `active` into `cursor` + `:hover`. |
| `packages/web/ui/src/components/inputs/multi-combobox/multi-combobox.tsx` | **Modify.** Chips become `Chip`; `+N` focusable. |
| `packages/web/ui/src/components/inputs/index.ts` | **Modify.** Export the three new components. |

---

### Task 1: `focusRing` gains an inward placement

**Files:**
- Modify: `packages/web/ui/src/style/focus-ring/focus-ring.ts`
- Test: `packages/web/ui/src/style/focus-ring/focus-ring.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `focusRing(hue: Hue, on?: FocusTrigger, placement?: FocusPlacement): string` where `FocusPlacement = 'outward' | 'inward'`, default `'outward'`. Every existing two-argument call site keeps working unchanged.
- Produces: `cursorRing(hue: Hue): string` — the same inset rim with **no pseudo-class prefix**, for a keyboard cursor that is drawn by state rather than by `:focus`. `OptionRow` needs this because in an `aria-activedescendant` listbox the row never holds DOM focus — the input does — so a `focus-visible:` variant would never fire on the row the cursor is on.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { focusRing } from './focus-ring';

test('the default placement is unchanged, so every existing call site still works', () => {
  expect(focusRing('indigo', 'focus')).toBe(focusRing('indigo', 'focus', 'outward'));
});

test('outward draws a rim plus a halo; inward draws only an inset rim', () => {
  // Shape, not rungs: an inward ring lives inside a joined control or a popup
  // row, where a halo would either be clipped or bleed into the neighbouring
  // row. So the halo is what must be absent.
  const outward = focusRing('indigo', 'focus-visible', 'outward');
  const inward = focusRing('indigo', 'focus-visible', 'inward');

  expect(outward).toMatch(/ring-\d/);
  expect(inward).toMatch(/ring-inset/);
  expect(outward).not.toMatch(/ring-inset/);
  // The halo is the translucent part — an alpha modifier on the ring colour.
  expect(outward).toMatch(/ring-indigo-\d+\/\d+/);
  expect(inward).not.toMatch(/ring-indigo-\d+\/\d+/);
});

test('both placements still kill the native outline and follow the trigger', () => {
  for (const placement of ['outward', 'inward'] as const) {
    const cls = focusRing('red', 'focus-within', placement);
    expect(cls).toContain('focus-within:outline-none');
    expect(cls).not.toContain('focus-visible:');
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @tickets/ui test -- --run src/style/focus-ring`
Expected: FAIL — `focusRing` takes two arguments, so the third is a type error and `inward` is identical to `outward`.

- [ ] **Step 3: Implement**

Replace the `focusRing` function and add the placement type. Keep the existing `WIDTH`/`OFFSET`/rung constants and their comments untouched.

```ts
export const FOCUS_PLACEMENTS = ['outward', 'inward'] as const;
export type FocusPlacement = (typeof FOCUS_PLACEMENTS)[number];

/**
 * Inside a joined control or a popup row there is nowhere for a halo to go: it
 * is either clipped by the parent or bleeds over the neighbouring row, and in
 * both cases it stops reading as "this one". So the inward placement drops the
 * halo and draws the rim inset instead, which is also why it is a ring rather
 * than a border — the row has no border of its own to colour in.
 */
export function focusRing(
  hue: Hue,
  on: FocusTrigger = 'focus-visible',
  placement: FocusPlacement = 'outward',
): string {
  if (placement === 'inward') {
    return [
      `${on}:outline-none`,
      `${on}:ring-${RIM_WIDTH}`,
      `${on}:ring-inset`,
      `${on}:ring-${hue}-${RIM_LIGHT}`,
      `dark:${on}:ring-${hue}-${RIM_DARK}`,
    ].join(' ');
  }
  return [
    `${on}:outline-none`,
    `${on}:border-${hue}-${RIM_LIGHT}`,
    `dark:${on}:border-${hue}-${RIM_DARK}`,
    `${on}:ring-${HALO}`,
    `${on}:ring-${hue}-${HALO_RUNG}/${HALO_ALPHA_LIGHT}`,
    `dark:${on}:ring-${hue}-${HALO_RUNG}/${HALO_ALPHA_DARK}`,
  ].join(' ');
}
```

Add above it, beside the other constants:

```ts
/** The inset rim's width. 2px, not 1.5 — `ring-<number>` rejects fractions. */
const RIM_WIDTH = 2;
```

And below `focusRing`, the state-driven twin:

```ts
/**
 * The keyboard cursor, drawn from STATE rather than from `:focus`.
 *
 * A listbox row never holds DOM focus — the input does, and points at the row
 * with `aria-activedescendant` — so a `focus-visible:` variant would never fire
 * on the row the cursor is actually on. Same rim as the inward placement, no
 * pseudo-class in front of it.
 *
 * It exists so `OptionRow` does not hand-write a ring. Every ring in this
 * library comes from this module; that rule is what stopped six components
 * wearing a focus treatment nobody could see.
 */
export function cursorRing(hue: Hue): string {
  return `ring-${RIM_WIDTH} ring-inset ring-${hue}-${RIM_LIGHT} dark:ring-${hue}-${RIM_DARK}`;
}
```

Add a test for it alongside the others:

```ts
test('the cursor ring is state-driven, so it carries no pseudo-class', () => {
  // A listbox row never holds DOM focus, so a focus-visible: prefix would never
  // fire on the row the cursor is on.
  const cls = cursorRing('indigo');
  expect(cls).toMatch(/ring-inset/);
  expect(cls).not.toMatch(/focus/);
  expect(cls).not.toMatch(/hover/);
});
```

- [ ] **Step 4: Export the new type**

In `packages/web/ui/src/style/focus-ring/index.ts`:

```ts
export {
  focusRing,
  cursorRing,
  FOCUS_TRIGGERS,
  FOCUS_PLACEMENTS,
  type FocusTrigger,
  type FocusPlacement,
} from './focus-ring';
```

- [ ] **Step 5: Regenerate the safelist and verify**

```bash
pnpm --filter @tickets/ui tokens:build
pnpm --filter @tickets/ui test -- --run src/style/focus-ring
pnpm typecheck --force
```
Expected: tests PASS, typecheck 24/24. The safelist grows by the `ring-inset` variants.

- [ ] **Step 6: Commit**

```bash
git add packages/web/ui/src/style/focus-ring packages/web/ui/styles/generated/safelist.css
git commit -m "feat(ui): focusRing gains an inward placement

Inside a joined control or a popup row a halo is either clipped by the parent
or bleeds over the next row, so the inward placement drops it and draws the rim
inset. A ring rather than a border, because a row has no border to colour in.

Default is unchanged, so every existing call site keeps its outward rim+halo."
```

---

### Task 2: `Popup` — the shell

**Files:**
- Create: `packages/web/ui/src/components/inputs/popup/popup.tsx`
- Create: `packages/web/ui/src/components/inputs/popup/index.ts`
- Test: `packages/web/ui/src/components/inputs/popup/popup.test.tsx`

**Interfaces:**
- Consumes: `PopoverContent` from `../../popover`.
- Produces: `<Popup open onOpenChange trigger matchTriggerWidth?>{children}</Popup>` and `popupClass` (the geometry recipe as a string, for anything that must render its own container).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Popup, popupClass } from './popup';

test('the shell renders nothing until it is opened', () => {
  render(<Popup open={false} onOpenChange={() => {}} trigger={<button>Open</button>}>
    <p>contents</p>
  </Popup>);
  expect(screen.queryByText('contents')).toBeNull();
});

test('the shell knows nothing about its contents — a grid is as valid as a list', () => {
  // The whole reason Popup and OptionRow are separate: the colour and icon
  // pickers are grids, and they take the shell with no rows at all.
  render(<Popup open onOpenChange={() => {}} trigger={<button>Open</button>}>
    <div data-testid="grid" role="grid" />
  </Popup>);
  expect(screen.getByTestId('grid')).toBeTruthy();
});

test('the trigger stays interactive and reports open state back', async () => {
  const seen: boolean[] = [];
  render(<Popup open={false} onOpenChange={(v) => seen.push(v)} trigger={<button>Open</button>}>
    <p>contents</p>
  </Popup>);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(seen).toContain(true);
});

test('the geometry recipe is one string, so a caller that must render its own container matches', () => {
  // Asserted as a shape — that it carries a radius and a padding — never as
  // the rung values, which are the design's to move.
  expect(popupClass).toMatch(/rounded-/);
  expect(popupClass).toMatch(/\bp-\d/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @tickets/ui test -- --run src/components/inputs/popup`
Expected: FAIL — `Cannot find module './popup'`.

- [ ] **Step 3: Implement**

`packages/web/ui/src/components/inputs/popup/popup.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';
import { cn } from '../../../style';

/**
 * The popup geometry, exported separately for the handful of callers that must
 * render their own container (a calendar grid that needs its own padding).
 * Everything else should use `Popup` and never see this.
 *
 * From the design's contract line: "Popups sit 4px below the trigger, radius 6,
 * 5px padding". The offset is a prop on Radix's side rather than a class, so it
 * is not in here.
 */
export const popupClass =
  'z-50 rounded-md border-1 border-gray-6 bg-surface-raised p-5 shadow-lg';

/** 4px below the trigger — the design's number, kept next to the class it pairs with. */
export const POPUP_OFFSET = 4;

type PopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element the popup hangs off. Rendered as-is; it keeps its own handlers. */
  trigger: ReactNode;
  children: ReactNode;
  /** Match the trigger's width — right for a select, wrong for an icon grid. */
  matchTriggerWidth?: boolean;
  className?: string;
};

/**
 * The shell every popup in the input layer wears: anchoring, offset, radius,
 * padding and elevation — and nothing about what goes inside it.
 *
 * That boundary is the point. The colour and icon pickers are grids rather than
 * lists, so a single do-everything list component would have grown a `layout`
 * prop and two divergent code paths. They take this and render their own
 * contents; the list-shaped controls take this plus `OptionRow`.
 */
export function Popup({
  open,
  onOpenChange,
  trigger,
  children,
  matchTriggerWidth = false,
  className,
}: PopupProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={POPUP_OFFSET}
        className={cn(
          popupClass,
          matchTriggerWidth && 'w-[var(--radix-popover-trigger-width)]',
          className,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
```

`packages/web/ui/src/components/inputs/popup/index.ts`:

```ts
export { Popup, popupClass, POPUP_OFFSET } from './popup';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @tickets/ui test -- --run src/components/inputs/popup`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/components/inputs/popup
git commit -m "feat(ui): Popup, the shell every input popup wears

Anchoring, offset, radius, padding and elevation — and nothing about contents.
That boundary is why this is separate from the row: the colour and icon pickers
are grids, and they take the shell with no rows at all."
```

---

### Task 3: `OptionRow` — three independent channels

**Files:**
- Create: `packages/web/ui/src/components/inputs/option-row/option-row.tsx`
- Create: `packages/web/ui/src/components/inputs/option-row/index.ts`
- Test: `packages/web/ui/src/components/inputs/option-row/option-row.test.tsx`

**Interfaces:**
- Consumes: `focusRing` (Task 1).
- Produces: `<OptionRow selected cursor disabled leading trailing onPick id>{children}</OptionRow>`. `cursor` and `selected` are independent booleans; hover is CSS-only and has no prop.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { OptionRow } from './option-row';

const classesOf = (name: string) => screen.getByRole('option', { name }).className;

test('the three channels are independent — every combination renders', () => {
  // The regression this exists to prevent: ComboboxList carried ONE `active`
  // flag for both the keyboard cursor and hover, so a row could not be
  // selected-but-not-cursored, and mousing over a row silently moved the
  // keyboard cursor. Three channels means three combinations must differ.
  render(
    <>
      <OptionRow onPick={() => {}}>plain</OptionRow>
      <OptionRow onPick={() => {}} cursor>cursored</OptionRow>
      <OptionRow onPick={() => {}} selected>selected</OptionRow>
      <OptionRow onPick={() => {}} cursor selected>both</OptionRow>
    </>,
  );

  const plain = classesOf('plain');
  const cursored = classesOf('cursored');
  const selected = classesOf('selected');
  const both = classesOf('both');

  expect(cursored).not.toBe(plain);
  expect(selected).not.toBe(plain);
  expect(both).not.toBe(cursored);
  expect(both).not.toBe(selected);
});

test('hover is CSS only, so it can never move the cursor', () => {
  // There is deliberately no `hovered` prop and no onMouseEnter: the parent owns
  // the cursor index, and a resting mouse must not be able to change what a
  // keyboard user commits.
  render(<OptionRow onPick={() => {}}>row</OptionRow>);
  const row = screen.getByRole('option', { name: 'row' });
  expect(row.className).toMatch(/hover:/);
  expect(row.onmouseenter).toBeNull();
});

test('selection is announced, not merely drawn', () => {
  render(<OptionRow onPick={() => {}} selected>row</OptionRow>);
  expect(screen.getByRole('option', { name: 'row' })).toHaveAttribute('aria-selected', 'true');
});

test('the cursor is a visual channel, not a selection claim', () => {
  // aria-selected must NOT follow the cursor: the parent points at the cursor
  // row with aria-activedescendant, and a cursor that also claimed selection
  // would have a screen reader announce every row as selected while arrowing.
  render(<OptionRow onPick={() => {}} cursor>row</OptionRow>);
  expect(screen.getByRole('option', { name: 'row' })).toHaveAttribute('aria-selected', 'false');
});

test('a disabled row refuses to pick', async () => {
  let picked = 0;
  render(<OptionRow onPick={() => { picked += 1; }} disabled>row</OptionRow>);
  screen.getByRole('option', { name: 'row' }).click();
  expect(picked).toBe(0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @tickets/ui test -- --run src/components/inputs/option-row`
Expected: FAIL — `Cannot find module './option-row'`.

- [ ] **Step 3: Implement**

`packages/web/ui/src/components/inputs/option-row/option-row.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn, cursorRing, focusRing } from '../../../style';

type OptionRowProps = {
  children: ReactNode;
  /** This row is the value. Drawn as a trailing check plus 500 weight. */
  selected?: boolean;
  /** This row is where the keyboard is. Drawn as an inward ring. */
  cursor?: boolean;
  disabled?: boolean;
  /** A dot, an avatar or an icon before the label — data, not decoration. */
  leading?: ReactNode;
  /** A count or a hint after the label. The selection check is drawn separately. */
  trailing?: ReactNode;
  onPick: () => void;
  id?: string;
};

/**
 * One row of a popup list, carrying the design's three independent channels.
 *
 *   cursor   → an inward ring. The PARENT owns the index.
 *   hover    → a floor step, in CSS only.
 *   selected → a trailing check and 500 weight.
 *
 * They are independent on purpose, and the independence is the contract. The
 * listbox this replaces had a single `active` flag doing the work of the first
 * two, which meant a row could not be selected without also looking cursored,
 * and — worse — `onMouseEnter` moved the keyboard cursor, so a mouse resting
 * anywhere over the list decided what Enter would commit.
 *
 * Hence no `hovered` prop and no mouse handler beyond the click: hover is a
 * pure CSS state that cannot reach React, which makes the bad behaviour
 * unexpressible rather than merely absent.
 */
export function OptionRow({
  children,
  selected = false,
  cursor = false,
  disabled = false,
  leading,
  trailing,
  onPick,
  id,
}: OptionRowProps) {
  return (
    <button
      type="button"
      role="option"
      id={id}
      // Follows SELECTION, never the cursor. The parent points at the cursor
      // row with aria-activedescendant; if this tracked the cursor too, a
      // screen reader would announce every row as selected while arrowing.
      aria-selected={selected}
      disabled={disabled}
      onClick={() => { if (!disabled) onPick(); }}
      className={cn(
        'flex h-34 w-full min-w-0 items-center gap-8 rounded-control-xs px-9 text-left',
        'font-sans text-13 text-gray-12',
        'hover:bg-gray-4',
        // The row can also be focused directly when a list is used without an
        // aria-activedescendant input, so both treatments exist. They are the
        // same rim, so they cannot disagree.
        focusRing('indigo', 'focus-visible', 'inward'),
        cursor && cursorRing('indigo'),
        selected && 'font-500',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {leading}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
      {selected ? <span aria-hidden className="text-indigo-11 dark:text-indigo-9">✓</span> : null}
    </button>
  );
}
```

`packages/web/ui/src/components/inputs/option-row/index.ts`:

```ts
export { OptionRow } from './option-row';
```

- [ ] **Step 4: Run the tests and regenerate the safelist**

```bash
pnpm --filter @tickets/ui tokens:build
pnpm --filter @tickets/ui test -- --run src/components/inputs/option-row
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/components/inputs/option-row packages/web/ui/styles/generated/safelist.css
git commit -m "feat(ui): OptionRow, with the three channels genuinely independent

cursor is an inward ring, hover is a floor step in CSS only, selection is a
check plus 500 weight. No hovered prop and no mouse handler, so hover cannot
reach React and cannot move the cursor — the bad behaviour is unexpressible
rather than merely absent."
```

---

### Task 4: `Chip`

**Files:**
- Create: `packages/web/ui/src/components/inputs/chip/chip.tsx`
- Create: `packages/web/ui/src/components/inputs/chip/index.ts`
- Test: `packages/web/ui/src/components/inputs/chip/chip.test.tsx`

**Interfaces:**
- Consumes: `CONTROL_LADDER`, `ControlSize` from `../control`.
- Produces: `<Chip label size tone onRemove? onClick? removeLabel?>`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { CONTROL_LADDER } from '../control';
import { Chip } from './chip';

test('the remove target is the full square, not a glyph inside it', () => {
  // The design is explicit: "its remove target is the full 24px square". A
  // small × inside a large chip is the version everyone ships and nobody can
  // hit, so the button must carry the ladder's chip height as its own size.
  render(<Chip label="frontend" onRemove={() => {}} />);
  const remove = screen.getByRole('button', { name: /remove frontend/i });
  expect(remove.className).toContain(CONTROL_LADDER.md.chip);
  expect(remove.className).toMatch(/\baspect-square\b/);
});

test('removing does not also fire the chip body', async () => {
  // They are nested targets; without stopPropagation, removing a chip in a
  // MultiSelect trigger would also open the popup.
  const events: string[] = [];
  render(
    <Chip label="api" onClick={() => events.push('body')} onRemove={() => events.push('remove')} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /remove api/i }));
  expect(events).toEqual(['remove']);
});

test('a chip with no onRemove renders no remove target at all', () => {
  render(<Chip label="read-only" />);
  expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
});

test('+N is the same component, so overflow is focusable rather than decorative', () => {
  render(<Chip label="+3" onClick={() => {}} />);
  expect(screen.getByRole('button', { name: '+3' })).toBeTruthy();
});

test('every rung takes its height from the ladder', () => {
  for (const size of ['xs', 'md', 'lg'] as const) {
    const { unmount } = render(<Chip label={size} size={size} />);
    expect(screen.getByText(size).closest('[data-chip]')!.className, size)
      .toContain(CONTROL_LADDER[size].chip);
    unmount();
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @tickets/ui test -- --run src/components/inputs/chip`
Expected: FAIL — `Cannot find module './chip'`.

- [ ] **Step 3: Implement**

`packages/web/ui/src/components/inputs/chip/chip.tsx`:

```tsx
import type { MouseEvent } from 'react';
import { cn, focusRing, TONE_HUE, type Tone } from '../../../style';
import { CONTROL_LADDER, type ControlSize } from '../control';

type ChipProps = {
  label: string;
  size?: ControlSize;
  tone?: Tone;
  /** Makes the body a target — used by `+N`, which opens the popup. */
  onClick?: () => void;
  /** Omit entirely for a chip that cannot be removed; no dead × is rendered. */
  onRemove?: () => void;
  className?: string;
};

/**
 * A value inside a multi-value trigger. Chips live ONLY there — a tag on a
 * board card is a `Pill`, which keeps its own size domain and has no
 * interactive affordances.
 *
 * Two details the design is specific about, and both are usually got wrong:
 * the remove target is the whole square rather than the glyph drawn in it, and
 * `+N` is a chip with an `onClick` rather than a separate label — so overflow
 * is focusable and opens the popup, instead of being decoration that hides
 * values a keyboard user cannot reach.
 */
export function Chip({
  label,
  size = 'md',
  tone = 'primary',
  onClick,
  onRemove,
  className,
}: ChipProps) {
  const rung = CONTROL_LADDER[size];
  const hue = TONE_HUE[tone];
  const body = (
    <>
      <span className="min-w-0 truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={(event: MouseEvent) => {
            // Nested targets: without this, removing a chip inside a trigger
            // would also open the popup the trigger owns.
            event.stopPropagation();
            onRemove();
          }}
          className={cn(
            rung.chip,
            'aspect-square shrink-0 rounded-control-xs',
            'inline-flex items-center justify-center',
            `text-${hue}-11 hover:bg-${hue}-3`,
            focusRing(hue, 'focus-visible', 'inward'),
          )}
        >
          <span aria-hidden>×</span>
        </button>
      ) : null}
    </>
  );

  const shell = cn(
    'inline-flex items-center gap-4 rounded-control-xs pl-8',
    onRemove ? 'pr-0' : 'pr-8',
    rung.chip,
    `bg-${hue}-2 text-${hue}-11`,
    'font-sans text-12',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        data-chip
        onClick={onClick}
        className={cn(shell, focusRing(hue, 'focus-visible', 'inward'))}
      >
        {body}
      </button>
    );
  }
  return <span data-chip className={shell}>{body}</span>;
}
```

`packages/web/ui/src/components/inputs/chip/index.ts`:

```ts
export { Chip } from './chip';
```

- [ ] **Step 4: Regenerate the safelist and run**

```bash
pnpm --filter @tickets/ui tokens:build
pnpm --filter @tickets/ui test -- --run src/components/inputs/chip
pnpm typecheck --force
```
Expected: PASS (5 tests), typecheck 24/24. `bg-{hue}-2`, `text-{hue}-11` and `hover:bg-{hue}-3` are interpolated, so the safelist must grow — check it did before committing.

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/components/inputs/chip packages/web/ui/styles/generated/safelist.css
git commit -m "feat(ui): Chip, whose remove target is the whole square

Lives only inside multi-value triggers; a board tag stays a Pill. The remove
target is the full square rather than the glyph drawn in it, and +N is the same
component with an onClick, so overflow is focusable and opens the popup instead
of hiding values a keyboard user cannot reach."
```

---

### Task 5: Retrofit `ComboboxList` onto `Popup` + `OptionRow`

This is where the contracts stop being theory. The behavioural change is real: today `onMouseEnter` moves the keyboard cursor, and it must stop.

**Files:**
- Modify: `packages/web/ui/src/components/inputs/combobox-list/combobox-list.tsx`
- Test: `packages/web/ui/src/components/inputs/combobox-list/combobox-list.test.tsx`

**Interfaces:**
- Consumes: `OptionRow` (Task 3).
- Produces: no prop changes — `ComboboxListProps` is unchanged, which is what makes the existing suite a regression gate.

- [ ] **Step 1: Write the failing test — the behaviour that must change**

Append to `combobox-list.test.tsx`:

```tsx
test('a resting mouse cannot change what Enter commits', async () => {
  // The old behaviour: onMouseEnter called setActiveIndex, so hovering row 3
  // moved the keyboard cursor there and Enter picked it. A user arrowing with
  // the mouse parked over the list committed whatever was under the pointer.
  const picked: string[] = [];
  render(
    <ComboboxList
      options={[
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
        { value: 'c', label: 'Gamma' },
      ]}
      isSelected={() => false}
      onPick={(v) => picked.push(v)}
      searchable={false}
    />,
  );

  const rows = screen.getAllByRole('option');
  await userEvent.hover(rows[2]!);
  await userEvent.keyboard('{ArrowDown}{Enter}');

  // Cursor started at 0, one ArrowDown puts it on 1. The hover over row 2 is
  // visual only and must not have moved it.
  expect(picked).toEqual(['b']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @tickets/ui test -- --run src/components/inputs/combobox-list`
Expected: FAIL — `picked` is `['c']`, because hover moved the cursor.

- [ ] **Step 3: Delete the mouse handler and render through `OptionRow`**

In `combobox-list.tsx`, replace the `<button role="option">` block (around lines 210–248) with an `OptionRow`, and **delete `onMouseEnter={() => setActiveIndex(index)}` entirely**:

```tsx
<OptionRow
  id={`${listId}-opt-${option.value}`}
  selected={selected}
  cursor={index === activeIndex}
  disabled={option.disabled}
  onPick={() => pick(index)}
  leading={
    option.color ? (
      <span aria-hidden className={cn('size-8 shrink-0 rounded-full', `bg-${option.color}-9`)} />
    ) : undefined
  }
>
  {renderOption ? renderOption(option, selected) : option.label}
</OptionRow>
```

Add the import: `import { OptionRow } from '../option-row';`

Rename `activeIndex`/`setActiveIndex` to `cursorIndex`/`setCursorIndex` throughout the file — the old name is what let the two channels be conflated in the first place, and the rename is what stops it recurring.

- [ ] **Step 4: Run the whole existing suite**

Run: `pnpm --filter @tickets/ui test -- --run src/components/inputs`
Expected: PASS, including every pre-existing `combobox-list` test **unchanged**. That is the proof the retrofit altered no behaviour beyond the one it meant to.

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/components/inputs/combobox-list
git commit -m "refactor(ui): ComboboxList composes OptionRow, and hover stops moving the cursor

onMouseEnter called setActiveIndex, so a mouse parked anywhere over the list
decided what Enter committed — a keyboard user arrowing to row 1 and pressing
Enter got row 3. The handler is gone and hover is now CSS only.

activeIndex is renamed cursorIndex: one name for two channels is what let them
be conflated, and the rename is what stops it recurring. Props are unchanged,
so the existing suite passing untouched is the regression gate."
```

---

### Task 6: `MultiCombobox` chips become `Chip`, and `+N` becomes reachable

**Files:**
- Modify: `packages/web/ui/src/components/inputs/multi-combobox/multi-combobox.tsx`
- Test: `packages/web/ui/src/components/inputs/multi-combobox/multi-combobox.test.tsx`

**Interfaces:**
- Consumes: `Chip` (Task 4).
- Produces: no prop changes.

- [ ] **Step 1: Write the failing test**

```tsx
test('the overflow +N is focusable and opens the popup', async () => {
  // The design: "+N is a target, not a label." As a bare span it hid values
  // behind something no keyboard could reach.
  render(
    <MultiCombobox
      options={[
        { value: 'a', label: 'frontend' }, { value: 'b', label: 'api' },
        { value: 'c', label: 'flaky' }, { value: 'd', label: 'design' },
        { value: 'e', label: 'infra' },
      ]}
      value={['a', 'b', 'c', 'd', 'e']}
      onChange={() => {}}
      aria-label="Labels"
    />,
  );
  const overflow = screen.getByRole('button', { name: /^\+\d+$/ });
  expect(overflow).toBeTruthy();
  await userEvent.click(overflow);
  expect(screen.getByRole('listbox')).toBeTruthy();
});

test('removing a chip does not also open the popup', async () => {
  render(
    <MultiCombobox
      options={[{ value: 'a', label: 'frontend' }, { value: 'b', label: 'api' }]}
      value={['a', 'b']}
      onChange={() => {}}
      aria-label="Labels"
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /remove frontend/i }));
  expect(screen.queryByRole('listbox')).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @tickets/ui test -- --run src/components/inputs/multi-combobox`
Expected: FAIL — the `+N` is not a button.

- [ ] **Step 3: Replace the chip markup with `Chip`**

Swap each rendered value chip for `<Chip label={option.label} size={size} tone={option.color ?? 'primary'} onRemove={() => remove(option.value)} />`, and render the overflow as `<Chip label={`+${hidden}`} size={size} onClick={openPopup} />`. Import `Chip` from `../chip`.

- [ ] **Step 4: Run and typecheck**

```bash
pnpm --filter @tickets/ui test -- --run src/components/inputs
pnpm typecheck --force
```
Expected: PASS, typecheck 24/24.

- [ ] **Step 5: Commit**

```bash
git add packages/web/ui/src/components/inputs/multi-combobox
git commit -m "refactor(ui): MultiCombobox uses Chip, and +N is reachable

The overflow was a bare span, so the values it stood for were hidden behind
something no keyboard could focus. It is now a Chip with an onClick that opens
the popup, and removal stops propagating so it no longer opens it too."
```

---

### Task 7: Export the three, and verify the whole layer

**Files:**
- Modify: `packages/web/ui/src/components/inputs/index.ts`

- [ ] **Step 1: Add the exports**

```ts
export { Chip } from './chip';
export { OptionRow } from './option-row';
export { Popup, popupClass, POPUP_OFFSET } from './popup';
```

- [ ] **Step 2: Full verification**

```bash
pnpm --filter @tickets/ui tokens:build
pnpm --filter @tickets/ui test
pnpm typecheck --force
pnpm --filter @tickets/web build
```
Expected: all tests PASS, typecheck 24/24, build succeeds.

- [ ] **Step 3: Confirm the interpolated classes actually compiled**

The safelist gate — adapter trap 11. Do NOT check :4620; it serves pre-safelist CSS.

```bash
for c in 'ring-inset' 'rounded-control-xs' 'bg-indigo-2'; do
  printf '%-20s %s\n' "$c" "$(grep -o "$c" apps/web/dist/assets/*.css | wc -l)"
done
```
Expected: a non-zero count for each. A zero means the class never compiled and the component is silently unstyled.

- [ ] **Step 4: Commit**

```bash
git add packages/web/ui/src/components/inputs/index.ts packages/web/ui/styles/generated/safelist.css
git commit -m "feat(ui): export Popup, OptionRow and Chip"
```

---

## Deferred, deliberately

`Combobox`'s bolded match, skeleton loading rows, result count and no-results copy, and `DatePicker`'s inward-ring cursor and calendar tiles, are **not** in this plan. They are gap-closing on top of the contracts rather than the contracts themselves, and each needs its own test cycle. They follow immediately, as their own plan, once these seven tasks are green.
