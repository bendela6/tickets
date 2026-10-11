---
title: Menu
summary: A list of commands that opens from a button.
related: [Button, Dropdown, Popover]
---

[//]: # 'written from menu.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Menu

A list of commands that opens from a button.

It is Radix's DropdownMenu in bh's look: the arrow keys move between the
items, a letter jumps to one, and choosing one runs its `onSelect` and
closes the menu.

## Import

```tsx
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@bh/ui';
```

## Examples

`shortcut` shows a key at the item's end. It only shows it: binding the
key is the app's to do.

**Shortcuts**

```tsx
import { useState } from 'react';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function Shortcuts() {
  const [chosen, setChosen] = useState('nothing yet');
  return (
    <div className="flex items-center gap-12">
      <Menu>
        <MenuTrigger asChild>
          <Button chevron>Edit</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem shortcut="⌘X" onSelect={() => setChosen('Cut')}>
            Cut
          </MenuItem>
          <MenuItem shortcut="⌘C" onSelect={() => setChosen('Copy')}>
            Copy
          </MenuItem>
          <MenuItem shortcut="⌘V" onSelect={() => setChosen('Paste')}>
            Paste
          </MenuItem>
        </MenuContent>
      </Menu>
      <span className="text-13 text-gray-11">Chose {chosen}</span>
    </div>
  );
}
```

`destructive` paints an item red, and a `MenuSeparator` sets it apart.

**Destructive**

```tsx
import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@bh/ui';

export function Destructive() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button chevron>File</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Rename</MenuItem>
        <MenuItem>Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem destructive>Delete</MenuItem>
      </MenuContent>
    </Menu>
  );
}
```

From an icon button, named with `aria-label`. A `disabled` item is
dimmed, and the arrow keys pass over it.

**Icon trigger**

```tsx
import { Button, Icon, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function IconTrigger() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" aria-label="More actions" className="w-36 p-0">
          <Icon name="ellipsis" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Open</MenuItem>
        <MenuItem>Download</MenuItem>
        <MenuItem disabled>Move</MenuItem>
      </MenuContent>
    </Menu>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `Enter` or `Space` | On the trigger, opens the menu on its first item. On an item, chooses it. |
| `↓`                | On the trigger, opens the menu. In it, moves to the next item.            |
| `↑`                | Moves to the previous item.                                               |
| `Home` or `End`    | Moves to the first or the last item.                                      |
| `Esc`              | Closes the menu and returns focus to the trigger.                         |

Typing a letter moves to the next item that starts with it.

`MenuContent` has the `menu` role, labelled by its trigger; each item is
a `menuitem`, and `MenuSeparator` a `separator`. The trigger gets
`aria-haspopup="menu"` and `aria-expanded`. While the menu is open, the
page behind is hidden from assistive technology and takes no pointer
events.

## When not to use it

For a panel of anything other than commands, a form or a picker, use
[Dropdown](../dropdown/dropdown.md) or
[Popover](../popover/popover.md).

## Props

`Menu` and `MenuTrigger` are Radix's DropdownMenu parts as they are, so
their props are Radix's.

### Menu

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |

Also every element attribute (`DropdownMenuProps`), passed through.

### MenuTrigger

| Prop  | Type                     | Default | Description                  |
| ----- | ------------------------ | ------- | ---------------------------- |
| `ref` | `Ref<HTMLButtonElement>` |         | Forwarded to the `<button>`. |

Also every `<button>` attribute (`ButtonHTMLAttributes<HTMLButtonElement>`), passed through.

### MenuContent

It opens 6 pixels from the trigger, aligned to its start, and is at
least 190 pixels wide.

| Prop        | Type                  | Default | Description               |
| ----------- | --------------------- | ------- | ------------------------- |
| `className` | `string`              |         | Added to its own classes. |
| `children`  | `ReactNode`           |         |                           |
| `ref`       | `Ref<HTMLDivElement>` |         | Forwarded to the `<div>`. |

Also every `<div>` attribute (`MenuContentImplProps<HTMLDivElement>`), passed through.

### MenuItem

| Prop          | Type                  | Default | Description                                                                    |
| ------------- | --------------------- | ------- | ------------------------------------------------------------------------------ |
| `shortcut`    | `ReactNode`           |         | A key shown at the item's end. It is only shown: the app binds the key itself. |
| `destructive` | `boolean`             |         | Paints the item red, for an action that destroys something.                    |
| `className`   | `string`              |         | Added to its own classes.                                                      |
| `children`    | `ReactNode`           |         |                                                                                |
| `ref`         | `Ref<HTMLDivElement>` |         | Forwarded to the `<div>`.                                                      |

Also every `<div>` attribute (`MenuItemImplProps<HTMLDivElement>`), passed through.

### MenuSeparator

| Prop        | Type     | Default | Description                   |
| ----------- | -------- | ------- | ----------------------------- |
| `className` | `string` |         | Classes merged onto the line. |
