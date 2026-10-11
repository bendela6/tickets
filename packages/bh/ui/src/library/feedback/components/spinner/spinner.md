---
title: Spinner
summary: A mark that moves while something loads.
related: [Progress, Icon, Button]
---

[//]: # 'written from spinner.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Spinner

A mark that moves while something loads.

It is an [Icon](../../../primitives/components/icon/icon.md) that moves, so it takes
Icon's sizes and tones. With no `tone`, it takes the colour of the text
around it.

## Import

```tsx
import { Spinner } from '@bh/ui';
```

## Examples

`arc`, the default, is a turning sweep. `dashed` is a quieter turning
ring, for a refresh the reader didn't ask for. `pulse` doesn't turn: it
fades a dot, for something live, where turning would suggest work that
finishes.

Every combination of `Spinner`'s `tone` and `variant`:

- `tone` (rows): `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`
- `variant` (columns): `arc`, `dashed`, `pulse`

`size` is a rung of Icon's ladder: 8, 10, 12, 14, 16, 20 and 28 pixels,
`md` (14) by default.

**Sizes**

```tsx
import { Spinner } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex items-center gap-16">
      <Spinner size="xs" tone="primary" />
      <Spinner size="md" tone="primary" />
      <Spinner size="xl" tone="primary" />
      <Spinner size="2xl" tone="primary" />
    </div>
  );
}
```

With no `tone`, a spinner takes the colour of the text it sits in.

**In the text colour**

```tsx
import { Spinner } from '@bh/ui';

export function InTheTextColour() {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-13/19 text-gray-11 flex items-center gap-6">
        <Spinner />
        Checking for updates
      </p>
      <p className="text-13/19 text-indigo-11 flex items-center gap-6">
        <Spinner variant="dashed" />
        Refreshing
      </p>
    </div>
  );
}
```

## Keyboard and accessibility

A spinner is an `img` named by `label`, `Loading` unless you say what is
loading. An empty `label` hides it from assistive tech. It is not a live
region, so nothing is announced when it appears.

## When not to use it

- To show how far along something is, use
  [Progress](../progress/progress.md).
- For a button that is working, give the [Button](../../../primitives/components/button/button.md)
  `loading`, which adds the spinner itself.

## Props

| Prop        | Type                                                                                                                                                                                                        | Default     | Description                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `variant`   | `SpinnerVariant`: `'arc'`, `'dashed'`, `'pulse'`                                                                                                                                                            | `'arc'`     | Which mark: a spinning arc, a spinning dashed ring, or a fading dot.          |
| `size`      | `IconSize`: `'xs'`, `'md'`, `'lg'`, `'sm'`, `'2xs'`, `'xl'`, `'2xl'`                                                                                                                                        | `'md'`      | A rung of Icon's ladder, 8 to 28 pixels.                                      |
| `tone`      | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |             | Which ramp it paints from. Unset, it takes the colour of the text around it.  |
| `label`     | `string`                                                                                                                                                                                                    | `'Loading'` | What a screen reader announces. An empty string hides it from assistive tech. |
| `className` | `string`                                                                                                                                                                                                    |             | Added to the SVG's classes.                                                   |
