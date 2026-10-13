---
title: Figures
summary: 'A list of figures, a row each: what it is, a note on what it counts,
  and how much.'
related: [Meter, Card, SectionHeader]
---

[//]: # 'written from figures.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Figures

A list of figures, a row each: what it is, a note on what it counts, and
how much.

`Figures` holds the rows, a hairline between them, and `Figure` is one
row. `Num` sets a number inside running text, like a Meter's caption, in
the same figures.

## Import

```tsx
import { Figure, Figures, Num } from '@bh/ui';
```

## Examples

A `Figure` has a `label` at the left, a `value` at the right in mono, and
an optional `note` between them in quieter type. The label and the value
never shrink; the note truncates when the row is short of room, with the
whole of it as its tooltip. A row reads at half a grid's width, where a
column of stacked label-over-value stats would cut its own numbers.

**A list of figures**

```tsx
import { Figure, Figures } from '@bh/ui';

export function AListOfFigures() {
  return (
    <div className="w-360">
      <Figures>
        <Figure label="Images" note="12 of 30 in use · 1.1 GB reclaimable" value="4.2 GB" />
        <Figure label="Build cache" note="214 layers" value="2.8 GB" />
        <Figure label="Volumes" note="none: every service mounts a folder" value="0 B" />
      </Figures>
    </div>
  );
}
```

`title` puts a caption over the rows, drawn by
[SectionHeader](../section-header/section-header.md).

**Captioned columns**

```tsx
import { Figure, Figures } from '@bh/ui';

export function CaptionedColumns() {
  return (
    <div className="grid w-480 grid-cols-2 gap-16">
      <Figures title="Most CPU">
        <Figure label="web" value="12%" />
        <Figure label="search" value="4.1%" />
        <Figure label="mail" value="0.3%" />
      </Figures>
      <Figures title="Most memory">
        <Figure label="search" value="1.4 GB" />
        <Figure label="web" value="512 MB" />
        <Figure label="mail" value="96 MB" />
      </Figures>
    </div>
  );
}
```

`Num` is a number in running text, in mono and the page's strongest grey,
so it stands out of a grey caption.

**Numbers in a caption**

```tsx
import { Num } from '@bh/ui';

export function NumbersInACaption() {
  return (
    <p className="text-11/15 text-gray-11 w-360">
      <Num>6.1 GB</Num> used of <Num>16 GB</Num> · <Num>9.4 GB</Num> available
    </p>
  );
}
```

## Keyboard and accessibility

The rows are plain text, read in order: the label, the note, the value.
The caption is a `div`, not a heading.

## Props

### Figures

| Prop                  | Type        | Default | Description                                              |
| --------------------- | ----------- | ------- | -------------------------------------------------------- |
| `title`               | `ReactNode` |         | A caption over the rows, in a SectionHeader's uppercase. |
| `children` (required) | `ReactNode` |         | The rows: Figures, as a rule.                            |

### Figure

| Prop               | Type        | Default | Description                                                                                                                                                 |
| ------------------ | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label` (required) | `ReactNode` |         | What the figure is, at the left. It never shrinks.                                                                                                          |
| `note`             | `string`    |         | What it counts, between the label and the value, in quieter type. The one part that truncates when the row is short of room; the whole note is its tooltip. |
| `value` (required) | `ReactNode` |         | How much, at the right, in mono. It never shrinks.                                                                                                          |

### Num

| Prop                  | Type        | Default | Description                                     |
| --------------------- | ----------- | ------- | ----------------------------------------------- |
| `children` (required) | `ReactNode` |         | The number, as it is written: "6.1 GB", "1.20". |
