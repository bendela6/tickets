---
title: ColorPicker
summary: Picks one of the eleven colour scales.
related: [Pill, IconPicker, Select]
---

[//]: # 'written from color-picker.doc.yaml by pnpm docs:sync; edit that file, not this one'

# ColorPicker

Picks one of the eleven colour scales.

There is no spectrum and no eyedropper: `value` is a scale's name, from
`red` to `gray`, or `null`. The field shows the scale's swatch and its
name. [Colours](../../../../../docs/foundations/colours.md#scales) has the scales.

## Import

```tsx
import { ColorPicker } from '@bh/ui';
```

## Examples

The swatches sit six to a row. The chosen one carries a dot inside it
rather than a border, which would mix with the swatch's own colour; the
ring is the keyboard's cursor.

**Choosing a colour**

```tsx
import { useId, useState } from 'react';
import { ColorPicker, FieldLabel } from '@bh/ui';

export function ChoosingAColour() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('teal');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Colour</FieldLabel>
      <ColorPicker id={id} value={colour} onChange={setColour} />
    </div>
  );
}
```

A scale's name is also a `tone`, so the colour picked can paint another
component. [Tones](../../../../../docs/foundations/tones.md) has what each component does with
one.

**As a tone**

```tsx
import { useId, useState } from 'react';
import { ColorPicker, FieldLabel, HUES, Pill } from '@bh/ui';

export function AsATone() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('purple');
  const tone = HUES.find((hue) => hue === colour) ?? 'gray';
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Label colour</FieldLabel>
      <ColorPicker id={id} value={colour} onChange={setColour} />
      <div className="flex gap-8 pt-6">
        <Pill tone={tone} label="Sample" />
        <Pill tone={tone} variant="solid" label="Sample" />
      </div>
    </div>
  );
}
```

`size` steps the field's height, padding, radius and type together: 30,
38 and 46 pixels.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { ColorPicker, FieldLabel, type ControlSize } from '@bh/ui';

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('blue');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <ColorPicker id={`${id}-${size}`} size={size} value={colour} onChange={setColour} />
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
import { ColorPicker, FieldLabel } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [colour, setColour] = useState<string | null>('orange');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <ColorPicker id={`${id}-disabled`} disabled value={colour} onChange={setColour} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <ColorPicker id={`${id}-read-only`} readOnly value={colour} onChange={setColour} />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                         | Does                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `Enter` or `Space`          | On the field, opens the grid. In the grid, picks the swatch under the cursor and closes it. |
| `ArrowLeft` or `ArrowRight` | Moves the cursor one swatch back or forward.                                                |
| `ArrowUp` or `ArrowDown`    | Moves the cursor one row up or down.                                                        |
| `Escape`                    | Closes the grid.                                                                            |

The grid opens with focus on the chosen swatch, and focus moves with the
cursor. The cursor stops at the first and last swatch rather than
wrapping.

The field is a `button` with `role="combobox"` and
`aria-haspopup="dialog"`; name it with a `<label htmlFor>` and `id`. The
grid is a `grid` named by `label`, "Colour" by default, in rows of six.
Each swatch is a
button named by its scale, capitalised, and `aria-selected` marks the
chosen one. `readOnly` sets `aria-disabled`, and `tone="danger"` sets
`aria-invalid`.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default             | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Choose a colour'` | Shown on the field while no colour is chosen.                                                                                                                                 |
| `label`               | `string`                                                                                                                                                                                                    | `'Colour'`          | Accessible name for the swatch grid.                                                                                                                                          |
| `id`                  | `string`                                                                                                                                                                                                    |                     | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |                     | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string \| null`                                                                                                                                                                                            |                     | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |                     | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`              | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |                     | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |                     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |                     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |                     | Added to the control's own classes.                                                                                                                                           |
