---
title: useIsClipped
summary: Whether a text runs past its box, measured again when the box or the
  text changes, for a hint that shows only when there is more to read.
order: 3
related: [Writing a hook, Tooltip, Cell renderers]
---

[//]: # 'written from use-is-clipped.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useIsClipped

Whether a text runs past its box: `isClipped`, and the `ref` for the
box. It measures and draws nothing: what a clipped text gets, a
tooltip with the rest of it say, is the caller's.

## Import

```tsx
import { useIsClipped } from '@bh/hooks';
```

## Examples

**A line that clips**

```tsx
import { useState } from 'react';
import { useIsClipped } from '@bh/hooks';

// The plain view useIsClipped drives: a box that clips its text, with no
// component of bh's. Its corner resizes it, as a column's edge would, and its
// `title` carries the whole text only while the box cuts it off.

const FIELD = 'rounded-8 border-gray-6 text-13/19 text-gray-12 border-1 px-12 py-6';

export function ALineThatClips() {
  const [text, setText] = useState('packages/web/hooks/src/use-is-clipped.ts');
  const { isClipped, ref } = useIsClipped(text);

  return (
    <div className="flex w-full flex-col items-start gap-12">
      <label className="text-12/17 text-gray-11 flex w-full max-w-400 flex-col gap-4">
        Its text
        <input className={FIELD} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <p
        ref={ref}
        title={isClipped ? text : undefined}
        className={`${FIELD} w-240 max-w-full min-w-64 resize-x overflow-hidden whitespace-nowrap`}
      >
        {text}
      </p>
      <p className="text-12/17 text-gray-11">
        {isClipped ? 'Clipped: hover the box for the rest.' : 'It fits.'}
      </p>
    </div>
  );
}
```

Drag the box's corner narrower, or type a longer text: the line under
it says when the text is clipped, and only then does the box's `title`
carry the rest. The `ref` goes on the box that clips, the element with
`overflow: hidden`, not on the text inside it.

[`TextColumn`](../../table/docs/cell-renderers.md)'s cells are built on it: a cell
whose text is clipped draws a [Tooltip](../../ui/src/library/overlays/components/tooltip/tooltip.md)
with the whole of it, and a cell whose text fits draws none.

## Rules

- Its server value is `false`, since a server lays nothing out. In a
  browser the box is measured as it mounts, before the browser paints.
- It measures again when the box changes size, when `text` changes and
  when a webfont finishes loading, and on no other render, so a table
  that scrolls reads no layout.
- A text is clipped when it runs more than a pixel past its box,
  sideways or down: rounding alone can put a text that fits a pixel
  over. A paragraph cut off by `line-clamp` counts as well as one line.
- One `ResizeObserver` watches every box on the page. It starts with
  the first box and ends with the last; a browser without one measures
  on mount and on a new `text` only.
- `ref` is the same function for the hook's life. A box swapped for
  another is measured as it arrives, and while there is no box,
  `isClipped` is `false`.

## Reference

```ts
useIsClipped(text: string): UseIsClippedResult
```

Whether a text overflows its box: `isClipped`, and the `ref` for the box.

It measures the box when it mounts, before the browser paints, and again
when the box changes size, when `text` changes, and when a webfont loads.
Nothing is read on any other render, so a table's scroll reads no layout.

| Parameter         | Type     | Default | Description                                                                                                        |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `text` (required) | `string` |         | What the box shows: a new one is measured again, since it can change the overflow without changing the box's size. |

Returns `UseIsClippedResult`.

```ts
interface UseIsClippedResult
```

What `useIsClipped` gives back: its state, then the ref for the box it measures.

| Member                 | Type                   | Default | Description                                                                                                                          |
| ---------------------- | ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `isClipped` (required) | `boolean`              |         | Whether the text runs past its box, sideways or down. `false` on a server, until the box is measured, and while there is no box.     |
| `ref` (required)       | `RefCallback<Element>` |         | For the box that clips the text: the element with `overflow: hidden`, not the text inside it. The same function for the hook's life. |
