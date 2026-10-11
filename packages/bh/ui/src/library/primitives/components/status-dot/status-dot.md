---
title: StatusDot
summary: Shows whether something is running right now.
related: [Dot, Pill, Spinner]
---

[//]: # 'written from status-dot.doc.yaml by pnpm docs:sync; edit that file, not this one'

# StatusDot

Shows whether something is running right now.

It has two states, told apart by shape as well as colour: `active` is a
filled dot in `tone` that pulses, and `resting` a neutral hollow ring. The
state is also written out for screen readers.

## Import

```tsx
import { StatusDot } from '@bh/ui';
```

## Examples

`active` and `resting`, each beside the name of what it describes.

**States**

```tsx
import { StatusDot } from '@bh/ui';

export function States() {
  return (
    <div className="text-13 text-gray-12 flex flex-col gap-8">
      <span className="flex items-center gap-8">
        <StatusDot state="active" />
        Lisbon server
      </span>
      <span className="flex items-center gap-8">
        <StatusDot state="resting" />
        Porto server
      </span>
    </div>
  );
}
```

`tone` colours the active dot, `success` by default. A resting dot is
always neutral.

**Tones**

```tsx
import { StatusDot } from '@bh/ui';

export function Tones() {
  return (
    <div className="flex items-center gap-12">
      <StatusDot state="active" />
      <StatusDot state="active" tone="warning" />
      <StatusDot state="active" tone="danger" />
      <StatusDot state="active" tone="blue" />
      <StatusDot state="resting" tone="blue" />
    </div>
  );
}
```

`label` replaces the word a screen reader hears, `active` or `resting`,
with your own.

**Labels**

```tsx
import { StatusDot } from '@bh/ui';

export function Labels() {
  return (
    <div className="text-13 text-gray-12 flex flex-col gap-8">
      <span className="flex items-center gap-8">
        <StatusDot state="active" label="Uploading" />
        photo.jpg
      </span>
      <span className="flex items-center gap-8">
        <StatusDot state="resting" label="Paused" />
        video.mp4
      </span>
    </div>
  );
}
```

## Keyboard and accessibility

The dot itself is `aria-hidden`. Beside it, visually hidden text says
`label`, or the state's name when there is no `label`. The pulse runs only
when the reader's system allows motion.

## When not to use it

- For a state with more than two values, put a
  [Pill](../pill/pill.md) beside the dot.
- For colour alone, with nothing to say, use
  [Dot](../dot/dot.md).

## Props

| Prop               | Type                                                                                                                                                                                                        | Default     | Description                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `state` (required) | `StatusDotState`: `'active'`, `'resting'`                                                                                                                                                                   |             | `active` is a filled dot that pulses; `resting` is a hollow ring.       |
| `tone`             | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'success'` | Which ramp the active dot paints from. Resting always reads as neutral. |
| `label`            | `string`                                                                                                                                                                                                    |             | What a screen reader hears in place of the state's own name.            |
| `className`        | `string`                                                                                                                                                                                                    |             | Added to the wrapper's classes.                                         |
