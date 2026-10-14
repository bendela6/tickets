---
title: MultiCombobox
summary: Several choices from a list with a search box, shown as chips.
related: [Combobox, TagInput, ToggleChips]
---

[//]: # 'written from multi-combobox.doc.yaml by pnpm docs:sync; edit that file, not this one'

# MultiCombobox

Several choices from a list with a search box.

`value` is a `string[]`, and nothing chosen is `[]`, never `null`. The
chosen options show on the field as chips, each with a button that
removes it.

## Import

```tsx
import { MultiCombobox } from '@bh/ui';
```

## Examples

Picking an option toggles it, and the list stays open for the next. The
list's footer selects every option that is not disabled, or clears them
all. A chip's × removes it without opening the list. An option's `icon`
leads its row in the list, as in
[Combobox](../combobox/combobox.md)'s.

**Picking several**

```tsx
import { useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
  { value: 'blueberry', label: 'Blueberry', color: 'blue' },
];

export function PickingSeveral() {
  const [fruits, setFruits] = useState<string[]>(['apple', 'lime']);
  return (
    <div className="w-320">
      <MultiCombobox placeholder="Fruits" options={FRUITS} value={fruits} onChange={setFruits} />
    </div>
  );
}
```

`maxChips`, 3 by default, caps the chips on the field. The rest collapse
into a `+N` chip, a button that opens the list.

**Overflow**

```tsx
import { useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'madrid', label: 'Madrid' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'paris', label: 'Paris' },
  { value: 'rome', label: 'Rome' },
  { value: 'vienna', label: 'Vienna' },
];

export function Overflow() {
  const [cities, setCities] = useState<string[]>(['lisbon', 'oslo', 'paris', 'rome', 'vienna']);
  return (
    <div className="w-320">
      <MultiCombobox
        placeholder="Cities"
        maxChips={2}
        options={CITIES}
        value={cities}
        onChange={setCities}
      />
    </div>
  );
}
```

For a list too long to load whole, `onSearchChange` hands you each
keystroke, and the list stops filtering `options` itself: they are taken
as the matches. While `loading`, it draws placeholder rows. `options` must
still hold the chosen values, or their chips have no label.

**Searching elsewhere**

```tsx
import { useEffect, useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

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
].map((city) => ({ value: city.toLowerCase(), label: city }));

export function SearchingElsewhere() {
  const [cities, setCities] = useState<string[]>(['oslo']);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Option[]>(CITIES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Stands in for a request to a server.
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase();
      setMatches(CITIES.filter((city) => city.label.toLowerCase().includes(needle)));
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // The chosen cities stay in `options`, so their chips keep a label.
  const chosen = CITIES.filter((city) => cities.includes(city.value) && !matches.includes(city));
  return (
    <div className="w-320">
      <MultiCombobox
        placeholder="Cities"
        options={[...chosen, ...matches]}
        value={cities}
        onChange={setCities}
        onSearchChange={setQuery}
        loading={loading}
      />
    </div>
  );
}
```

`size` steps the field's height, padding, radius and type, and its chips
with it.

**Sizes**

```tsx
import { useState } from 'react';
import { MultiCombobox, type ControlSize, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const [fruits, setFruits] = useState<string[]>(['apple', 'lime']);
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <MultiCombobox
            key={size}
            size={size}
            placeholder="Fruits"
            options={FRUITS}
            value={fruits}
            onChange={setFruits}
          />
        );
      })}
    </div>
  );
}
```

`disabled` and `readOnly` both drop the chips' remove buttons and keep the
list shut. `disabled` also dims the field and takes it out of the tab
order; `readOnly` keeps the tab stop and the value at full contrast.

**Disabled and read only**

```tsx
import { useState } from 'react';
import { MultiCombobox, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function DisabledAndReadOnly() {
  const [fruits, setFruits] = useState<string[]>(['apple', 'lime']);
  return (
    <div className="flex w-288 flex-col gap-12">
      <MultiCombobox
        disabled
        placeholder="Fruits"
        options={FRUITS}
        value={fruits}
        onChange={setFruits}
      />
      <MultiCombobox
        readOnly
        placeholder="Fruits"
        options={FRUITS}
        value={fruits}
        onChange={setFruits}
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                               | Does                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `Enter` or `Space` or `ArrowDown` | On the field, opens the list.                                                              |
| `ArrowDown` or `ArrowUp`          | In the list, moves the cursor to the next or previous option, stepping over disabled ones. |
| `Enter`                           | In the list, picks or unpicks the option under the cursor. The list stays open.            |
| `Escape`                          | Closes the list.                                                                           |
| `Enter` or `Space`                | On a chip's remove button, removes the chip without opening the list.                      |

Tab moves from the field to each chip's remove button in turn, then to
`+N`. Each remove button is named "Remove" and the chip's label.

The field is a `div` with `role="combobox"`, since a button may not hold
the chips' buttons. Its accessible name is its `placeholder`, given as
`aria-label`. `readOnly` sets `aria-readonly` and keeps the tab stop;
`disabled` sets `aria-disabled` and leaves the tab order.

## When not to use it

- For one value, use [Combobox](../combobox/combobox.md).
- For values that don't exist until someone types them, use
  [TagInput](../tag-input/tag-input.md).
- To show a few short options at once, use
  [ToggleChips](../toggle-chips/toggle-chips.md) or
  [CheckboxGroup](../checkbox-group/checkbox-group.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The choices, in the order the list shows them; with `onSearchChange`, the current matches.                                                                                                                                                                           |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Select…'` | Shown on the field while nothing is chosen, and the field's accessible name.                                                                                                                                                                                         |
| `maxChips`            | `number`                                                                                                                                                                                                    | `3`         | Max chips shown on the trigger before collapsing to +N.                                                                                                                                                                                                              |
| `onSearchChange`      | `(query: string) => void`                                                                                                                                                                                   |             | Search on the caller's side — a server, for a list too long to load whole. Each keystroke is reported and `options` are taken as the matches; see `ComboboxList.onQueryChange`. `options` must still hold the selected values, or their chips have no label to show. |
| `loading`             | `boolean`                                                                                                                                                                                                   |             | Options are in flight: the list draws skeleton rows rather than "nothing to pick".                                                                                                                                                                                   |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                                                                  |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                                                                        |
| `value` (required)    | `string[]`                                                                                                                                                                                                  |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                                                                           |
| `onChange` (required) | `(value: string[], event?: SyntheticEvent) => void`                                                                                                                                                         |             | The new value — and, second, the event that produced it where one exists.                                                                                                                                                                                            |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                                                                |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |             | The role or scale it is coloured from.                                                                                                                                                                                                                               |
| `disabled`            | `boolean`                                                                                                                                                                                                   |             | Not applicable: removed from the tab order and from form submission.                                                                                                                                                                                                 |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |             | Not editable, but still focusable and still submitted.                                                                                                                                                                                                               |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                                                                                                                  |
