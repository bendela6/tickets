---
title: Tones
summary: A component's tone takes a role or a scale by name; its variant decides
  how much of the tone it spends.
order: 2
related: [Colours, Button]
---

[//]: # 'written from tones.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Tones

A `tone` names a colour by what it means, `danger`, or by its scale, `red`.

The component picks the steps. `Tone` is the six roles and the eleven
scales, and `TONE_HUE` maps each to the scale it paints from: `danger` paints
from `red`, `primary` from `indigo`.

```ts
const TONE_HUE: Record<Tone, Hue>;
```

## A variant spends the tone

How much of the tone a component spends is its `variant`, and the steps
follow the ladder on [Colours](colours.md#steps):

| Variant   | Fill                         | Text       | Border             |
| --------- | ---------------------------- | ---------- | ------------------ |
| `solid`   | step 9, 10 on hover          | `contrast` | none               |
| `subtle`  | step 3, 4 on hover           | step 11    | none               |
| `outline` | `surface-raised`, 3 on hover | step 11    | step 7, 8 on hover |

Button and Pill share these three names, so `variant="solid"` means the
same everywhere. Each has a fourth of its own: Button's `ghost`, Pill's
`text`.

Every combination of `Button`'s `tone` and `variant`, with `children="Save"`:

- `tone` (rows): `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`
- `variant` (columns): `subtle`, `solid`, `outline`, `ghost`

## Danger on a field

A field with no tone rests in gray. Any tone it is given colours its fill
and border, and `danger` says more than colour: the field is marked
`aria-invalid`, so a screen reader announces it as invalid.

## In the app's own code

Tailwind only finds whole class names, and `bg-${scale}-3` is not one. The
components' classes reach the stylesheet because `@bh/ui` lists every one
it builds; the app's own are found only when written out whole. Take a
component with a `tone` where one fits; otherwise write the classes per
scale, and look the role up:

```ts
import { TONE_HUE, type Hue, type Tone } from '@bh/ui';

// Written whole, so Tailwind finds every one.
const MARK: Record<Hue, string> = {
  red: 'bg-red-3 text-red-11',
  orange: 'bg-orange-3 text-orange-11',
  yellow: 'bg-yellow-3 text-yellow-11',
  green: 'bg-green-3 text-green-11',
  teal: 'bg-teal-3 text-teal-11',
  cyan: 'bg-cyan-3 text-cyan-11',
  blue: 'bg-blue-3 text-blue-11',
  indigo: 'bg-indigo-3 text-indigo-11',
  purple: 'bg-purple-3 text-purple-11',
  pink: 'bg-pink-3 text-pink-11',
  gray: 'bg-gray-3 text-gray-11',
};

/** A mark's classes for a tone: a role resolves to its scale first. */
export function markClass(tone: Tone): string {
  return MARK[TONE_HUE[tone]];
}
```
