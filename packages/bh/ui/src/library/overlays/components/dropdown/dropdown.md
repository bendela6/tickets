---
title: Dropdown
summary: A trigger of your choosing and the panel it opens, with the open state
  kept for you.
related: [Popover, Menu, Button]
---

[//]: # 'written from dropdown.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Dropdown

A trigger of your choosing and the panel it opens, with the open state
kept for you.

It knows nothing about what the panel holds. As a function, `children`
receives `close`, so a body that picks something can shut the panel
without you holding its state.

## Import

```tsx
import { Dropdown } from '@bh/ui';
```

## Examples

The trigger can be any element that forwards its ref and passes on the
props it is given, as Button, Pill and Avatar do: the panel is placed
from the ref, and `aria-expanded` arrives through the props.

**Triggers**

```tsx
import { Avatar, Button, Dropdown, Pill } from '@bh/ui';

export function Triggers() {
  return (
    <div className="flex items-center gap-12">
      <Dropdown trigger={<Button chevron>Actions</Button>} padding="md">
        <p>Opened from a Button.</p>
      </Dropdown>
      <Dropdown trigger={<Pill tone="green" chevron label="Done" />} padding="md">
        <p>Opened from a Pill.</p>
      </Dropdown>
      <Dropdown trigger={<Avatar name="Robin Hale" />} padding="md">
        <p>Opened from an Avatar.</p>
      </Dropdown>
    </div>
  );
}
```

`padding` is `none` by default, for a list that draws its own rows to
the panel's edge; `sm` and `md` inset other content by 8 and 12 pixels.

**Padding**

```tsx
import { Button, Dropdown } from '@bh/ui';

const FRUITS = ['Apple', 'Pear', 'Plum'];

export function Padding() {
  return (
    <div className="flex gap-8">
      <Dropdown trigger={<Button chevron>none</Button>}>
        <ul className="w-160 p-4">
          {FRUITS.map((fruit) => {
            return (
              <li key={fruit} className="rounded-6 hover:bg-surface-inset px-8 py-6">
                {fruit}
              </li>
            );
          })}
        </ul>
      </Dropdown>
      <Dropdown trigger={<Button chevron>sm</Button>} padding="sm">
        <p>Inset by 8 pixels.</p>
      </Dropdown>
      <Dropdown trigger={<Button chevron>md</Button>} padding="md">
        <p>Inset by 12 pixels.</p>
      </Dropdown>
    </div>
  );
}
```

The body picks a colour, then calls `close`.

**Closing from the body**

```tsx
import { useState } from 'react';
import { Button, Dropdown } from '@bh/ui';

const COLOURS = ['Red', 'Green', 'Blue'];

export function ClosingFromTheBody() {
  const [colour, setColour] = useState('Red');
  return (
    <Dropdown trigger={<Button chevron>Colour: {colour}</Button>}>
      {(close) => {
        return (
          <div className="flex w-160 flex-col p-4">
            {COLOURS.map((option) => {
              return (
                <Button
                  key={option}
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setColour(option);
                    close();
                  }}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        );
      }}
    </Dropdown>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                               |
| ------------------ | -------------------------------------------------- |
| `Enter` or `Space` | On the trigger, opens or closes the panel.         |
| `Esc`              | Closes the panel and returns focus to the trigger. |

Opening moves focus into the panel: to its first control, or to the
panel itself. It is not modal: focus is not held in it, the page stays
usable, and a click outside closes it.

The panel has the `dialog` role. The trigger gets
`aria-haspopup="dialog"` and `aria-expanded`, and while the panel is
open, `aria-controls`. A disabled trigger does not open it.

## When not to use it

- For a list of commands, use [Menu](../menu/menu.md): its
  items are menu items, moved between with the arrow keys.
- To pick a value from options, use [Combobox](../../../inputs/components/combobox/combobox.md),
  with search or [without](../../../inputs/components/combobox/combobox.md#without-search).

## Props

| Prop                  | Type                                                     | Default | Description                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trigger` (required)  | `ReactElement`                                           |         | The element that opens the panel: a Button, a Pill, an Avatar, anything that forwards its ref.                                                                                                                   |
| `children` (required) | `ReactNode \| ((close: () => void) => ReactNode)`        |         | The panel body. As a function it receives `close`, so a body that commits a value (picking an option, running a command) can dismiss the panel without the caller lifting open state it otherwise does not need. |
| `defaultOpen`         | `boolean`                                                | `false` | Initial open state when uncontrolled.                                                                                                                                                                            |
| `open`                | `boolean`                                                |         | Controlled open state. Pass alongside `onOpenChange`.                                                                                                                                                            |
| `onOpenChange`        | `(open: boolean) => void`                                |         | Called with the new open state, whether `open` is given or not.                                                                                                                                                  |
| `side`                | `DropdownSide`: `'top'`, `'right'`, `'bottom'`, `'left'` |         | The side of the trigger the panel opens on; below it when unset.                                                                                                                                                 |
| `align`               | `DropdownAlign`: `'start'`, `'center'`, `'end'`          |         | How the panel lines up with the trigger along that side; at its start when unset.                                                                                                                                |
| `padding`             | `DropdownPadding`: `'none'`, `'sm'`, `'md'`              |         | How far the panel insets its content: `none`, `sm` 8 pixels or `md` 12.                                                                                                                                          |
| `className`           | `string`                                                 |         | Merged onto the panel, not the trigger — the trigger styles itself.                                                                                                                                              |
