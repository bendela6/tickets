---
title: Pill
summary: 'A compact label for one fact: a status, a type, a count.'
related: [Button, StatusDot, ToggleChips, Dropdown]
---

[//]: # 'written from pill.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Pill

A compact label for one fact: a status, a type, a count.

`tone` carries the meaning and `variant` the weight, and a pill rests on
`neutral` and `subtle`. `subtle`, `solid` and `outline` paint from the
same steps as Button's; `text` and `tint` are Pill's own.

## Import

```tsx
import { Pill } from '@bh/ui';
```

## Examples

Tones and variants mean little alone, so they are shown together:
[Tones](../../../../../docs/foundations/tones.md) has what the shared variants spend. `text` is
the tone's text alone, and `tint` puts it on the tone at 15%.

Every combination of `Pill`'s `tone` and `variant`, with `label="Draft"`:

- `tone` (rows): `primary`, `secondary`, `success`, `warning`, `danger`, `neutral`
- `variant` (columns): `subtle`, `solid`, `outline`, `text`, `tint`

`size` sets the height, padding and type together: 16, 18, 22 and 28
pixels. An icon named from the registry is sized with it.

**Sizes**

```tsx
import { Pill } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Extra small" tone="blue" size="xs" icon="circle" />
      <Pill label="Small" tone="blue" size="sm" icon="circle" />
      <Pill label="Medium" tone="blue" size="md" icon="circle" />
      <Pill label="Large" tone="blue" size="lg" icon="circle" />
    </div>
  );
}
```

`round` reads as a tag or a count. `trailing` goes after the label, such
as a count.

**Shapes and counts**

```tsx
import { Pill } from '@bh/ui';

export function ShapesAndCounts() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Square" tone="purple" />
      <Pill label="Round" tone="purple" shape="round" />
      <Pill label="Apples" shape="round" trailing={<span>12</span>} />
    </div>
  );
}
```

`icon` takes a registry name, sized with the pill, or an element of your
own, such as an Icon that spins.

**Icons**

```tsx
import { Icon, Pill } from '@bh/ui';

export function Icons() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Draft" icon="circle" />
      <Pill label="Saving" tone="blue" icon={<Icon name="circle-half" animate="spin" />} />
      <Pill label="Saved" tone="success" icon="circle-check" />
    </div>
  );
}
```

`strikethrough` strikes the label through, for a value that no longer
applies.

**Struck through**

```tsx
import { Pill } from '@bh/ui';

export function StruckThrough() {
  return (
    <div className="flex items-center gap-8">
      <Pill label="Pears" strikethrough />
      <Pill label="Plums" />
    </div>
  );
}
```

Given an `onClick`, a pill is a `<button>`. `pressed` sets its
`aria-pressed` and changes nothing else, so show the state with `tone` or
`variant`. `disabled` works only on a pill with an `onClick`.

**Toggles**

```tsx
import { useState } from 'react';
import { Pill } from '@bh/ui';

const FRUITS = ['Apples', 'Pears', 'Plums'];

export function Toggles() {
  const [chosen, setChosen] = useState<string[]>(['Pears']);

  const toggle = (fruit: string) => {
    setChosen((held) => {
      return held.includes(fruit) ? held.filter((one) => one !== fruit) : [...held, fruit];
    });
  };

  return (
    <div className="flex items-center gap-8">
      {FRUITS.map((fruit) => {
        const on = chosen.includes(fruit);
        return (
          <Pill
            key={fruit}
            label={fruit}
            tone={on ? 'primary' : 'neutral'}
            variant={on ? 'solid' : 'subtle'}
            pressed={on}
            onClick={() => toggle(fruit)}
          />
        );
      })}
      <Pill label="Figs" disabled onClick={() => toggle('Figs')} />
    </div>
  );
}
```

`chevron` marks a pill that opens a menu or a popover. A pill forwards
its ref and passes its other props on, so a
[Dropdown](../../../overlays/components/dropdown/dropdown.md) can take one as its trigger.

**Opening a dropdown**

```tsx
import { Dropdown, Pill } from '@bh/ui';

export function OpeningADropdown() {
  return (
    <Dropdown trigger={<Pill label="Colour" tone="blue" chevron />} padding="md">
      <p className="text-13 text-gray-11">Red, green or blue.</p>
    </Dropdown>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                    |
| ------------------ | --------------------------------------- |
| `Enter` or `Space` | Activates a pill that has an `onClick`. |

Without `onClick`, a pill is a `<span>`, outside the tab order. With one,
it is a `<button type="button">`, and `disabled` is the button's own, so a
disabled pill leaves the tab order too.

## When not to use it

- For a few options a reader turns on and off, use
  [ToggleChips](../../../inputs/components/toggle-chips/toggle-chips.md): toggle pills in a
  labelled group, holding a value.

## Props

| Prop               | Type                                                                                                                                                                                                        | Default     | Description                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `label` (required) | `ReactNode`                                                                                                                                                                                                 |             | What the pill says.                                                                                 |
| `tone`             | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'neutral'` | Which ramp the variant paints from: a role, or a hue by name.                                       |
| `variant`          | `PillVariant`: `'subtle'`, `'solid'`, `'outline'`, `'text'`, `'tint'`                                                                                                                                       | `'subtle'`  | How much of the tone the pill spends.                                                               |
| `icon`             | `IconName \| ReactElement`                                                                                                                                                                                  |             | A leading glyph: a registry name, sized with the pill, or an element of your own.                   |
| `shape`            | `PillShape`: `'square'`, `'round'`                                                                                                                                                                          | `'square'`  | Corner treatment: `square` lines up with the controls around it, `round` reads as a tag or a count. |
| `size`             | `PillSize`: `'xs'`, `'sm'`, `'md'`, `'lg'`                                                                                                                                                                  | `'md'`      | Height, padding and type size, as one step: 16, 18, 22 and 28 pixels.                               |
| `trailing`         | `ReactNode`                                                                                                                                                                                                 |             | Drawn after the label, such as a count.                                                             |
| `chevron`          | `boolean`                                                                                                                                                                                                   | `false`     | Adds a trailing chevron, for a pill that opens a menu or a popover.                                 |
| `strikethrough`    | `boolean`                                                                                                                                                                                                   |             | Strikes the label through, for a value that no longer applies.                                      |
| `onClick`          | `MouseEventHandler<HTMLElement>`                                                                                                                                                                            |             | Makes the pill a `<button>`. Without it, the pill is a `<span>`.                                    |
| `pressed`          | `boolean`                                                                                                                                                                                                   |             | With `onClick`, sets `aria-pressed`, for a pill that toggles.                                       |
| `disabled`         | `boolean`                                                                                                                                                                                                   |             | With `onClick`, disables the button and dims it. A pill without `onClick` ignores it.               |
| `className`        | `string`                                                                                                                                                                                                    |             | Added to the pill's own classes.                                                                    |
| `ref`              | `Ref<HTMLElement>`                                                                                                                                                                                          |             | Forwarded to the element it renders.                                                                |

Also every element attribute (`HTMLAttributes<HTMLElement>`), passed through.
