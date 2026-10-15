---
title: useResizeHandle
summary: A separator dragged, or moved with the arrow keys, to resize what it
  sits beside, in pixels or as a share of a box, with its props and no markup of
  its own.
order: 3
related: [Writing a hook, useDrag, useElementSize]
---

[//]: # 'written from use-resize-handle.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useResizeHandle

A separator dragged, or moved with the arrow keys, to resize what it
sits beside: the height of a box from its bottom edge, the width of a
sidebar, the share of a box two panes split. It holds the value, its
bounds and the keys, and hands out the separator's props, over
[useDrag](use-drag.md) and [useElementSize](use-element-size.md).
It sizes nothing: the caller sets the value on what it resizes, as a
height, a width or a grid's columns.

## Import

```tsx
import { useResizeHandle } from '@bh/hooks';
```

## Examples

**A box from its edge**

```tsx
import { useResizeHandle } from '@bh/hooks';

// A box the reader makes taller or shorter from its bottom edge, by the
// pointer or the arrow keys, its height held by the hook. A plain separator,
// with no component of bh's.

export function ABoxFromItsEdge() {
  const { value, isDragging, getSeparatorProps, ref } = useResizeHandle<HTMLDivElement>({
    orientation: 'horizontal',
    defaultValue: 144,
    min: 96,
    max: 320,
  });
  return (
    <div className="border-gray-6 rounded-8 flex w-full max-w-320 flex-col overflow-hidden border-1">
      <div
        ref={ref}
        style={{ height: value }}
        className="text-12/17 text-gray-11 p-12 font-mono tabular-nums"
      >
        {value}px
      </div>
      <div
        {...getSeparatorProps({ 'aria-label': 'Resize the box' })}
        className="group/edge border-gray-6 flex h-12 cursor-row-resize touch-none items-center justify-center border-t-1 outline-none"
      >
        <span
          className={
            isDragging
              ? 'bg-indigo-9 h-3 w-32 rounded-full'
              : 'bg-gray-6 group-hover/edge:bg-gray-8 group-focus-visible/edge:bg-indigo-9 h-3 w-32 rounded-full transition-colors'
          }
        />
      </div>
    </div>
  );
}
```

Drag the box's bottom edge, or focus it and press the arrow keys: the
height goes from 96 to 320 pixels, 24 at a key. `orientation` says
which way the separator lies, and so which keys move it: a
`horizontal` separator, a bar across, moves up and down, a `vertical`
one left and right. The hook holds the height here, from
`defaultValue`, and the box takes it as its `height`.

`ref` goes on the box. A drag or a key starts from the size the box is
laid out at, measured as it starts, so the edge stays under the
pointer even where CSS holds the box smaller than its value. With no
value set and no default, the value is the box's own size, measured,
until the reader moves it.

## Held by the caller

**A split the page holds**

```tsx
import { useState } from 'react';
import { useResizeHandle } from '@bh/hooks';

// Two panes side by side, split where the reader drags the line between
// them or moves it with the arrow keys. The page holds the share, so a
// button of its own can put it back. A plain separator, with no component of
// bh's: the share is of the box the separator sits in.

export function ASplitThePageHolds() {
  const [share, setShare] = useState(0.5);
  const { isDragging, getSeparatorProps } = useResizeHandle({
    orientation: 'vertical',
    unit: 'share',
    value: share,
    onChange: setShare,
    min: 0.2,
    max: 0.8,
  });
  const percent = Math.round(share * 100);
  return (
    <div className="flex w-full max-w-400 flex-col items-start gap-8">
      <div className="border-gray-6 rounded-8 text-12/17 text-gray-11 flex h-120 w-full overflow-hidden border-1 font-mono tabular-nums">
        <div
          style={{ width: `${String(percent)}%` }}
          className="border-gray-6 flex shrink-0 items-center justify-center border-r-1"
        >
          {percent}%
        </div>
        <div
          {...getSeparatorProps({ 'aria-label': 'Split the panes' })}
          className="group/line relative z-10 -mx-6 flex w-12 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none"
        >
          <span
            className={
              isDragging
                ? 'bg-indigo-9 h-32 w-3 rounded-full'
                : 'bg-gray-6 group-hover/line:bg-gray-8 group-focus-visible/line:bg-indigo-9 h-32 w-3 rounded-full transition-colors'
            }
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center">{100 - percent}%</div>
      </div>
      <button
        type="button"
        className="rounded-8 border-gray-6 text-13 border-1 px-12 py-6"
        onClick={() => setShare(0.5)}
      >
        Split evenly
      </button>
    </div>
  );
}
```

`unit: 'share'` makes the value a share of a box, from 0 to 1, and a
drag moves it by as far as the pointer goes over the box's size. The
box is the separator's parent here; give `ref` to another element to
measure that instead. The page holds the share in its own state, as
`value` and `onChange`, so **Split evenly** puts it back by setting
that state. A screen reader says a share as a percentage: here
`aria-valuenow` goes from 20 to 80.

`onChange` hears each move of a drag. `onCommit` hears a change once it
is done, when the drag is let go and at each key, and is where a value
is stored, as `@bh/ui`'s Drawer and SidePanel store their widths under
the app's key. A press that moves nothing says nothing.

## Which way it grows

An arrow key moves the separator its way, and a drag follows the
pointer. A `share` grows as the separator moves right or down. A `px`
value is a size, so it depends which edge of the element the handle
is on: `edge: 'end'`, its bottom or right edge, grows it as the handle
moves down or right; `edge: 'start'`, its top or left edge, grows it as
the handle moves up or left, as a panel docked to the window's right
edge grows from its left.

```tsx
import { useState } from 'react';
import { useResizeHandle } from '@bh/hooks';

export function APanelOnTheRight() {
  const [width, setWidth] = useState(320);
  const handle = useResizeHandle<HTMLElement>({
    orientation: 'vertical',
    // Docked right: the handle is the panel's left edge.
    edge: 'start',
    value: width,
    onChange: setWidth,
    min: 180,
    max: 480,
  });
  return (
    <aside ref={handle.ref} style={{ width }} className="fixed inset-y-0 right-0">
      <div
        {...handle.getSeparatorProps({ 'aria-label': 'Resize the panel' })}
        className="absolute inset-y-0 left-0 w-6 -translate-x-1/2 cursor-col-resize touch-none"
      />
    </aside>
  );
}
```

## Rules

- **Its server value** is the value given, or for a `px` element with
  none set, `undefined`: it is measured in the browser before it first
  paints.
- **The separator is a window splitter**: role `separator`, its
  `aria-orientation`, a tab stop, and `aria-valuenow`,
  `aria-valuemin` and `aria-valuemax`, in pixels or as a percentage. A
  `px` value with no `max` leaves `aria-valuemax` out. Name it
  yourself, with `aria-label`, and give it `touch-action: none`
  (`touch-none`), so a touch drags it rather than scrolling the page.
- **Your props merge in**: `getSeparatorProps(own)` runs your handlers
  first, then its own, and its role and ARIA values win over yours.
  To keep a change from happening, hold the value and decline it.
- **Values are kept** within `min` and `max`, in whole pixels or to
  four places of a share. `min` is 0 unless given, `max` none for
  `px` and 1 for a share; a key moves 24 pixels, or 0.05 of the box,
  unless `step` says otherwise.
- **Held by the caller**, it keeps no copy: a change calls `onChange`,
  and the new value comes back as `value`. `null` is a caller that
  holds a `px` value and has set none, so the element's own size is
  the value.
- **What keeps its identity**: `setValue` and `ref`, for the hook's
  life; the callbacks are read when they are called, so they need no
  `useCallback`.
- **Cleaning up**: a drag cut short by an unmount lets go of the
  pointer and says nothing is done.

## Reference

```ts
useResizeHandle<T extends Element = HTMLElement>(options: UseResizeHandleOptions): UseResizeHandleResult<T>
```

A separator the reader drags, or moves with the arrow keys, to resize
what it sits beside: the height of a panel from its bottom edge, the width
of a sidebar, the share of a box two panes split. It holds the value, the
bounds and the keys, and hands out the separator's props over `useDrag`;
it draws nothing, and sizes nothing: the caller sets the value on the
element, as a height, a width or a grid's columns.

A `px` drag or key starts from the element's own size, measured as it
starts, so the edge stays under the pointer even where CSS holds the
element smaller than its value; with nothing measured (no element, or no
layout), it starts from the value. A share moves by the drag's distance
over the box's size. Values are kept within `min` and `max`, in whole
pixels or to four places of a share.

Its server value is the value given, or `undefined` for a `px` element
with none, which is measured before it first paints.

| Parameter                        | Type                                              | Default                                           | Description                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)             | `UseResizeHandleOptions`                          |                                                   |                                                                                                                                                                                    |
| `options.orientation` (required) | `ResizeOrientation`: `'horizontal'`, `'vertical'` |                                                   | Which way the separator lies, and so which arrow keys move it: up and down for `horizontal`, left and right for `vertical`.                                                        |
| `options.unit`                   | `ResizeUnit`: `'px'`, `'share'`                   | `'px'`                                            | What the value is: a size in pixels, `px`, unless `share`, a share of the box from 0 to 1.                                                                                         |
| `options.edge`                   | `ResizeEdge`: `'start'`, `'end'`                  | `'end'`                                           | For `px`, which edge of the element the handle is on: `end` (bottom or right) unless `start` (top or left).                                                                        |
| `options.value`                  | `number \| null`                                  |                                                   | The value, for a caller that holds it; it then changes only through `onChange`. `null`, for `px`, is a caller that holds it and has set none: the element's own size is the value. |
| `options.defaultValue`           | `number`                                          |                                                   | Where the value starts while the hook holds it. Read on the first render only. Without one, a `px` value is the element's own size until it is moved, and a share is 0.5.          |
| `options.onChange`               | `(value: number) => void`                         |                                                   | Hears every change, with the new value, whoever holds it: each move of a drag, each key.                                                                                           |
| `options.onCommit`               | `(value: number) => void`                         |                                                   | Hears a change once it is done: a drag let go or taken by the browser, a key, or `setValue`. Where a value is stored.                                                              |
| `options.min`                    | `number`                                          | `0`                                               | The least the value goes to: 0 unless given.                                                                                                                                       |
| `options.max`                    | `number`                                          | `unit === 'share' ? 1 : Number.POSITIVE_INFINITY` | The most the value goes to: no limit for `px` and 1 for a share, unless given.                                                                                                     |
| `options.step`                   | `number`                                          | `unit === 'share' ? 0.05 : 24`                    | How far an arrow key moves it: 24 pixels, or 0.05 of the box, unless given.                                                                                                        |

Returns `UseResizeHandleResult<T>`.

```ts
interface UseResizeHandleOptions
```

What `useResizeHandle` takes.

| Member                   | Type                                              | Default | Description                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation` (required) | `ResizeOrientation`: `'horizontal'`, `'vertical'` |         | Which way the separator lies, and so which arrow keys move it: up and down for `horizontal`, left and right for `vertical`.                                                        |
| `unit`                   | `ResizeUnit`: `'px'`, `'share'`                   |         | What the value is: a size in pixels, `px`, unless `share`, a share of the box from 0 to 1.                                                                                         |
| `edge`                   | `ResizeEdge`: `'start'`, `'end'`                  |         | For `px`, which edge of the element the handle is on: `end` (bottom or right) unless `start` (top or left).                                                                        |
| `value`                  | `number \| null`                                  |         | The value, for a caller that holds it; it then changes only through `onChange`. `null`, for `px`, is a caller that holds it and has set none: the element's own size is the value. |
| `defaultValue`           | `number`                                          |         | Where the value starts while the hook holds it. Read on the first render only. Without one, a `px` value is the element's own size until it is moved, and a share is 0.5.          |
| `onChange`               | `(value: number) => void`                         |         | Hears every change, with the new value, whoever holds it: each move of a drag, each key.                                                                                           |
| `onCommit`               | `(value: number) => void`                         |         | Hears a change once it is done: a drag let go or taken by the browser, a key, or `setValue`. Where a value is stored.                                                              |
| `min`                    | `number`                                          |         | The least the value goes to: 0 unless given.                                                                                                                                       |
| `max`                    | `number`                                          |         | The most the value goes to: no limit for `px` and 1 for a share, unless given.                                                                                                     |
| `step`                   | `number`                                          |         | How far an arrow key moves it: 24 pixels, or 0.05 of the box, unless given.                                                                                                        |

```ts
interface UseResizeHandleResult<T extends Element>
```

What `useResizeHandle` gives back: state, the action, the prop getter, then the ref.

| Member                         | Type                                                                                                 | Default | Description                                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value` (required)             | `number`                                                                                             |         | The value: the caller's, the hook's, or for `px` with none set, the element's own size, measured. `undefined` on a server, and until an element with no size set is measured.                                                                                                        |
| `isDragging` (required)        | `boolean`                                                                                            |         | Whether a drag is running.                                                                                                                                                                                                                                                           |
| `setValue` (required)          | `(value: number) => void`                                                                            |         | Sets the value, kept within `min` and `max`, as a key would: `onChange`, then `onCommit`. The same function for the hook's life.                                                                                                                                                     |
| `getSeparatorProps` (required) | `<Own extends object>( own?: Own, ) => Omit<Own, keyof ResizeSeparatorProps> & ResizeSeparatorProps` |         | The separator's props, with yours merged in: its role, orientation and ARIA values, a tab stop, the arrow keys and the drag. Your handlers run first, then the hook's. Name it yourself (`aria-label`), and give it `touch-action: none`, so a touch drags it rather than scrolling. |
| `ref` (required)               | `RefCallback<T>`                                                                                     |         | Goes on the element measured: for `px` the one it resizes, whose size a drag or a key starts from; for a share the box it divides, which is the separator's parent element if this goes nowhere. The same function for the hook's life.                                              |

```ts
interface ResizeSeparatorProps extends DragHandleProps
```

What `getSeparatorProps` sets on the separator, over the caller's own props.

| Member                            | Type                                              | Default | Description                                                                     |
| --------------------------------- | ------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `onPointerDown` (required)        | `PointerEventHandler<Element>`                    |         |                                                                                 |
| `onPointerMove` (required)        | `PointerEventHandler<Element>`                    |         |                                                                                 |
| `onPointerUp` (required)          | `PointerEventHandler<Element>`                    |         |                                                                                 |
| `onPointerCancel` (required)      | `PointerEventHandler<Element>`                    |         |                                                                                 |
| `onLostPointerCapture` (required) | `PointerEventHandler<Element>`                    |         |                                                                                 |
| `role` (required)                 | `'separator'`                                     |         |                                                                                 |
| `aria-orientation` (required)     | `ResizeOrientation`: `'horizontal'`, `'vertical'` |         |                                                                                 |
| `aria-valuenow` (required)        | `number`                                          |         | The value: in pixels, or a share as a percentage; left out while there is none. |
| `aria-valuemin` (required)        | `number`                                          |         |                                                                                 |
| `aria-valuemax` (required)        | `number`                                          |         | Left out for a `px` value with no `max`.                                        |
| `tabIndex` (required)             | `0`                                               |         |                                                                                 |
| `onKeyDown` (required)            | `(event: KeyboardEvent<Element>) => void`         |         |                                                                                 |

```ts
type ResizeOrientation = 'horizontal' | 'vertical';
```

Which way a separator lies, as its `aria-orientation`: `horizontal`, a bar
across, moved up and down, between what is stacked; `vertical`, a bar
down, moved left and right, between what sits side by side.

One of `'horizontal'`, `'vertical'`.

```ts
type ResizeUnit = 'px' | 'share';
```

What a resize handle's value is: `px`, the size of the element it
resizes, in pixels; `share`, where it sits across the box it divides,
from 0 to 1.

One of `'px'`, `'share'`.

```ts
type ResizeEdge = 'start' | 'end';
```

Which edge of the element it resizes a `px` handle is on: `end`, its
bottom or right edge, so the element grows as the handle moves down or
right; `start`, its top or left edge, so it grows as the handle moves up
or left, as a panel docked to the right does from its left edge.

One of `'start'`, `'end'`.
