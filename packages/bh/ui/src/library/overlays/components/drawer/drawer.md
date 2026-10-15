---
title: Drawer
summary: A modal panel that slides in from the left or right edge of the page.
related: [SidePanel, Dialog]
---

[//]: # 'written from drawer.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Drawer

A modal panel that slides in from the left or right edge of the page.

The reader can drag its inner edge to resize it, and with a
`storageKey` it remembers the width they left it at. What it holds is
yours; `DrawerControls` gives it a close button.

## Import

```tsx
import { Drawer, DrawerControls } from '@bh/ui';
```

## Examples

`side` picks the edge. The content is a column: here, a header with the
controls, then a body that scrolls.

**From either side**

```tsx
import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function FromEitherSide() {
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [open, setOpen] = useState(false);
  function openFrom(next: 'left' | 'right') {
    setSide(next);
    setOpen(true);
  }
  return (
    <div className="flex gap-8">
      <Button onClick={() => openFrom('left')}>Open left</Button>
      <Button onClick={() => openFrom('right')}>Open right</Button>
      <Drawer open={open} onOpenChange={setOpen} side={side} label="Details">
        <div className="border-gray-6 flex shrink-0 items-center gap-8 border-b-1 px-16 py-12">
          <span className="text-14 font-500 flex-1">Details</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 flex-1 overflow-y-auto px-16 py-12">
          Drag the inner edge to resize it. Esc closes it.
        </p>
      </Drawer>
    </div>
  );
}
```

From the `bottom` it is a sheet, as a phone's: as wide as the window,
as tall as its content up to 48 pixels short of the top, rounded at the
top, and not resized, so `size`, the widths and `maximizable` don't
apply.

**From the bottom**

```tsx
import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function FromTheBottom() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open a sheet</Button>
      <Drawer open={open} onOpenChange={setOpen} side="bottom" label="Sort by">
        <div className="flex shrink-0 items-center gap-8 px-16 pt-12 pb-8">
          <span className="text-14 font-500 flex-1">Sort by</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 overflow-y-auto px-16 pb-24">
          As wide as the window and as tall as what it holds, up to 48 pixels short of the top.
        </p>
      </Drawer>
    </>
  );
}
```

`size` is the width it opens at: 288, 400 or 620 pixels. The reader can
drag it between `minWidth` and `maxWidth`, 280 and 960 by default.

**Sizes**

```tsx
import { useState } from 'react';
import { Button, DRAWER_SIZES, Drawer, DrawerControls, type DrawerSize } from '@bh/ui';

function SizedDrawer({ size }: { size: DrawerSize }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{size}</Button>
      <Drawer open={open} onOpenChange={setOpen} size={size} label={`Size ${size}`}>
        <div className="flex shrink-0 justify-end px-8 py-8">
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 px-16">{DRAWER_SIZES[size]} pixels wide.</p>
      </Drawer>
    </>
  );
}

export function Sizes() {
  return (
    <div className="flex gap-8">
      <SizedDrawer size="sm" />
      <SizedDrawer size="md" />
      <SizedDrawer size="lg" />
    </div>
  );
}
```

`maximizable` adds a button that widens the drawer to the window. With a
`storageKey`, it remembers its width and whether it was maximized.

**Maximizable**

```tsx
import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function Maximizable() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open preview</Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        size="lg"
        maximizable
        storageKey="preview-drawer"
        label="Preview"
      >
        <div className="border-gray-6 flex shrink-0 items-center gap-8 border-b-1 px-16 py-12">
          <span className="text-14 font-500 flex-1">Preview</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 flex-1 overflow-y-auto px-16 py-12">
          Resize or maximize it, close it, and open it again.
        </p>
      </Drawer>
    </>
  );
}
```

However wide its `size`, a drawer stops 48 pixels short of the window's
other edge, so there is always some of the dim left to tap. In a window
narrower than `minWidth` and those 48 pixels, the resize handle goes, as
there is no room to drag. [Elevation](../../../../../docs/foundations/elevation.md) has the
layers the dim and the drawer sit on.

**Narrow window**

```tsx
import { useState } from 'react';
import { Button, Drawer, DrawerControls } from '@bh/ui';

export function NarrowWindow() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-16">
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Drawer open={open} onOpenChange={setOpen} label="Details">
        <div className="border-gray-6 flex shrink-0 items-center gap-8 border-b-1 px-16 py-12">
          <span className="text-14 font-500 flex-1">Details</span>
          <DrawerControls />
        </div>
        <p className="text-13/19 text-gray-11 flex-1 overflow-y-auto px-16 py-12">
          The strip on the left is left to tap.
        </p>
      </Drawer>
    </div>
  );
}
```

## Keyboard and accessibility

| Key         | Does                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `Tab`       | Moves to the next control in the drawer; from the last, back to the first.                                        |
| `Shift+Tab` | Moves to the previous control in the drawer; from the first, to the last.                                         |
| `Esc`       | Closes the drawer.                                                                                                |
| `←` or `→`  | On the resize handle, widens or narrows the drawer by 24 pixels; the arrow pointing away from its edge widens it. |

The drawer has the `dialog` role, named by `label`, which is not shown.
Its content is yours, so it has no description. The resize handle is a
focusable `separator` named "Resize" and the label, whose
`aria-valuenow` is the width in pixels. The controls are named Close,
Maximize and Restore.

While it is open, the page behind is hidden from assistive technology
and takes no pointer events, and a click on the dim closes it. Something
a library mounts outside the drawer, like a popover added to `body`,
needs `pointer-events: auto` of its own to take a click.

Closing returns focus to whatever had it when the drawer opened, also
when the drawer is mounted already open, and also after its content has
changed while it was open. If that has left the page or can no longer
take focus, focus goes to the nearest thing still on the page that held
it, such as a list that takes focus. Dialog's
[`useRestoreFocus`](../dialog/dialog.md#userestorefocus) does
this.

## When not to use it

- For a column beside the content rather than over it, use
  [SidePanel](../side-panel/side-panel.md).
- For a window in the middle of the page, use
  [Dialog](../dialog/dialog.md).

## Props

### Drawer

| Prop                      | Type                                          | Default   | Description                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open` (required)         | `boolean`                                     |           | Whether the drawer is open.                                                                                                                                                                                |
| `onOpenChange` (required) | `(open: boolean) => void`                     |           | Called with the new open state: `false` on Esc, a click on the dim or the close button.                                                                                                                    |
| `label` (required)        | `string`                                      |           | Names the drawer for assistive technology, and its resize handle. It is not shown.                                                                                                                         |
| `side`                    | `DrawerSide`: `'left'`, `'right'`, `'bottom'` | `'right'` | The edge it slides in from. From the `bottom` it is a sheet as wide as the window and as tall as its content, rounded at the top, that can't be resized: `size`, the widths and `maximizable` don't apply. |
| `size`                    | `DrawerSize`: `'md'`, `'lg'`, `'sm'`          | `'md'`    | Its starting width: `sm` 288, `md` 400 or `lg` 620 pixels.                                                                                                                                                 |
| `minWidth`                | `number`                                      | `280`     | The narrowest the reader can drag it, in pixels.                                                                                                                                                           |
| `maxWidth`                | `number`                                      | `960`     | The widest the reader can drag it, in pixels.                                                                                                                                                              |
| `storageKey`              | `string`                                      |           | Remembers its width and whether it is maximized in `localStorage`, under this key with `:width` and `:maximized` after it. Without one, it remembers nothing.                                              |
| `maximizable`             | `boolean`                                     | `false`   | Adds a Maximize button to `DrawerControls`, which widens the drawer to the window.                                                                                                                         |
| `className`               | `string`                                      |           | Classes merged onto the panel.                                                                                                                                                                             |
| `children` (required)     | `ReactNode`                                   |           | The drawer's content, laid out as a column.                                                                                                                                                                |

### DrawerControls

It reads the drawer it is in, so it throws outside one.

| Prop        | Type     | Default | Description                           |
| ----------- | -------- | ------- | ------------------------------------- |
| `className` | `string` |         | Classes merged onto the buttons' row. |
