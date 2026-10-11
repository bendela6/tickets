---
title: Dot
summary: An 8-pixel disc in any CSS colour, for a colour known only at runtime.
related: [StatusDot, Pill, Icon]
---

[//]: # 'written from dot.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Dot

An 8-pixel disc in any CSS colour, for a colour known only at runtime.

`color` takes a raw CSS colour, not a tone name. It is set on a custom
property rather than a class, so a colour built at runtime still applies.
With no `color`, the dot is gray.

## Import

```tsx
import { Dot } from '@bh/ui';
```

## Examples

Any colour CSS reads: a token's variable, a hex, a `color-mix()`.

**Colours**

```tsx
import { Dot } from '@bh/ui';

const HUES = ['blue', 'green', 'orange', 'purple', 'teal'];

export function Colours() {
  return (
    <div className="flex items-center gap-12">
      {HUES.map((hue) => {
        return <Dot key={hue} color={`var(--color-${hue}-9)`} />;
      })}
      <Dot color="#e5484d" />
      <Dot color="color-mix(in oklab, var(--color-blue-9), var(--color-green-9))" />
    </div>
  );
}
```

`hollow` draws a gray ring with no fill, for an off state. It leaves
`color` out.

**Hollow**

```tsx
import { Dot } from '@bh/ui';

export function Hollow() {
  return (
    <div className="flex items-center gap-12">
      <Dot color="var(--color-blue-9)" />
      <Dot color="var(--color-blue-9)" hollow />
    </div>
  );
}
```

A dot is hidden from assistive tech, so what it stands for goes in the
text beside it.

**Beside text**

```tsx
import { Dot } from '@bh/ui';

const FRUITS = [
  { name: 'Apples', color: 'var(--color-green-9)' },
  { name: 'Oranges', color: 'var(--color-orange-9)' },
  { name: 'Plums', color: 'var(--color-purple-9)' },
];

export function BesideText() {
  return (
    <ul className="text-13 text-gray-12 flex flex-col gap-6">
      {FRUITS.map((fruit) => {
        return (
          <li key={fruit.name} className="flex items-center gap-8">
            <Dot color={fruit.color} />
            {fruit.name}
          </li>
        );
      })}
    </ul>
  );
}
```

## Keyboard and accessibility

A dot is always `aria-hidden`.

## When not to use it

- For a state a screen reader should hear, use
  [StatusDot](../status-dot/status-dot.md), which writes its state
  out.

## Props

| Prop        | Type      | Default | Description                                                                                            |
| ----------- | --------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `color`     | `string`  |         | The fill, as a raw CSS colour (`var(--color-blue-9)`, a `color-mix()` result, a hex), gray when unset. |
| `hollow`    | `boolean` |         | A gray ring in place of the fill, for an "off" state.                                                  |
| `className` | `string`  |         | Added to the dot's own classes.                                                                        |
