---
title: SidePanel
summary: A column beside the content that the reader can resize and collapse.
related: [Drawer, Tree]
---

[//]: # 'written from side-panel.doc.yaml by pnpm docs:sync; edit that file, not this one'

# SidePanel

A column beside the content that the reader can resize and collapse.

Where there is room, it is part of the layout, and the page stays usable
beside it. Below `overlayBelow`, it floats over the content as a
[Drawer](../drawer/drawer.md) instead.

## Import

```tsx
import { SidePanel } from '@bh/ui';
```

## Examples

Put it in a row beside the content. The reader drags its inner edge
between `minWidth` and `maxWidth`; `collapsible` adds a button that
hides it, leaving a rail to bring it back. `collapsedTo="edge"` leaves a
button at the window's edge instead, which takes no column from the
content.

**Collapsible**

```tsx
import { SidePanel } from '@bh/ui';

export function Collapsible() {
  return (
    <div className="rounded-8 border-gray-6 flex h-256 overflow-hidden border-1">
      <SidePanel label="Folders" collapsible>
        <div className="text-13/19 flex flex-col gap-4 p-12">
          <span>Documents</span>
          <span>Pictures</span>
          <span>Music</span>
        </div>
      </SidePanel>
      <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
    </div>
  );
}
```

`side="right"` docks it on the right. With a `storageKey`, it remembers
its width and whether it was collapsed.

**On the right**

```tsx
import { SidePanel } from '@bh/ui';

export function OnTheRight() {
  return (
    <div className="rounded-8 border-gray-6 flex h-256 overflow-hidden border-1">
      <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
      <SidePanel
        label="Details"
        side="right"
        collapsible
        defaultWidth={240}
        maxWidth={420}
        storageKey="details-panel"
      >
        <div className="text-13/19 flex flex-col gap-4 p-12">
          <span>holiday.jpg</span>
          <span className="text-gray-11">2.4 MB</span>
        </div>
      </SidePanel>
    </div>
  );
}
```

Given `open`, the panel keeps no open state of its own, so a control
elsewhere on the page can open it. `collapsedTo="none"` leaves nothing
behind when it is shut, as the page has its own button.

**Opened from elsewhere**

```tsx
import { useState } from 'react';
import { Button, SidePanel } from '@bh/ui';

export function OpenedFromElsewhere() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-8 border-gray-6 flex h-256 flex-col overflow-hidden border-1">
      <div className="border-gray-6 flex justify-end border-b-1 p-8">
        <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          Filters
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
        <SidePanel
          label="Filters"
          side="right"
          collapsible
          collapsedTo="none"
          open={open}
          onOpenChange={setOpen}
        >
          <div className="text-13/19 flex flex-col gap-4 p-12">
            <span>Colour</span>
            <span>Size</span>
            <span>Shape</span>
          </div>
        </SidePanel>
      </div>
    </div>
  );
}
```

Below `overlayBelow`, `md` or `lg`, the panel is shut, and a button at
the top of its place in the layout opens it as a drawer. It floats over
the content beside it, which leaves that corner room, and stays clear of
whatever is above the page: on a phone, the top bar of
[AppShell](../../../../../../shell/docs/app-shell.md#on-a-phone). Each time the window narrows
past it, the drawer starts shut, unless `open` holds the state.
[Layout](../../../../../docs/foundations/layout.md#breakpoints) has the breakpoints.

**Below its breakpoint**

```tsx
import { SidePanel } from '@bh/ui';

export function BelowItsBreakpoint() {
  return (
    <div className="flex h-screen">
      <SidePanel label="Folders" collapsible overlayBelow="md">
        <div className="text-13/19 flex flex-col gap-4 p-12">
          <span>Documents</span>
          <span>Pictures</span>
          <span>Music</span>
        </div>
      </SidePanel>
      <div className="text-13/19 text-gray-11 flex-1 p-12 pt-64">Content</div>
    </div>
  );
}
```

A page that opens the panel from a control of its own, given `open`,
turns that button off with `reopenButton={false}`. On a phone, as here,
the page's button is the only way in; docked, the panel keeps its rail.

**Opened from its header**

```tsx
import { useState } from 'react';
import { Button, SidePanel } from '@bh/ui';

export function OpenedFromItsHeader() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-screen flex-col">
      <div className="border-gray-6 flex items-center justify-between border-b-1 p-8">
        <span className="text-14 font-600">Map</span>
        <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          Layers
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <SidePanel
          label="Layers"
          collapsible
          overlayBelow="md"
          reopenButton={false}
          open={open}
          onOpenChange={setOpen}
        >
          <div className="text-13/19 flex flex-col gap-4 p-12">
            <span>Roads</span>
            <span>Rivers</span>
            <span>Contours</span>
          </div>
        </SidePanel>
        <div className="text-13/19 text-gray-11 flex-1 p-12">Content</div>
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key        | Does                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `←` or `→` | On the resize handle, widens or narrows the panel by 24 pixels; the arrow pointing away from its edge widens it. |
| `Esc`      | Below `overlayBelow`, closes the drawer.                                                                         |

Docked, the panel is an `aside`, a `complementary` landmark named by
`label`, and never holds focus. The resize handle is a focusable
`separator` named "Resize" and the label, whose `aria-valuenow` is the
width in pixels. The button that hides it is named "Hide" and the
label, and the one that brings it back "Show" and the label, each with
`aria-expanded`.

Hidden while focus is inside it, the panel gives focus back to what
opened it, like the page's own button that sets `open`, or else to the
button that brings it back. A panel the page lays out open was opened
by nothing, so hiding it sends focus to that button. Dialog's
[`useRestoreFocus`](../dialog/dialog.md#userestorefocus) does
this.

Below `overlayBelow`, it is a Drawer: a `dialog` named by `label`, which
holds focus while it is open, and gives it back as a Drawer does.

## When not to use it

For a panel the reader opens over the page for a moment, use
[Drawer](../drawer/drawer.md).

## Props

| Prop                  | Type                                        | Default  | Description                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label` (required)    | `string`                                    |          | Names the panel for assistive technology, and its buttons and resize handle.                                                                                                                                                                                                                 |
| `side`                | `PanelSide`: `'left'`, `'right'`            | `'left'` | The side of the layout it docks to.                                                                                                                                                                                                                                                          |
| `defaultWidth`        | `number`                                    | `224`    | Its width in pixels until the reader resizes it.                                                                                                                                                                                                                                             |
| `minWidth`            | `number`                                    | `180`    | The narrowest the reader can drag it, in pixels.                                                                                                                                                                                                                                             |
| `maxWidth`            | `number`                                    | `400`    | The widest the reader can drag it, in pixels.                                                                                                                                                                                                                                                |
| `storageKey`          | `string`                                    |          | Remembers its width and whether it is collapsed in `localStorage`, under this key with `:width` and `:collapsed` after it. Without one, it remembers nothing.                                                                                                                                |
| `collapsible`         | `boolean`                                   | `false`  | Adds a button at its top that hides the panel.                                                                                                                                                                                                                                               |
| `collapsedTo`         | `CollapsedTo`: `'rail'`, `'edge'`, `'none'` | `'rail'` | What a hidden panel leaves: a `rail` to reopen it from, a button at the window's `edge`, or `none`.                                                                                                                                                                                          |
| `reopenButton`        | `boolean`                                   | `true`   | Whether a shut panel draws the floating button that brings it back: below `overlayBelow`, and at `collapsedTo="edge"`. `false` leaves none, for a page that opens the panel from a control of its own, given `open`. A docked panel's rail stays.                                            |
| `overlayBelow`        | `PanelBreakpoint`: `'md'`, `'lg'`           |          | Below this breakpoint, the panel floats over the content as a Drawer instead. Without it, the panel stays docked at every width.                                                                                                                                                             |
| `open`                | `boolean`                                   |          | Open or shut, owned by the caller. With it the panel keeps no open state of its own — neither the persisted docked flag nor the overlay's — so a control elsewhere on the page can open it, and closing it from inside (the hide toggle, the overlay's dismiss) goes through `onOpenChange`. |
| `onOpenChange`        | `(open: boolean) => void`                   |          | Called with the new open state when `open` is given: from its buttons, or its drawer closing.                                                                                                                                                                                                |
| `className`           | `string`                                    |          | Classes merged onto the docked panel.                                                                                                                                                                                                                                                        |
| `children` (required) | `ReactNode`                                 |          | The panel's content, in a column that scrolls.                                                                                                                                                                                                                                               |
