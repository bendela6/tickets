---
title: useDrag
summary: A handle dragged by the pointer, from where it went down, for a resize
  handle, a divider, a scrollbar's thumb or a card on a canvas.
order: 3
related: [Writing a hook, useResizeHandle]
---

[//]: # 'written from use-drag.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useDrag

A handle dragged by the pointer: where the pointer went down, where it
is now, and how far it has moved, with `isDragging` while it runs. It
draws nothing and moves nothing: the caller turns the moves into a
width, a share or a position, and spreads `getHandleProps()` on the
handle.

## Import

```tsx
import { useDrag } from '@bh/hooks';
```

## Examples

**A height from its edge**

```tsx
import { useState, type KeyboardEvent } from 'react';
import { useDrag } from '@bh/hooks';

// A box the reader makes taller or shorter from its bottom edge, by the
// pointer or the arrow keys: a value in pixels, which a drag adds its
// distance to. A plain separator, with no component of bh's.

const MIN = 96;
const MAX = 320;
const STEP = 24;
const STEPS: Partial<Record<string, number>> = { ArrowUp: -STEP, ArrowDown: STEP };

const clamp = (px: number) => Math.min(MAX, Math.max(MIN, Math.round(px)));

export function AHeightFromItsEdge() {
  const [height, setHeight] = useState(144);
  // What onStart returns comes with each move as `from`: the height the box
  // had as its edge was grabbed, which the move adds `dy` to.
  const drag = useDrag<number>({
    onStart: () => height,
    onMove: ({ dy, from }) => setHeight(clamp(from + dy)),
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setHeight((now) => clamp(now + step));
    }
  };
  return (
    <div className="border-gray-6 rounded-8 flex w-320 flex-col overflow-hidden border-1">
      <div style={{ height }} className="text-12/17 text-gray-11 p-12 font-mono tabular-nums">
        {height}px
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the box"
        aria-valuenow={height}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        {...drag.getHandleProps({ onKeyDown })}
        className="group/edge border-gray-6 flex h-12 cursor-row-resize touch-none items-center justify-center border-t-1 outline-none"
      >
        <span
          className={
            drag.isDragging
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
height goes from 96 to 320 pixels, 24 at a key. `onStart` returns the
height the box has as its edge is grabbed, and each move adds `dy` to
it, so the edge stays under the pointer however far it goes.

## A share of a box

**A split by share**

```tsx
import { useRef, useState, type KeyboardEvent } from 'react';
import { useDrag } from '@bh/hooks';

// Two panes side by side, split where the reader drags the line between
// them or moves it with the arrow keys: a share of the box, read off the
// box as the drag starts. A plain separator, with no component of bh's.

const MIN = 0.2;
const MAX = 0.8;
const STEP = 0.05;
const STEPS: Partial<Record<string, number>> = { ArrowLeft: -STEP, ArrowRight: STEP };

// Kept to hundredths, so the steps add up to the stops they show.
const clamp = (share: number) => Math.min(MAX, Math.max(MIN, Math.round(share * 100) / 100));

export function ASplitByShare() {
  const [share, setShare] = useState(0.5);
  const box = useRef<HTMLDivElement>(null);
  // The box is measured once, as the drag starts, and comes with each move
  // as `from`: the share is where the pointer is across it. With no box to
  // measure, `false` lets the press go by.
  const drag = useDrag<DOMRect>({
    onStart: () => box.current?.getBoundingClientRect() ?? false,
    onMove: ({ x, from }) => setShare(clamp((x - from.left) / from.width)),
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      setShare((now) => clamp(now + step));
    }
  };
  const percent = Math.round(share * 100);
  return (
    <div
      ref={box}
      className="border-gray-6 rounded-8 text-12/17 text-gray-11 flex h-120 w-400 overflow-hidden border-1 font-mono tabular-nums"
    >
      <div
        style={{ width: `${String(percent)}%` }}
        className="border-gray-6 flex shrink-0 items-center justify-center border-r-1"
      >
        {percent}%
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Split the panes"
        // A screen reader says the share as a percentage.
        aria-valuenow={percent}
        aria-valuemin={Math.round(MIN * 100)}
        aria-valuemax={Math.round(MAX * 100)}
        tabIndex={0}
        {...drag.getHandleProps({ onKeyDown })}
        className="group/line relative z-10 -mx-6 flex w-12 shrink-0 cursor-col-resize touch-none items-center justify-center outline-none"
      >
        <span
          className={
            drag.isDragging
              ? 'bg-indigo-9 h-32 w-3 rounded-full'
              : 'bg-gray-6 group-hover/line:bg-gray-8 group-focus-visible/line:bg-indigo-9 h-32 w-3 rounded-full transition-colors'
          }
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center">{100 - percent}%</div>
    </div>
  );
}
```

Drag the line between the panes, or use the arrow keys: the first pane
takes from a fifth to four fifths of the box, a twentieth at a key.
`onStart` measures the box once, as the drag starts, and each move
reads the share off it at `x`. The separator's `aria-valuenow` is what
a screen reader says, so it is the share as a percentage.

The keys, the bounds and the ARIA values of a separator are the
caller's, as in both: the hook is the pointer's half. For a separator
that resizes, [useResizeHandle](use-resize-handle.md) is both
halves, over this hook. `getHandleProps`
takes your props for the handle and merges them in, and a handler of
yours for a pointer event runs before the hook's.

## Rules

- **Only the main button** starts a drag, one at a time: `disabled`
  starts none, and `onStart` returning `false` lets a press go by, for
  a press the handle isn't for or a box that isn't there to measure.
- **The handle captures the pointer**, so a drag that outruns it keeps
  going, over other elements and out of the window. Give it
  `touch-action: none` (`touch-none`), so a touch drags it rather than
  scrolling the page.
- **The press's default is prevented**, so no text is selected and no
  native drag starts as the pointer moves, and the press focuses
  nothing. A handle that should take focus as it is pressed, as a card
  the arrow keys move, focuses itself in its own `onPointerDown`.
- **It ends** when the pointer is let go, with `onEnd`, or when the
  browser takes the pointer or `cancel()` is called, with `onCancel`.
  Only the pointer that started it is followed.
- **The callbacks are read when they run**, so they need no
  `useCallback`; `cancel` and `getHandleProps` are the same functions
  for the hook's life.
- **Its server value is no drag**: `isDragging` is `false`.
- **Cleaning up**: a drag cut short by an unmount lets go of the
  pointer, and calls nothing.

## Reference

```ts
useDrag<T = undefined>(options?: UseDragOptions<T>): UseDragResult
```

A drag of a handle by the pointer: where it went down, where it is now,
and how far it has moved, for a resize handle, a divider, a scrollbar's
thumb or a card on a canvas. It draws nothing and moves nothing: the
caller turns the moves into a width, a share or a position.

The handle captures the pointer, so a drag that outruns it keeps going;
only the main button starts one. The press's default is prevented, so
it selects no text and focuses nothing. What `onStart` returns comes with
each move as `from`: the value the drag started from, which a pixel value
adds `dx` to, or the box a share is measured against, which `x` is read
off.

Its server value is no drag. A drag cut short by an unmount lets go of
the pointer, and calls nothing.

| Parameter          | Type                               | Default | Description                                                                                                                                                                                                    |
| ------------------ | ---------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`          | `UseDragOptions<T>`                | `{}`    |                                                                                                                                                                                                                |
| `options.onStart`  | `(start: DragStart) => T \| false` |         | Called as the pointer goes down on the handle: what it returns comes with every move, as `from`, so a drag measures what it starts from once, a width or a box's rect. Return `false` to let this press go by. |
| `options.onMove`   | `(move: DragMove<T>) => void`      |         | Called as the pointer moves, while a drag runs.                                                                                                                                                                |
| `options.onEnd`    | `(move: DragMove<T>) => void`      |         | Called as the pointer is let go: the drag is done, where it ended.                                                                                                                                             |
| `options.onCancel` | `(from: T) => void`                |         | Called when the drag ends without being let go: the browser took the pointer, or `cancel` was called.                                                                                                          |
| `options.disabled` | `boolean`                          | `false` | Whether no drag starts. `false` unless given; one already running goes on.                                                                                                                                     |

Returns `UseDragResult`.

```ts
interface UseDragOptions<T>
```

What `useDrag` takes.

| Member     | Type                               | Default | Description                                                                                                                                                                                                    |
| ---------- | ---------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onStart`  | `(start: DragStart) => T \| false` |         | Called as the pointer goes down on the handle: what it returns comes with every move, as `from`, so a drag measures what it starts from once, a width or a box's rect. Return `false` to let this press go by. |
| `onMove`   | `(move: DragMove<T>) => void`      |         | Called as the pointer moves, while a drag runs.                                                                                                                                                                |
| `onEnd`    | `(move: DragMove<T>) => void`      |         | Called as the pointer is let go: the drag is done, where it ended.                                                                                                                                             |
| `onCancel` | `(from: T) => void`                |         | Called when the drag ends without being let go: the browser took the pointer, or `cancel` was called.                                                                                                          |
| `disabled` | `boolean`                          |         | Whether no drag starts. `false` unless given; one already running goes on.                                                                                                                                     |

```ts
interface UseDragResult
```

What `useDrag` gives back: state, actions, then the prop getter.

| Member                      | Type                                                                                       | Default | Description                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isDragging` (required)     | `boolean`                                                                                  |         | Whether a drag is running: from the press to the release.                                                                                                             |
| `cancel` (required)         | `() => void`                                                                               |         | Ends a running drag as if the browser had taken the pointer: `onCancel` is called. The same function for the hook's life.                                             |
| `getHandleProps` (required) | `<Own extends object>( own?: Own, ) => Omit<Own, keyof DragHandleProps> & DragHandleProps` |         | The handle's pointer handlers, with yours merged in: both run, yours first. Give the handle `touch-action: none`, so a touch drags it rather than scrolling the page. |

```ts
interface DragStart
```

Where a drag starts: the pointer's position as it goes down, and the event.

| Member             | Type                         | Default | Description                                                          |
| ------------------ | ---------------------------- | ------- | -------------------------------------------------------------------- |
| `x` (required)     | `number`                     |         | The pointer's distance from the window's left edge, in pixels.       |
| `y` (required)     | `number`                     |         | The pointer's distance from the window's top edge, in pixels.        |
| `event` (required) | `ReactPointerEvent<Element>` |         | The `pointerdown` on the handle, whose default is already prevented. |

```ts
interface DragMove<T>
```

Where a drag has got to, from where it started.

| Member            | Type     | Default | Description                                                                                                                      |
| ----------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `x` (required)    | `number` |         | The pointer's distance from the window's left edge now, in pixels: for a value read off a box, as a share of its width.          |
| `y` (required)    | `number` |         | The pointer's distance from the window's top edge now, in pixels.                                                                |
| `dx` (required)   | `number` |         | How far the pointer has moved right since it went down, in pixels (left is negative): for a value moved by the drag, as a width. |
| `dy` (required)   | `number` |         | How far the pointer has moved down since it went down, in pixels (up is negative).                                               |
| `from` (required) | `T`      |         | What `onStart` returned: the value the drag started from, or the box it is measured against.                                     |

```ts
interface DragHandleProps
```

What `getHandleProps` sets on the handle, over the caller's own props.

| Member                            | Type                           | Default | Description |
| --------------------------------- | ------------------------------ | ------- | ----------- |
| `onPointerDown` (required)        | `PointerEventHandler<Element>` |         |             |
| `onPointerMove` (required)        | `PointerEventHandler<Element>` |         |             |
| `onPointerUp` (required)          | `PointerEventHandler<Element>` |         |             |
| `onPointerCancel` (required)      | `PointerEventHandler<Element>` |         |             |
| `onLostPointerCapture` (required) | `PointerEventHandler<Element>` |         |             |
