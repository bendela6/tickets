---
title: Combobox
summary: One choice from a list, with a search box or without, shown as plain text.
related: [MultiCombobox, UserPicker, SegmentedControl, RadioGroup]
---

[//]: # 'written from combobox.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Combobox

One choice from a list: with a search box for a long list, or without one,
as a select, for a short one.

`value` is `string | null`, since a single choice can always be empty.
There is no clear button: a value is changed by picking another. The
field shows the chosen label as plain text, never a chip, with a dot
before it when the option has a `color`, because the colour is data.

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

`groupOf` says which group an option is in, and `groups` names the groups
in the order the list shows them. Each group gets a heading, and a group
with no options gets none, so a search that empties a group takes its
heading too. An option whose group isn't in `groups` isn't in the list,
though the field still shows it when it's the value.

**Grouped options**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option, type OptionGroup } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'barcelona', label: 'Barcelona' },
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'madrid', label: 'Madrid' },
  { value: 'milan', label: 'Milan' },
  { value: 'naples', label: 'Naples' },
  { value: 'porto', label: 'Porto' },
  { value: 'rome', label: 'Rome' },
  { value: 'seville', label: 'Seville' },
];

const COUNTRY: Record<string, string> = {
  milan: 'it',
  naples: 'it',
  rome: 'it',
  lisbon: 'pt',
  porto: 'pt',
  barcelona: 'es',
  madrid: 'es',
  seville: 'es',
};

const COUNTRIES: OptionGroup[] = [
  { key: 'it', label: 'Italy' },
  { key: 'pt', label: 'Portugal' },
  { key: 'es', label: 'Spain' },
];

export function GroupedOptions() {
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
        groupOf={(option) => COUNTRY[option.value] ?? ''}
        groups={COUNTRIES}
      />
    </div>
  );
}
```

A `disabled` option's `disabledReason` says why it can't be picked. The
list prints it under the greyed option, so the reader doesn't have to
guess.

**Disabled with a reason**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  {
    value: 'oslo',
    label: 'Oslo',
    disabled: true,
    disabledReason: "We don't ship outside the EU yet.",
  },
  { value: 'rome', label: 'Rome' },
  { value: 'vienna', label: 'Vienna' },
  {
    value: 'zurich',
    label: 'Zurich',
    disabled: true,
    disabledReason: "We don't ship outside the EU yet.",
  },
];

export function DisabledWithAReason() {
  const id = useId();
  const [city, setCity] = useState<string | null>('rome');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Ship to</FieldLabel>
      <Combobox id={id} options={CITIES} value={city} onChange={setCity} />
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
keeps the tab stop and the value at full contrast, drops the chevron, and
refuses to open.

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

There is no `invalid` prop: `tone="danger"` colours the field and sets
`aria-invalid`. Here it holds until a city is picked.
[Tones](../../../../../docs/foundations/tones.md) has what a tone does to a field.

**Danger**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option } from '@bh/ui';

const CITIES: Option[] = [
  { value: 'lisbon', label: 'Lisbon' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'rome', label: 'Rome' },
];

export function Danger() {
  const id = useId();
  const [city, setCity] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id} required>
        City
      </FieldLabel>
      <Combobox
        id={id}
        tone={city === null ? 'danger' : undefined}
        options={CITIES}
        value={city}
        onChange={setCity}
        placeholder="Choose a city"
      />
    </div>
  );
}
```

## Without search

`searchable={false}` makes it a select, for a short, fixed set: over a
few options a search box is noise, and it costs a keystroke to reach the
list. The list opens at the field's width, takes the focus itself, and
puts the cursor on the chosen option, so Enter straight away keeps the
value. The arrows open it as well as Enter and Space, and typing jumps to
the first option whose label starts with what was typed, as on a native
select. Typing on the closed field opens the list there.

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

Groups and disabled reasons are the same list's, so they work as they do
with search. Here, typing "b" goes to Blueberry: Blackberry can't be
picked, so typing steps over it as the arrows do.

**Grouped without search**

```tsx
import { useId, useState } from 'react';
import { Combobox, FieldLabel, type Option, type OptionGroup } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'lemon', label: 'Lemon' },
  { value: 'lime', label: 'Lime' },
  {
    value: 'blackberry',
    label: 'Blackberry',
    disabled: true,
    disabledReason: 'Out of season until June.',
  },
  { value: 'blueberry', label: 'Blueberry' },
  { value: 'raspberry', label: 'Raspberry' },
  { value: 'peach', label: 'Peach' },
  {
    value: 'plum',
    label: 'Plum',
    disabled: true,
    disabledReason: 'Sold out. More comes in on Friday.',
  },
];

const KIND: Record<string, string> = {
  lemon: 'citrus',
  lime: 'citrus',
  blackberry: 'berries',
  blueberry: 'berries',
  raspberry: 'berries',
  peach: 'stone',
  plum: 'stone',
};

const KINDS: OptionGroup[] = [
  { key: 'citrus', label: 'Citrus' },
  { key: 'berries', label: 'Berries' },
  { key: 'stone', label: 'Stone fruit' },
];

export function GroupedWithoutSearch() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('lemon');
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Fruit</FieldLabel>
      <Combobox
        id={id}
        searchable={false}
        options={FRUITS}
        value={fruit}
        onChange={setFruit}
        groupOf={(option) => KIND[option.value] ?? ''}
        groups={KINDS}
      />
    </div>
  );
}
```

With no visible label to point at it, such as a filter under a column
header, `aria-label` names the field.

**Without a label**

```tsx
import { useState } from 'react';
import { Combobox, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function WithoutALabel() {
  const [fruit, setFruit] = useState<string | null>('lime');
  return (
    <Combobox
      aria-label="Fruit"
      searchable={false}
      options={FRUITS}
      value={fruit}
      onChange={setFruit}
      className="w-256"
    />
  );
}
```

## Keyboard and accessibility

| Key                      | Does                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Enter` or `Space`       | On the field, opens the list.                                                                                                                                                                                            |
| `ArrowDown` or `ArrowUp` | Without search, on the field, opens the list too. In the list, moves the cursor to the next or previous option, stepping over disabled ones and from one group into the next.                                            |
| `Home` or `End`          | In the list, moves the cursor to the first or last option that can be picked. In the search box they move the cursor, not the caret.                                                                                     |
| `Enter`                  | In the list, picks the option under the cursor and closes it.                                                                                                                                                            |
| `Space`                  | Without search, in the list, picks the option under the cursor, as Enter does. In the middle of typing a label, it is part of the label.                                                                                 |
| `A–Z` or `0–9`           | Without search, moves the cursor to the first option whose label starts with what was typed, and the same letter again moves on to the next. A pause of a second starts over. On the closed field, opens the list there. |
| `Escape`                 | Closes the list.                                                                                                                                                                                                         |

With a search box, the field is a plain `button`, named by what it shows,
the chosen label or the placeholder, unless a `<label htmlFor>` with its
`id` names it. In the open list, the search box is a `searchbox` whose
`aria-activedescendant` points at the option under the cursor in the
`listbox`.

Without search, the field is a `button` with `role="combobox"` and
`aria-haspopup="listbox"`, and `aria-expanded` says whether the list is
open. A combobox isn't named by what it shows: name it with a
`<label htmlFor>` and `id`, or with `aria-label` where no visible label
points at it. The listbox takes the focus, and its own
`aria-activedescendant` points at the option under the cursor.

`aria-selected` marks the chosen option. With `groups`, each group is a
`group` that its heading names, so a screen reader says which group the
cursor has moved into. A disabled option's `disabledReason` is its
description, through `aria-describedby`. The cursor steps over disabled
options, so a screen reader comes to the reason when it reads through
the list, not as the cursor moves.

`readOnly` sets `aria-disabled` rather than `disabled`, so the field keeps
its tab stop.

## When not to use it

- To show a few short options at once, use
  [SegmentedControl](../segmented-control/segmented-control.md) or
  [RadioGroup](../radio-group/radio-group.md).
- For several values, use [MultiCombobox](../multi-combobox/multi-combobox.md).
- To pick a person, use [UserPicker](../user-picker/user-picker.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The choices, in the order the list shows them.                                                                                                                                                                                                                                                                       |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Select…'` | Shown on the field while `value` is `null`.                                                                                                                                                                                                                                                                          |
| `searchable`          | `boolean`                                                                                                                                                                                                   | `true`      | Whether the open list offers a search box. Default true. Turn it off for a short fixed set — over three options a search field is noise, and it costs a keystroke to reach the list. Without it the field is a select: a `combobox` the arrows open, and typing jumps to the option that starts with what was typed. |
| `groupOf`             | `(option: Option) => string`                                                                                                                                                                                |             | Which group an option is in: the `key` of one of `groups`. With both set, the list shows a heading over each group, in the order of `groups`, and leaves out a group with no options. An option whose group isn't in `groups` isn't shown.                                                                           |
| `groups`              | `OptionGroup[]`                                                                                                                                                                                             |             | The groups' headings, in the order the list shows them. Used with `groupOf`.                                                                                                                                                                                                                                         |
| `aria-label`          | `string`                                                                                                                                                                                                    |             | The accessible name, for a control with no visible label to point at it — a filter under a column header, where the header is the only caption. A control that has a `<label htmlFor>` should use that instead.                                                                                                      |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                                                                                                                  |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                                                                                                                        |
| `value` (required)    | `string \| null`                                                                                                                                                                                            |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                                                                                                                           |
| `onChange` (required) | `(value: string \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |             | The new value — and, second, the event that produced it where one exists.                                                                                                                                                                                                                                            |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                                                                                                                |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |             | The role or scale it is coloured from.                                                                                                                                                                                                                                                                               |
| `disabled`            | `boolean`                                                                                                                                                                                                   |             | Not applicable: removed from the tab order and from form submission.                                                                                                                                                                                                                                                 |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |             | Not editable, but still focusable and still submitted.                                                                                                                                                                                                                                                               |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                                                                                                                                                                  |

```ts
interface Option
```

One option vocabulary for every control that offers a choice.

`color` is honoured by the controls that draw a swatch and ignored by the
ones with nowhere to paint one. `icon` reads the same way: drawn by the
controls with room for a glyph beside the label, ignored by the ones without.
So does `description`, drawn only where there is room for a line under the
label, which is RadioGroup today. On the shared vocabulary rather than a
RadioGroup option of its own, because a second option type is what this one
replaced, and because a form's `radio` field passes its options straight
through: one type is what lets a stored config carry the line too.

| Member             | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Default | Description                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required) | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         | What `onChange` reports when this option is picked.                                                                                                                                                                                                                                                                                         |
| `label` (required) | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         | What the option shows.                                                                                                                                                                                                                                                                                                                      |
| `disabled`         | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |         | Shown, but neither the cursor nor a click can pick it.                                                                                                                                                                                                                                                                                      |
| `disabledReason`   | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         | Why a `disabled` option can't be chosen, e.g. "The workflow doesn't go from Done to To do." The list controls (`Combobox`, with search or without, and `MultiCombobox`) print it under the greyed row and make it the row's description, so a screen reader reads it out; the others ignore it. Ignored on an option that isn't `disabled`. |
| `color`            | `Hue`: `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |         | A scale for the controls that draw a swatch beside the label.                                                                                                                                                                                                                                                                               |
| `icon`             | `IconName`: `'columns'`, `'filter'`, `'search'`, `'link'`, `'circle'`, `'circle-half'`, `'circle-dot'`, `'circle-dashed'`, `'circle-check'`, `'circle-x'`, `'circle-info'`, `'diamond'`, `'square'`, `'dot'`, `'arc'`, `'triangle-alert'`, `'chevron-up'`, `'chevron-down'`, `'chevron-left'`, `'chevron-right'`, `'arrow-up'`, `'arrow-down'`, `'arrow-up-right'`, `'arrow-up-down'`, `'plus'`, `'x'`, `'check'`, `'minus'`, `'maximize'`, `'minimize'`, `'copy'`, `'pencil'`, `'trash'`, `'refresh'`, `'grip'`, `'ellipsis'`, `'eye'`, `'rows'`, `'rows-compact'`, `'folder'`, `'file'`, `'terminal'`, `'sliders'`, `'calendar'`, `'clock'`, `'tag'`, `'user'`, `'sun'`, `'moon'`, `'monitor'`, `'list'`, `'quote'` |         | A glyph before the label, for the controls with room for one.                                                                                                                                                                                                                                                                               |
| `description`      | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |         | A line under the label, saying what choosing it does: drawn by RadioGroup, ignored by the controls with no room for it.                                                                                                                                                                                                                     |

```ts
interface OptionGroup
```

A heading in a list of options. `groupOf` names each option's `key`; the
groups' order is the order the list shows them in.

| Member             | Type     | Default | Description                                                |
| ------------------ | -------- | ------- | ---------------------------------------------------------- |
| `key` (required)   | `string` |         | What `groupOf` returns for the options under this heading. |
| `label` (required) | `string` |         | The heading shown over them.                               |
