---
title: IconPicker
summary: Picks one icon from a grid you can search.
related: [Icon, ColorPicker, Combobox]
---

[//]: # 'written from icon-picker.doc.yaml by pnpm docs:sync; edit that file, not this one'

# IconPicker

Picks one icon from a grid you can search.

`value` is an icon's name, or `null`. The field shows the glyph and its
name: the drawing says more than `circle-dashed` does, and the name is
what you search by.

## Import

```tsx
import { IconPicker } from '@bh/ui';
```

## Examples

The grid offers every icon in the registry, eight to a row. Typing filters
it by name; when nothing matches, it says so and names the query.

**Choosing an icon**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, IconPicker } from '@bh/ui';

export function ChoosingAnIcon() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>('folder');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Icon</FieldLabel>
      <IconPicker id={id} value={icon} onChange={setIcon} />
    </div>
  );
}
```

`icons` narrows the set on offer, in the order given.

**A few icons**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, IconPicker } from '@bh/ui';

export function AFewIcons() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Icon</FieldLabel>
      <IconPicker
        id={id}
        icons={['folder', 'file', 'terminal', 'calendar', 'tag']}
        value={icon}
        onChange={setIcon}
      />
    </div>
  );
}
```

`size` steps the field's height, padding, radius and type together: 30,
38 and 46 pixels.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, IconPicker, type ControlSize } from '@bh/ui';

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>('calendar');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <IconPicker id={`${id}-${size}`} size={size} value={icon} onChange={setIcon} />
          </div>
        );
      })}
    </div>
  );
}
```

`disabled` dims the field and takes it out of the tab order. `readOnly`
keeps the tab stop and the value at full contrast, drops the chevron, and
refuses to open.

**Disabled and read only**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, IconPicker } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [icon, setIcon] = useState<string | null>('tag');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <IconPicker id={`${id}-disabled`} disabled value={icon} onChange={setIcon} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <IconPicker id={`${id}-read-only`} readOnly value={icon} onChange={setIcon} />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                         | Does                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Enter` or `Space`          | On the field, opens the grid, with the focus in its search box.                                      |
| `ArrowUp` or `ArrowDown`    | Moves the cursor one row up or down, from the search box or the grid.                                |
| `ArrowLeft` or `ArrowRight` | In the grid, moves the cursor one icon back or forward. In the search box, they move the text caret. |
| `Enter`                     | In the grid, picks the icon under the cursor and closes it.                                          |
| `Escape`                    | Closes the grid.                                                                                     |

The field is a `button` with `role="combobox"` and
`aria-haspopup="dialog"`; name it with a `<label htmlFor>` and `id`. The
grid is a `grid` named by `label`, "Icons" by default, in rows of eight.
Each cell is a button named by its icon's name, and `aria-selected` marks
the chosen one. In the search box, focus stays put and the box points at
the cell under the cursor with `aria-activedescendant`; in the grid,
focus moves with the cursor.
`readOnly` sets `aria-disabled`, and `tone="danger"` sets `aria-invalid`.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default            | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Choose an icon'` | Shown on the field while no icon is chosen.                                                                                                                                   |
| `label`               | `string`                                                                                                                                                                                                    | `'Icons'`          | The accessible name of the icon grid.                                                                                                                                         |
| `icons`               | `IconName[]`                                                                                                                                                                                                | `ICON_NAMES`       | Restrict and order the offered set. Defaults to the whole registry.                                                                                                           |
| `id`                  | `string`                                                                                                                                                                                                    |                    | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |                    | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string \| null`                                                                                                                                                                                            |                    | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |                    | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`             | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |                    | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |                    | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |                    | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |                    | Added to the control's own classes.                                                                                                                                           |
