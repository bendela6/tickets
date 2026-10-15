---
title: useElementSize
summary: An element's width and height, measured before it paints and again
  whenever it changes size, for a chart or a layout drawn to the room it has.
order: 3
related: [Writing a hook]
---

[//]: # 'written from use-element-size.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useElementSize

An element's width and height, measured before it paints and again
whenever it changes size: `width`, `height`, and the `ref` for the
element. What is drawn at that size is the caller's.

## Import

```tsx
import { useElementSize } from '@bh/hooks';
```

## Examples

**A box that knows its width**

```tsx
import { useElementSize } from '@bh/hooks';

// A box the reader resizes from its corner, which draws as many bars as fit
// its width and says its size: a plain div, with no component of bh's.

const BAR = 24;
const GAP = 8;

export function ABoxThatKnowsItsWidth() {
  const { width = 0, height = 0, ref } = useElementSize<HTMLDivElement>();
  const bars = Math.max(0, Math.floor((width + GAP) / (BAR + GAP)));
  return (
    <div
      ref={ref}
      className="border-gray-6 rounded-8 flex h-120 w-320 min-w-120 resize flex-col justify-between overflow-hidden border-1 p-12"
    >
      <span className="text-12/17 text-gray-11 font-mono tabular-nums">
        {Math.round(width)} × {Math.round(height)}
      </span>
      <div className="flex items-end gap-8">
        {Array.from({ length: bars }, (_, index) => {
          return (
            <span
              key={index}
              className="bg-indigo-9 rounded-3 w-24 shrink-0"
              style={{ height: 12 + ((index * 7) % 5) * 8 }}
            />
          );
        })}
      </div>
    </div>
  );
}
```

Drag the box's corner: it says its size as it changes, and draws as
many bars as fit across it. The size is the content box's, inside the
padding, as a chart wants it; `box: 'border-box'` measures out to the
border's outer edge instead.

`width` and `height` are `undefined` until there is an element to
measure, so a default where they are destructured gives a number to
draw with: `const { width = 0, ref } = useElementSize()`.

## Rules

- **Its server value is no size**: `undefined`, since a server lays
  nothing out. In a browser the element is measured as it mounts,
  before it first paints, so nothing shows at the wrong size first.
- **It follows the element** with a `ResizeObserver`, one for each
  element measured; a browser without one measures on mount and not
  again.
- **`ref` is a callback ref**, the same function for the hook's life
  while `box` is: an element that mounts later, or is swapped for
  another, is measured as it arrives, and while there is none the size
  is `undefined` again.
- **A measurement that comes out the same** changes nothing, so a
  resize that leaves the box as it was renders nothing new.
- **Sizes are as laid out**, in fractions of a pixel where the layout
  has them: round where a whole number is drawn.
- **Cleaning up**: the observer is disconnected when the element goes,
  or the component.

## Reference

```ts
useElementSize<T extends Element = HTMLElement>(options?: UseElementSizeOptions): UseElementSizeResult<T>
```

An element's width and height, measured as it mounts and again whenever it
changes size: a chart drawn to its container's width, a panel that lays out
by the room it has. It draws nothing, and wires nothing but the ref.

Its server value is no size: `width` and `height` are `undefined` until the
element is measured, in the browser, before it first paints. Destructure
with a default for a number to draw with: `const { width = 0, ref } =
useElementSize()`.

| Parameter     | Type                                           | Default         | Description                                                                                               |
| ------------- | ---------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `options`     | `UseElementSizeOptions`                        | `{}`            |                                                                                                           |
| `options.box` | `MeasuredBox`: `'content-box'`, `'border-box'` | `'content-box'` | The box measured: `content-box`, inside the padding, unless `border-box`, out to the border's outer edge. |

Returns `UseElementSizeResult<T>`.

```ts
interface UseElementSizeOptions
```

What `useElementSize` takes. Every option is optional: `useElementSize()`.

| Member | Type                                           | Default | Description                                                                                               |
| ------ | ---------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `box`  | `MeasuredBox`: `'content-box'`, `'border-box'` |         | The box measured: `content-box`, inside the padding, unless `border-box`, out to the border's outer edge. |

```ts
interface UseElementSizeResult<T extends Element>
```

What `useElementSize` gives back: the size, then the ref.

| Member              | Type             | Default | Description                                                                                                               |
| ------------------- | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `width` (required)  | `number`         |         | The box's width in pixels, as laid out; `undefined` until the element is measured, on a server, and while there is none.  |
| `height` (required) | `number`         |         | The box's height in pixels, as laid out; `undefined` until the element is measured, on a server, and while there is none. |
| `ref` (required)    | `RefCallback<T>` |         | Goes on the element to measure. The same function for the hook's life, while `box` is the same.                           |

```ts
type MeasuredBox = 'content-box' | 'border-box';
```

Which of an element's boxes is measured.

One of `'content-box'`, `'border-box'`.
