---
title: Stack
summary: Lays its children out in a column, with a gap between them.
related: [Row, Card]
---

[//]: # 'written from stack.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Stack

Lays its children out in a column, with a gap between them.

It is structure only: it takes no `tone` and paints no surface. For a
surface, put it in a [Card](../card/card.md).

## Import

```tsx
import { Stack } from '@bh/ui';
```

## Examples

`gap` counts in steps of 4 pixels: `gap={2}` is 8 pixels, and the default,
`4`, is 16.

**Gaps**

```tsx
import type { ReactNode } from 'react';
import { Stack } from '@bh/ui';

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-6 border-gray-6 bg-gray-1 text-13/19 text-gray-11 border-1 px-12 py-8">
      {children}
    </div>
  );
}

export function Gaps() {
  return (
    <div className="flex gap-32">
      <Stack gap={0}>
        <Box>gap 0</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
      <Stack gap={2}>
        <Box>gap 2</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
      <Stack gap={4}>
        <Box>gap 4</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
      <Stack gap={8}>
        <Box>gap 8</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Stack>
    </div>
  );
}
```

`align` places the children across the column. Unset, they stretch to its
width.

**Align**

```tsx
import type { ReactNode } from 'react';
import { Stack } from '@bh/ui';

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-6 border-gray-6 bg-gray-1 text-13/19 text-gray-11 border-1 px-12 py-8">
      {children}
    </div>
  );
}

export function Align() {
  return (
    <div className="flex gap-24">
      <Stack gap={2} align="start" className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>start</Box>
        <Box>Two</Box>
      </Stack>
      <Stack gap={2} align="center" className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>center</Box>
        <Box>Two</Box>
      </Stack>
      <Stack gap={2} align="end" className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>end</Box>
        <Box>Two</Box>
      </Stack>
      <Stack gap={2} className="border-gray-6 w-128 border-1 border-dashed p-8">
        <Box>unset</Box>
        <Box>Two</Box>
      </Stack>
    </div>
  );
}
```

## When not to use it

- For a row, use [Row](../row/row.md), which also centres its
  children by default.

## Props

| Prop        | Type                                                 | Default | Description                                                                          |
| ----------- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `gap`       | `Gap`: `0`, `1`, `2`, `3`, `4`, `6`, `8`             | `4`     | Space between the children, in steps of 4 pixels.                                    |
| `align`     | `Align`: `'start'`, `'center'`, `'end'`, `'stretch'` |         | Where the children sit across the column: a flex `align-items`. Unset, they stretch. |
| `className` | `string`                                             |         | Added to its own classes.                                                            |

Also every `<div>` attribute (`HTMLAttributes<HTMLDivElement>`), passed through.
