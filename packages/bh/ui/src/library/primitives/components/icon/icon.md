---
title: Icon
summary: Draws one glyph from the icon registry, in the colour of the text around it.
related: [Button, Spinner, IconPicker]
---

[//]: # 'written from icon.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Icon

Draws one glyph from the icon registry, in the colour of the text around
it.

Every glyph draws in `currentColor` until `tone` sets a colour. A glyph's
name says its shape (`circle-half`, `arrow-up-right`), not what it is used
for.

## Import

```tsx
import { Icon } from '@bh/ui';
```

## Examples

Every `name` in the registry. `ICON_NAMES` lists them, in this order.

**Registry**

```tsx
import { Icon, ICON_NAMES } from '@bh/ui';

export function Registry() {
  return (
    <div className="flex flex-wrap gap-16">
      {ICON_NAMES.map((name) => {
        return (
          <div key={name} className="text-gray-11 flex w-80 flex-col items-center gap-6">
            <Icon name={name} size="lg" />
            <span className="text-10 text-gray-11 font-mono">{name}</span>
          </div>
        );
      })}
    </div>
  );
}
```

`size` sets the width and height together, on a ladder of 8, 10, 12, 14,
16, 20 and 28 pixels that `ICON_SIZES` holds. The default is `md`, 14.

**Sizes**

```tsx
import { Icon } from '@bh/ui';

export function Sizes() {
  return (
    <div className="text-gray-12 flex items-center gap-12">
      <Icon name="folder" size="2xs" />
      <Icon name="folder" size="xs" />
      <Icon name="folder" size="sm" />
      <Icon name="folder" size="md" />
      <Icon name="folder" size="lg" />
      <Icon name="folder" size="xl" />
      <Icon name="folder" size="2xl" />
    </div>
  );
}
```

Unset, `tone` leaves the glyph in the colour of its text. Set, the glyph
draws in step 11 of that tone's scale.

**Tones**

```tsx
import { Icon } from '@bh/ui';

export function Tones() {
  return (
    <div className="flex flex-col gap-8">
      <span className="text-13 text-gray-11 flex items-center gap-6">
        <Icon name="file" />
        report.pdf
      </span>
      <div className="flex items-center gap-12">
        <Icon name="circle-check" tone="success" />
        <Icon name="triangle-alert" tone="warning" />
        <Icon name="circle-x" tone="danger" />
        <Icon name="circle-info" tone="blue" />
      </div>
    </div>
  );
}
```

`animate` spins or pulses a glyph. No glyph moves without it.

**Motion**

```tsx
import { Icon } from '@bh/ui';

export function Motion() {
  return (
    <div className="flex items-center gap-16">
      <Icon name="circle-half" tone="blue" size="lg" animate="spin" />
      <Icon name="diamond" tone="orange" size="lg" animate="pulse" />
    </div>
  );
}
```

`label` makes the glyph an image with that name, for an icon that stands
for something on its own.

**Labelled**

```tsx
import { Icon } from '@bh/ui';

export function Labelled() {
  return (
    <div className="text-13 text-gray-12 flex items-center gap-8">
      <Icon name="circle-check" tone="success" label="Saved" />
      notes.txt
    </div>
  );
}
```

## Keyboard and accessibility

Without `label`, the `<svg>` is `aria-hidden`. With one, it is
`role="img"`, named by `label`. An icon-only button takes its name from
its own `aria-label`: see [Button](../button/button.md).

## When not to use it

- For something loading, use [Spinner](../../../feedback/components/spinner/spinner.md): an
  icon that moves, with a label for screen readers, `Loading` by default.

## Props

| Prop              | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Default | Description                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `name` (required) | `IconName`: `'columns'`, `'filter'`, `'search'`, `'link'`, `'circle'`, `'circle-half'`, `'circle-dot'`, `'circle-dashed'`, `'circle-check'`, `'circle-x'`, `'circle-info'`, `'diamond'`, `'square'`, `'dot'`, `'arc'`, `'triangle-alert'`, `'chevron-up'`, `'chevron-down'`, `'chevron-left'`, `'chevron-right'`, `'arrow-up'`, `'arrow-down'`, `'arrow-up-right'`, `'arrow-up-down'`, `'plus'`, `'x'`, `'check'`, `'minus'`, `'maximize'`, `'minimize'`, `'copy'`, `'pencil'`, `'trash'`, `'refresh'`, `'grip'`, `'ellipsis'`, `'eye'`, `'rows'`, `'rows-compact'`, `'folder'`, `'file'`, `'terminal'`, `'sliders'`, `'calendar'`, `'clock'`, `'tag'`, `'user'`, `'sun'`, `'moon'`, `'monitor'`, `'list'`, `'quote'` |         | Which glyph: a key of the registry, named for its shape.                                        |
| `size`            | `IconSize`: `'xs'`, `'md'`, `'lg'`, `'sm'`, `'2xs'`, `'xl'`, `'2xl'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `'md'`  | Width and height together, on the glyph ladder: 8, 10, 12, 14, 16, 20 and 28 pixels.            |
| `tone`            | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |         | Draws the glyph in step 11 of a tone's scale. Unset, it takes the colour of the text around it. |
| `animate`         | `'spin' \| 'pulse'`: `'spin'`, `'pulse'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         | Spins or pulses the glyph. No glyph moves without it.                                           |
| `label`           | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         | Names the glyph to assistive tech, as an image. Without it, the glyph is hidden from them.      |
| `className`       | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         | Added to the SVG's classes.                                                                     |
