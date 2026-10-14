---
title: Tooltip
summary: A short hint that shows when its trigger is hovered or focused.
related: [Button, Popover]
---

[//]: # 'written from tooltip.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Tooltip

A short hint that shows when its trigger is hovered or focused.

Put a `TooltipProvider` near the app's root: it gives every tooltip
under it one delay. A Tooltip outside one brings its own.

A [Button](../../../primitives/components/button/button.md) shows its `label` as a
tooltip itself, with no Tooltip around it: an icon-only button that way
is named and hinted by one prop.

## Import

```tsx
import { Tooltip, TooltipProvider } from '@bh/ui';
```

## Examples

Its content can be more than words: here each hint carries its
shortcut.

**Shortcuts**

```tsx
import { Button, Tooltip } from '@bh/ui';

const ACTIONS = [
  ['Copy', '⌘C'],
  ['Paste', '⌘V'],
  ['Undo', '⌘Z'],
] as const;

export function Shortcuts() {
  return (
    <div className="flex gap-4">
      {ACTIONS.map(([name, keys]) => {
        return (
          <Tooltip
            key={name}
            content={
              <>
                {name} <span className="text-gray-8 font-mono">{keys}</span>
              </>
            }
          >
            <Button variant="ghost">{name}</Button>
          </Tooltip>
        );
      })}
    </div>
  );
}
```

`side` picks the side of the trigger it shows on: `top` by default.

**Sides**

```tsx
import { Button, Tooltip } from '@bh/ui';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

export function Sides() {
  return (
    <div className="flex gap-8">
      {SIDES.map((side) => {
        return (
          <Tooltip key={side} content={`On the ${side}`} side={side}>
            <Button>{side}</Button>
          </Tooltip>
        );
      })}
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| `Tab`              | Focusing the trigger shows its tooltip at once; moving focus away hides it. |
| `Esc`              | Hides the tooltip.                                                          |
| `Enter` or `Space` | Activates the trigger, and hides the tooltip.                               |

The tooltip has the `tooltip` role, and while it shows, the trigger is
`aria-describedby` it. It describes its trigger and does not name it,
so an icon-only trigger still needs an `aria-label`.

The trigger is `children` itself, through Radix's `asChild`: one
element that takes a ref and focus, like a Button.

## When not to use it

For content with buttons or fields in it, use
[Popover](../popover/popover.md): a tooltip hides when its
trigger loses focus.

## Props

### Tooltip

| Prop                  | Type                                                                               | Default | Description                                                         |
| --------------------- | ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `content` (required)  | `ReactNode`                                                                        |         | What the tooltip says.                                              |
| `children` (required) | `ReactNode`                                                                        |         | The trigger: one element that takes a ref and focus, like a Button. |
| `side`                | `'top' \| 'right' \| 'bottom' \| 'left'`: `'top'`, `'right'`, `'bottom'`, `'left'` | `'top'` | The side of the trigger it shows on.                                |
| `className`           | `string`                                                                           |         | Classes merged onto the tooltip.                                    |

### TooltipProvider

It sets the delay for every tooltip under it: a hovered trigger shows
its tooltip after 300 milliseconds, and moving on to the next trigger
shows the next at once. A Tooltip outside one makes its own, with the
same delay, but shares it with no other.

| Prop                  | Type        | Default | Description                                   |
| --------------------- | ----------- | ------- | --------------------------------------------- |
| `children` (required) | `ReactNode` |         | The app, or the part of it that has tooltips. |

```tsx
import type { ReactNode } from 'react';
import { TooltipProvider } from '@bh/ui';

export function Providers({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}
```
