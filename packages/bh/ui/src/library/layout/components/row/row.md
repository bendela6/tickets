---
title: Row
summary: Lays its children out side by side, with a gap between them.
related: [Stack, Card, SectionHeader]
---

[//]: # 'written from row.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Row

Lays its children out side by side, with a gap between them.

Unlike [Stack](../stack/stack.md), it centres its children by
default, so a label, a control and a button in a row line up on their
middles. It paints nothing: it is a flex `div`.

## Import

```tsx
import { Row } from '@bh/ui';
```

## Examples

`gap` counts in steps of 4 pixels: `gap={2}` is 8 pixels, and the default,
`4`, is 16.

**Gaps**

```tsx
import type { ReactNode } from 'react';
import { Row } from '@bh/ui';

function Box({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-6 border-gray-6 bg-gray-1 text-13/19 text-gray-11 border-1 px-12 py-8">
      {children}
    </div>
  );
}

export function Gaps() {
  return (
    <div className="flex flex-col gap-16">
      <Row gap={0}>
        <Box>gap 0</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
      <Row gap={2}>
        <Box>gap 2</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
      <Row gap={4}>
        <Box>gap 4</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
      <Row gap={8}>
        <Box>gap 8</Box>
        <Box>Two</Box>
        <Box>Three</Box>
      </Row>
    </div>
  );
}
```

`justify` spreads the children along the row: to the `start`, the
`center` or the `end`, or `between`, which pushes the first and the last
to the ends.

**Justify**

```tsx
import { Button, Row } from '@bh/ui';

export function Justify() {
  return (
    <div className="flex w-384 flex-col gap-12">
      <Row justify="start" gap={2}>
        <Button size="sm">Save</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </Row>
      <Row justify="end" gap={2}>
        <Button size="sm">Save</Button>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
      </Row>
      <Row justify="between">
        <span className="text-13/19 text-gray-11">3 files</span>
        <Button size="sm">Upload</Button>
      </Row>
    </div>
  );
}
```

`align="baseline"` lines up the baselines of text in different sizes, such
as a figure and its label.

**Baseline**

```tsx
import { Row } from '@bh/ui';

export function Baseline() {
  return (
    <Row align="baseline" gap={2}>
      <span className="text-24 text-gray-12">42</span>
      <span className="text-13/19 text-gray-11">files shared</span>
    </Row>
  );
}
```

## When not to use it

- For a column, use [Stack](../stack/stack.md).

## Props

| Prop        | Type                                                                  | Default    | Description                                                      |
| ----------- | --------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `gap`       | `Gap`: `0`, `1`, `2`, `3`, `4`, `6`, `8`                              | `4`        | Space between the children, in steps of 4 pixels.                |
| `align`     | `RowAlign`: `'start'`, `'center'`, `'end'`, `'stretch'`, `'baseline'` | `'center'` | Where the children sit across the row: a flex `align-items`.     |
| `justify`   | `Justify`: `'start'`, `'center'`, `'end'`, `'between'`                |            | How the children spread along the row: a flex `justify-content`. |
| `className` | `string`                                                              |            | Added to its own classes.                                        |

Also every `<div>` attribute (`HTMLAttributes<HTMLDivElement>`), passed through.
