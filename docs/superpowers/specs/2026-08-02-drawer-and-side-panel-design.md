# Drawer and SidePanel: one overlay, one docked, five call sites

**Date:** 2026-08-02
**Status:** awaiting review

## Goal

Five hand-rolled panel implementations exist across `apps/web` and
`packages/web/playground`. Replace them with two primitives in `@tickets/ui` —
`Drawer` (overlay) and `SidePanel` (docked) — that share one resize
implementation, and adopt them everywhere.

The design system spec (`docs/design/design-system.html`) defines no drawer or
panel, so this component is designed here rather than transcribed.

## What exists today

| Call site | Mode | Side | Width | Collapse | Resize | Scrim | Esc | Focus trap |
|---|---|---|---|---|---|---|---|---|
| `apps/web/src/components/item-drawer.tsx` | overlay | right | 620px, full-screen `<md` | — | — | yes | yes | no |
| `apps/web/src/components/shell/app-shell.tsx:72-80` | overlay | left | 288px | — | — | yes | no | no |
| `apps/web/src/components/shell/app-shell.tsx:66-69` | inline | left | 224px fixed | no | no | — | — | — |
| `apps/web/src/components/eer/view/detail-panel/side-panel.tsx` | inline | right | 320px (240–640) | 24px rail | drag + keys | — | — | — |
| `packages/web/playground/src/shell/sidebar/sidebar.tsx` | inline → overlay when narrow | left | 224px (180–400), persisted | floating button | drag, persisted | when narrow | no | no |

Two observations drove the design. Every overlay is hand-rolled and none has a
focus trap or scroll lock, while `Dialog` already gets all of it from radix. And
the two resize implementations each have something the other lacks: the
playground uses `setPointerCapture` so a fast drag that outruns the pointer keeps
resizing, and eer supports arrow-key stepping.

## Locked decisions

1. **Both overlay and docked panels are in scope** — all five call sites.
   Chosen over unifying only the overlays.
2. **Normalize everything, not just accessibility.** Overlays gain focus trap,
   Esc, scroll lock and return-focus; docked panels gain resize, collapse and
   persisted width — including the app-shell desktop panel (fixed 224px today)
   and the eer panel (deliberately non-persisted today).
3. **The inline→overlay hybrid is opt-in per call site**, not automatic. The
   playground opts in; eer stays docked at every width.
4. **Two components plus a shared hook**, not one component with a `mode` prop
   and not headless compound parts. A `mode` prop would leave half the props
   dead in each mode; compound parts would make all five call sites re-assemble
   the same chrome.
5. **Panels are resizable *and* expandable.** Resize is free drag on both
   components. On `Drawer`, "expand" means a maximize toggle: normal width ⇄
   near-full-screen, restoring the dragged width on the way back. Chosen over
   collapse-to-rail for overlays, and over supporting both.

## `Drawer` — the overlay

Lives at `packages/web/ui/src/components/drawer/`. Built on radix `Dialog`, so
focus trap, Esc, scroll lock, return-focus and `aria-modal` come from the
library rather than from a `useEffect` per call site.

```tsx
<Drawer
  open={open}
  onOpenChange={setOpen}
  side="right"           // 'left' | 'right'
  size="lg"              // 'sm' | 'md' | 'lg' → 288 / 400 / 620px initial width
  minWidth={320}
  maxWidth={960}
  storageKey="item-drawer"
  maximizable
  label="Item detail"
>
  {children}
</Drawer>
```

### Width

One rule covers both the desktop width and the mobile sheet: the drawer is its
configured width, capped at the viewport minus a **48px strip**. The strip
matters — it keeps a tap-to-close scrim target on a phone instead of going
edge-to-edge, and it is what `item-drawer.tsx` already does at `md` and up.

Implemented as `max-w-(--drawer-max)` with the property set to
`min(<width>px, 100vw - 3rem)`. Width rides a custom property because Tailwind
cannot scan a class built at runtime, and arbitrary `w-[…]` values are outside
the class-hygiene boundary. This is the same idiom `side-panel.tsx` and the eer
entity cards already use.

Below the configured `minWidth` there is nothing left to drag, so the resize
handle is not rendered.

### Maximize

`maximizable` enables a snap toggle between the normal width and near-full-screen
(still leaving the 48px strip). Restoring returns to the width the user last
dragged to, not the default. Both the width and the maximized flag persist under
`storageKey`.

### Controls

`DrawerControls` is an exported sub-component — maximize/restore and close
buttons that read state from the drawer's context. Consumers place it inside
**their own** header.

This matters for `ItemDetail`, which already renders a header with a close
button and a tab strip. A `header` prop on `Drawer` would force that layout to
be rebuilt as data; a floating control cluster would collide with the tabs.
`DrawerControls` follows the radix idiom `DialogClose` already sets.

### Motion

Slide in on `duration-200` with `ease-out`, the vocabulary the motion foundation
page (`packages/web/ui/src/foundation/motion/motion.demo.tsx`) already documents
for open/close and arrivals. No new tokens.

## `SidePanel` — the docked panel

Lives at `packages/web/ui/src/components/side-panel/`. Not a dialog: it holds a
column in the layout and never traps focus.

```tsx
<SidePanel
  side="left"            // 'left' | 'right'
  label="Navigation"     // a11y name; also titles the collapse toggle
  storageKey="app-nav"
  defaultWidth={224}
  minWidth={180}
  maxWidth={400}
  collapsible
  collapsedTo="rail"     // 'rail' | 'edge'
  overlayBelow="lg"      // optional: 'md' | 'lg'
>
  {children}
</SidePanel>
```

- **`collapsedTo="rail"`** leaves a 24px reopen strip that holds its column, so
  the layout does not reflow (eer's behavior). **`collapsedTo="edge"`** renders
  a floating reopen button instead, so a closed panel costs zero horizontal
  space (the playground's).
- **`overlayBelow`** is the hybrid, opt-in. Below the breakpoint the panel
  collapses and reopens by rendering **its own children through `Drawer`** — the
  playground's special case becomes composition rather than a sixth
  implementation. A narrow window forces it shut; widening restores whatever the
  user last chose, rather than leaving it stuck closed.

## `usePanelWidth` — the shared mechanics

One hook, used by both components, merging the better half of each existing
implementation:

- Drag with `setPointerCapture` (from the playground) so a fast drag that
  outruns the pointer keeps resizing instead of dropping the gesture.
- Arrow-key stepping on the separator (from eer), 24px per press.
- Clamp to `[minWidth, maxWidth]`.
- Persist the width to `localStorage` under `storageKey`; no key means no
  persistence.

The handle is a `role="separator"` with `aria-orientation="vertical"` and an
accessible name, which is what both current implementations already expose.

The hook owns width and nothing else. The two boolean states — `SidePanel`'s
collapsed and `Drawer`'s maximized — are not the same concept and do not belong
behind one overloaded flag, so each component holds its own through a small
`usePersistedFlag(key)` sharing the same `storageKey` namespace.

**Width precedence:** a stored width wins over `defaultWidth`/`size`, which is
what makes persistence worth having. A stored value outside the current
`[minWidth, maxWidth]` is clamped on read, so narrowing a call site's bounds
later cannot restore an impossible width.

`SidePanel` keeps ~20 lines of its own storage read/write rather than importing
the playground's `persisted-layout` module. Moving that module into `@tickets/ui`
would drag its react-resizable-panels concerns across the package boundary to
persist two values.

## Adoption, call site by call site

| Call site | Becomes | Gains | Deletes |
|---|---|---|---|
| `item-drawer.tsx` | `Drawer` right/lg, maximizable | focus trap, scroll lock, resize, maximize | scrim div + Esc listener (~20 lines) |
| `app-shell.tsx:72-80` (mobile nav) | `Drawer` left/sm | Esc, focus trap, scroll lock, resize | hand-rolled scrim |
| `app-shell.tsx:66-69` (desktop panel) | `SidePanel` left, 180–400, `collapsedTo="rail"` | resize, collapse, persisted width | — |
| `eer/.../side-panel.tsx` | `SidePanel` right, 240–640, `collapsedTo="rail"` | persisted width, pointer capture | ~60 lines |
| `playground/.../sidebar.tsx` | `SidePanel` left, `overlayBelow="lg"`, `collapsedTo="edge"` | arrow-key resize | ~90 lines of hybrid chrome |

`ItemDetail` keeps `variant="drawer"` and its own header; its close button is
replaced by `DrawerControls`, which also brings the maximize toggle.

`ActivityRail` stays **outside** `SidePanel` in `app-shell.tsx`. It is visible
beside the panel on desktop but rides *inside* the mobile drawer, so which
element hosts it is the call site's composition, not the panel's business.
`app-shell.tsx` therefore keeps its two branches — but each branch is now built
from these primitives instead of hand-rolled markup.

## Visual and behavioral changes, stated plainly

These follow from "normalize everything" and are visible to a user:

1. The app-shell desktop panel becomes resizable (180–400px, was a fixed 224px)
   and collapsible, and remembers both.
2. The eer detail panel's width now survives a reload. It deliberately did not
   before.
3. The item drawer and the mobile nav slide in rather than appearing instantly.
4. The item drawer can be dragged wider and maximized to near-full-screen.
5. Opening any overlay now locks body scroll and traps focus; closing returns
   focus to whatever opened it.
6. The mobile nav closes on Esc. It did not before.
7. The playground sidebar's saved width resets once, because the storage format
   changes from `persisted-layout`'s shape to the panel's own.

## Testing

Behavior, not classes or DOM shape.

**`Drawer`:** Esc closes; scrim click closes; focus moves into the drawer on
open and returns to the trigger on close; body scroll is locked while open and
released after; dragging the edge resizes and clamps at both ends; arrow keys
step the width; maximize snaps to full and restores the dragged width, not the
default; width and maximized state survive a remount when `storageKey` is set
and do not persist when it is absent; the resize handle is absent when the
viewport is under `minWidth`.

**`SidePanel`:** the same resize, clamp, key-step and persistence set; the
collapse toggle hides the panel and the reopen affordance restores it, for both
`collapsedTo` values; `overlayBelow` renders a `Drawer` under a mocked
`matchMedia` and a docked panel above the breakpoint; widening after a forced
narrow collapse restores the user's last choice.

**`usePanelWidth`:** clamping and persistence unit-tested directly, without a
DOM harness.

Both components get a `.demo.tsx` gallery page (`group: 'Components'`) per the
library convention, and must pass `domain-free.test.ts`.

The five call sites' existing tests are the adoption gate and must stay green:
`item-drawer.test.tsx`, `all-items-screen.test.tsx`, `side-panel.test.tsx`,
`sidebar.test.tsx`, `gallery-shell.test.tsx`.

## Risks

- **Preflight is off.** Radix portals content outside the app tree where no
  cascade reaches it, so the drawer needs explicit resets rather than inherited
  ones. This has bitten native controls before.
- **Dragging inside a portaled overlay.** Pointer capture is required; without
  it the gesture is lost the moment the pointer crosses the scrim.
- **`matchMedia` in tests.** `overlayBelow` reads it at mount, so the jsdom
  setup needs a stub — the playground sidebar's tests already establish the
  pattern.
- **Widths as custom properties.** Anything that tries to express a runtime
  width as a Tailwind class will silently not be scanned.

## Out of scope

- Top and bottom drawers. No call site wants one; `side` can grow later.
- Snap points or multi-position sheets.
- Persisting panel state anywhere but `localStorage`.
- Touch-drag resize on phones. The overlay is already viewport-width there, so
  there is nothing to drag.

## Types

```ts
type PanelSide = 'left' | 'right';
type DrawerSize = 'sm' | 'md' | 'lg';
type CollapsedTo = 'rail' | 'edge';
type Breakpoint = 'md' | 'lg';

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  side?: PanelSide;          // default 'right'
  size?: DrawerSize;         // default 'md'; a stored width overrides it
  minWidth?: number;         // default 280
  maxWidth?: number;         // default 960
  storageKey?: string;
  maximizable?: boolean;
  className?: string;
  children: React.ReactNode;
};

// Maximize/restore + close, reading state from the Drawer's context.
// Rendered inside the consumer's own header.
type DrawerControlsProps = {
  className?: string;
};

type SidePanelProps = {
  label: string;
  side?: PanelSide;          // default 'left'
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  collapsible?: boolean;
  collapsedTo?: CollapsedTo; // default 'rail'
  overlayBelow?: Breakpoint;
  className?: string;
  children: React.ReactNode;
};

type UsePanelWidth = (options: {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
}) => {
  width: number;
  setWidth: (px: number) => void;
  separatorProps: React.HTMLAttributes<HTMLDivElement>;
};

// Backs SidePanel's `collapsed` and Drawer's `maximized` separately.
// An unset key must not read as false: "never chosen" and "chosen false"
// differ, and only the first should fall back to `fallback`.
type UsePersistedFlag = (
  key: string | undefined,
  fallback: boolean,
) => [boolean, (next: boolean) => void];
```
