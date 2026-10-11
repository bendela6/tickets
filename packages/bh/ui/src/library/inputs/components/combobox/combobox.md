---
title: Combobox
summary: One choice from a list with a search box, shown as plain text.
related: [Select, MultiCombobox, UserPicker]
---

[//]: # 'written from combobox.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Combobox

One choice from a list with a search box.

`value` is `string | null`, since a single choice can always be empty.
There is no clear button: a value is changed by picking another. The
field shows the chosen label as plain text, with a dot before it when the
option has a `color`.

## Import

```tsx
import { Combobox } from '@bh/ui';
```

## Examples

Opening it puts the focus in the search box. Typing keeps the options
whose label contains the text, ignoring case, and a count says how many
of the whole are left.

**Searching**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  'Amsterdam',
  'Berlin',
  'Dublin',
  'Lisbon',
  'Madrid',
  'Oslo',
  'Paris',
  'Prague',
  'Rome',
  'Vienna',
  'Warsaw',
  'Zurich',
].map((city) => ({ value: city.toLowerCase(), label: city }));

export function Searching() {
  const id = useId();
  const [city, setCity] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>City</FieldLabel>
      <Combobox
        id={id}
        options={CITIES}
        value={city}
        onChange={setCity}
        placeholder="Choose a city"
      />
    </div>
  );
}
```

`searchable={false}` drops the search box, for a short, fixed set. The
list takes the focus instead, and the keys stay the same.

**Without search**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const REPEATS: Option[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function WithoutSearch() {
  const id = useId();
  const [repeat, setRepeat] = useState<string | null>('weekly');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Repeat</FieldLabel>
      <Combobox id={id} searchable={false} options={REPEATS} value={repeat} onChange={setRepeat} />
    </div>
  );
}
```

An option's `color` puts a dot before the label on the field, and draws
the option as a pill in the list.

**Coloured options**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function ColouredOptions() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('plum');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Fruit</FieldLabel>
      <Combobox id={id} options={FRUITS} value={fruit} onChange={setFruit} />
    </div>
  );
}
```

`size` steps the height, padding, radius and type together: 30, 38 and 46
pixels.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type ControlSize, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'rome', label: 'Rome' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [city, setCity] = useState<string | null>('oslo');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <Combobox
              id={`${id}-${size}`}
              size={size}
              options={CITIES}
              value={city}
              onChange={setCity}
              className="flex-1"
            />
          </div>
        );
      })}
    </div>
  );
}
```

`disabled` dims the field and takes it out of the tab order. `readOnly`
keeps the tab stop and the value at full contrast, and refuses to open.

**Disabled and read only**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'rome', label: 'Rome' },
];

export function DisabledAndReadOnly() {
  const id = useId();
  const [city, setCity] = useState<string | null>('lisbon');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <Combobox id={`${id}-disabled`} disabled options={CITIES} value={city} onChange={setCity} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <Combobox
          id={`${id}-read-only`}
          readOnly
          options={CITIES}
          value={city}
          onChange={setCity}
        />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                      | Does                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `Enter` or `Space`       | On the field, opens the list.                                                 |
| `ArrowDown` or `ArrowUp` | Moves the cursor to the next or previous option, stepping over disabled ones. |
| `Enter`                  | In the list, picks the option under the cursor and closes it.                 |
| `Escape`                 | Closes the list.                                                              |

The field is a plain `button`, named by what it shows, the chosen label or
the placeholder, unless a `<label htmlFor>` with its `id` names it. In the
open list, the search box is a `searchbox` whose `aria-activedescendant`
points at the option under the cursor in the `listbox`; with
`searchable={false}`, the listbox points at it itself.

`readOnly` sets `aria-disabled` rather than `disabled`, so the field keeps
its tab stop.

## When not to use it

- For a short list that needs no search, use [Select](../select/select.md).
- For several values, use [MultiCombobox](../multi-combobox/multi-combobox.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The choices, in the order the list shows them.                                                                                                                                       |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Select…'` | Shown on the field while `value` is `null`.                                                                                                                                          |
| `searchable`          | `boolean`                                                                                                                                                                                                   | `true`      | Whether the open list offers a search box. Default true. Turn it off for a short fixed set — over three options a search field is noise, and it costs a keystroke to reach the list. |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                  |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.        |
| `value` (required)    | `string \| null`                                                                                                                                                                                            |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                           |
| `onChange` (required) | `(value: string \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |             | The new value — and, second, the event that produced it where one exists.                                                                                                            |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |             | The role or scale it is coloured from.                                                                                                                                               |
| `disabled`            | `boolean`                                                                                                                                                                                                   |             | Not applicable: removed from the tab order and from form submission.                                                                                                                 |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |             | Not editable, but still focusable and still submitted.                                                                                                                               |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                                  |
