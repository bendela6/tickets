---
title: Popover
summary: A panel that floats beside the button that opens it.
related: [Dropdown, Menu, Tooltip]
---

[//]: # 'written from popover.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Popover

A panel that floats beside the button that opens it.

It is Radix's Popover in bh's surface. `PopoverContent` opens 6 pixels
below its trigger, aligned to its start, and keeps 8 pixels from the
window's edges. [Dropdown](../dropdown/dropdown.md) puts the parts
and the open state together for you.

## Import

```tsx
import { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger } from '@bh/ui';
```

## Examples

`PopoverContent` has no padding of its own, so give it a class.
`PopoverClose` closes it from a button inside.

**Small form**

```tsx
import { useState } from 'react';
import { Button, Input, Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@bh/ui';

export function SmallForm() {
  const [city, setCity] = useState('Lisbon');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button chevron>City: {city}</Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-256 flex-col gap-8 p-12">
        <label htmlFor="popover-city" className="text-12 text-gray-11">
          City
        </label>
        <Input id="popover-city" value={city} onChange={setCity} />
        <div className="flex justify-end">
          <PopoverClose asChild>
            <Button variant="solid" size="sm">
              Done
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

`side` and `align` on `PopoverContent` place it. Where there is no room
on its side, it moves to fit.

**Side and align**

```tsx
import { Button, Popover, PopoverContent, PopoverTrigger } from '@bh/ui';

export function SideAndAlign() {
  return (
    <div className="flex gap-8">
      <Popover>
        <PopoverTrigger asChild>
          <Button>Below</Button>
        </PopoverTrigger>
        <PopoverContent className="p-12">Below, at the start.</PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button>Above</Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="p-12">
          Above, centred.
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button>Right</Button>
        </PopoverTrigger>
        <PopoverContent side="right" className="p-12">
          To the right.
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

`PopoverAnchor` places the panel against another element than the
trigger: here, the whole row.

**Anchored elsewhere**

```tsx
import { Button, Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@bh/ui';

export function AnchoredElsewhere() {
  return (
    <Popover>
      <PopoverAnchor asChild>
        <div className="rounded-8 border-gray-6 flex w-320 items-center gap-8 border-1 py-4 pr-4 pl-12">
          <span className="text-13 flex-1">holiday.jpg</span>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              Details
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-320 p-12">2.4 MB, 1920 by 1080 pixels.</PopoverContent>
    </Popover>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                 |
| ------------------ | ---------------------------------------------------- |
| `Enter` or `Space` | On the trigger, opens or closes the popover.         |
| `Esc`              | Closes the popover and returns focus to the trigger. |

Opening moves focus into the panel: to its first control, or to the
panel itself. It is not modal: focus is not held in it, the page stays
usable, and a click outside closes it.

`PopoverContent` has the `dialog` role. The trigger gets
`aria-haspopup="dialog"` and `aria-expanded`, and while the popover is
open, `aria-controls`.

## When not to use it

- For a list of commands, use [Menu](../menu/menu.md).
- For a hint on hover or focus, use [Tooltip](../tooltip/tooltip.md).
- For a modal window, use [Dialog](../dialog/dialog.md).

## Props

All but `PopoverContent` are Radix's Popover parts as they are, so their
props are Radix's. `PopoverContent` takes Radix's too, with its own
defaults.

### Popover

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |

Also every element attribute (`PopoverProps`), passed through.

### PopoverTrigger

| Prop  | Type                     | Default | Description                  |
| ----- | ------------------------ | ------- | ---------------------------- |
| `ref` | `Ref<HTMLButtonElement>` |         | Forwarded to the `<button>`. |

Also every `<button>` attribute (`ButtonHTMLAttributes<HTMLButtonElement>`), passed through.

### PopoverAnchor

| Prop  | Type                  | Default | Description               |
| ----- | --------------------- | ------- | ------------------------- |
| `ref` | `Ref<HTMLDivElement>` |         | Forwarded to the `<div>`. |

Also every `<div>` attribute (`PopperAnchorProps<HTMLDivElement>`), passed through.

### PopoverContent

| Prop        | Type                  | Default | Description               |
| ----------- | --------------------- | ------- | ------------------------- |
| `className` | `string`              |         | Added to its own classes. |
| `children`  | `ReactNode`           |         |                           |
| `ref`       | `Ref<HTMLDivElement>` |         | Forwarded to the `<div>`. |

Also every `<div>` attribute (`PopperContentProps<HTMLDivElement>`), passed through.

### PopoverClose

| Prop  | Type                     | Default | Description                  |
| ----- | ------------------------ | ------- | ---------------------------- |
| `ref` | `Ref<HTMLButtonElement>` |         | Forwarded to the `<button>`. |

Also every `<button>` attribute (`ButtonHTMLAttributes<HTMLButtonElement>`), passed through.
