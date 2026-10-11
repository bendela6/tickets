---
title: Progress
summary: A bar showing how far along something is, as a percentage.
related: [Spinner, SectionHeader]
---

[//]: # 'written from progress.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Progress

A bar showing how far along something is, as a percentage.

It takes a percent and a tone and draws them, and knows nothing of what
they measure: a caller counting something else, a budget or a limit,
works out the percent and picks the tone itself.

## Import

```tsx
import { Progress } from '@bh/ui';
```

## Examples

`value` is a percent, from 0 to 100. A value outside the range is clamped,
so 140 draws a full bar.

**Values**

```tsx
import { Progress } from '@bh/ui';

export function Values() {
  return (
    <div className="flex w-160 flex-col gap-12">
      <Progress value={0} aria-label="Not started" />
      <Progress value={42} aria-label="Under way" />
      <Progress value={100} aria-label="Done" />
      <Progress value={140} aria-label="Over the top" />
    </div>
  );
}
```

`size` sets the bar's height, 2, 4 or 6 pixels, and the size of its
figures.

**Sizes**

```tsx
import { Progress } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex w-160 flex-col gap-12">
      <Progress value={62} size="sm" aria-label="Small" />
      <Progress value={62} size="md" aria-label="Medium" />
      <Progress value={62} size="lg" aria-label="Large" />
    </div>
  );
}
```

`tone` colours the fill, `primary` by default. Progress has no thresholds
of its own: a caller that knows 90% is too much passes `danger`.

**Tones**

```tsx
import { Progress } from '@bh/ui';

export function Tones() {
  return (
    <div className="flex w-160 flex-col gap-12">
      <Progress value={78} tone="primary" aria-label="Primary" />
      <Progress value={78} tone="success" aria-label="Success" />
      <Progress value={78} tone="warning" aria-label="Warning" />
      <Progress value={78} tone="danger" aria-label="Danger" />
    </div>
  );
}
```

`label` puts a figure before the bar and `trailing` one after it, in mono.

**Figures**

```tsx
import { Progress } from '@bh/ui';

export function Figures() {
  return (
    <div className="flex w-192 flex-col gap-12">
      <Progress value={40} label="2/5" aria-label="Files uploaded" />
      <Progress value={90} tone="danger" trailing="90%" aria-label="Storage used" />
    </div>
  );
}
```

## Keyboard and accessibility

The bar is a `progressbar`, with `aria-valuemin` 0, `aria-valuemax` 100
and `aria-valuenow` the clamped value, so what is announced is what is
drawn. Name it with `aria-label`: a progress bar needs a name, and
`label` is a figure, not a name.

## When not to use it

- While something loads and there is no percent to show, use a
  [Spinner](../spinner/spinner.md).

## Props

| Prop               | Type                                                                                                                                                                                                        | Default     | Description                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `value` (required) | `number`                                                                                                                                                                                                    |             | Percent complete, 0–100. Values outside the range are clamped.                                          |
| `tone`             | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | Which ramp the fill paints from: a role, or a hue by name.                                              |
| `size`             | `ProgressSize`: `'sm'`, `'md'`, `'lg'`                                                                                                                                                                      | `'md'`      | The bar's height, and the size of the label and trailing text.                                          |
| `label`            | `ReactNode`                                                                                                                                                                                                 |             | A figure before the bar, in mono.                                                                       |
| `trailing`         | `ReactNode`                                                                                                                                                                                                 |             | A figure after the bar, in mono.                                                                        |
| `className`        | `string`                                                                                                                                                                                                    |             | Layout/spacing on the outer flex wrapper (label + track + trailing).                                    |
| `trackClassName`   | `string`                                                                                                                                                                                                    |             | Overrides the track's own sizing (e.g. `min-w-*`, `h-*`) — twMerge resolves conflicts with the default. |
| `aria-label`       | `string`                                                                                                                                                                                                    |             | What the bar measures, for a screen reader: a progress bar needs a name.                                |
