---
title: UserPicker
summary: Picks one person, or several, from a list you can search.
related: [Avatar, Combobox, MultiCombobox]
---

[//]: # 'written from user-picker.doc.yaml by pnpm docs:sync; edit that file, not this one'

# UserPicker

Picks one person, or several, from a list you can search.

`value` is a `string[]` of `Person` ids in both modes, so nobody is `[]`.
With nobody chosen, the field shows a dashed ring where an avatar would
be.

## Import

```tsx
import { UserPicker, type Person } from '@bh/ui';
```

## Examples

Picking a person closes the list. The search matches a person's `detail`
as well as their name, so a handle finds them too.

**One person**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor', detail: '@mira' },
  { id: 'tomas', name: 'Tomas Reyes', detail: '@tomas' },
  { id: 'lena', name: 'Lena Varga', detail: '@lena' },
  { id: 'owen', name: 'Owen Pryce', detail: '@owen' },
];

export function OnePerson() {
  const id = useId();
  const [owner, setOwner] = useState<string[]>([]);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Owner</FieldLabel>
      <UserPicker id={id} people={PEOPLE} value={owner} onChange={setOwner} />
    </div>
  );
}
```

With `multiple`, picking toggles a person and keeps the list open. The
field overlaps their avatars and counts them; past `maxAvatars`, 3 by
default, the rest show as `+N`.

**Several people**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor', detail: '@mira' },
  { id: 'tomas', name: 'Tomas Reyes', detail: '@tomas' },
  { id: 'lena', name: 'Lena Varga', detail: '@lena' },
  { id: 'owen', name: 'Owen Pryce', detail: '@owen' },
  { id: 'iris', name: 'Iris Holm', detail: '@iris' },
];

export function SeveralPeople() {
  const id = useId();
  const [readers, setReaders] = useState<string[]>(['mira', 'tomas', 'lena', 'owen']);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Readers</FieldLabel>
      <UserPicker id={id} multiple people={PEOPLE} value={readers} onChange={setReaders} />
    </div>
  );
}
```

A `disabled` person stays in the list, and neither the cursor nor a
click can pick them; their `disabledReason` says why, under the greyed
row.

**Disabled with a reason**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor', detail: '@mira' },
  {
    id: 'tomas',
    name: 'Tomas Reyes',
    detail: '@tomas',
    disabled: true,
    disabledReason: 'Away until Monday.',
  },
  { id: 'lena', name: 'Lena Varga', detail: '@lena' },
  { id: 'owen', name: 'Owen Pryce', detail: '@owen' },
];

export function DisabledWithAReason() {
  const id = useId();
  const [owner, setOwner] = useState<string[]>(['mira']);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Owner</FieldLabel>
      <UserPicker id={id} people={PEOPLE} value={owner} onChange={setOwner} />
    </div>
  );
}
```

`size` steps the field's height, padding, radius and type, and its avatars
with it.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, UserPicker, type ControlSize, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor' },
  { id: 'tomas', name: 'Tomas Reyes' },
  { id: 'lena', name: 'Lena Varga' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [owner, setOwner] = useState<string[]>(['lena']);
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <UserPicker
              id={`${id}-${size}`}
              size={size}
              people={PEOPLE}
              value={owner}
              onChange={setOwner}
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
import { FieldLabel, UserPicker, type Person } from '@bh/ui';

const PEOPLE: Person[] = [
  { id: 'mira', name: 'Mira Okafor' },
  { id: 'tomas', name: 'Tomas Reyes' },
  { id: 'lena', name: 'Lena Varga' },
];

export function DisabledAndReadOnly() {
  const id = useId();
  const [owner, setOwner] = useState<string[]>(['tomas']);
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <UserPicker
          id={`${id}-disabled`}
          disabled
          people={PEOPLE}
          value={owner}
          onChange={setOwner}
        />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <UserPicker
          id={`${id}-read-only`}
          readOnly
          people={PEOPLE}
          value={owner}
          onChange={setOwner}
        />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                      | Does                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Enter` or `Space`       | On the field, opens the list, with the focus in its search box.                                                                       |
| `ArrowDown` or `ArrowUp` | Moves the cursor to the next or previous person, stepping over one who can't be picked.                                               |
| `Home` or `End`          | Moves the cursor to the first or last person who can be picked.                                                                       |
| `Enter`                  | In the list, picks the person under the cursor. One person closes the list; with `multiple`, it toggles them and the list stays open. |
| `Escape`                 | Closes the list.                                                                                                                      |

The field is a `button` with `role="combobox"` and
`aria-haspopup="listbox"`; name it with a `<label htmlFor>` and `id`. The
list is a `listbox` named by `label`, "People" by default, and
`aria-multiselectable` with `multiple`. Focus stays in the search box,
which points at the list with `aria-controls` and at the person under
the cursor with `aria-activedescendant`, so a screen reader follows the
cursor, which opens on the first person chosen. A disabled person's
`disabledReason` is their row's description, through
`aria-describedby`. `readOnly` sets `aria-disabled`, and
`tone="danger"` sets `aria-invalid`.

The list is the one [Combobox](../combobox/combobox.md) opens, so its
keys, and the way a search is shown, are the same.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default        | Description                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `people` (required)   | `Person[]`                                                                                                                                                                                                  |                | Everyone who can be picked, in the order the list shows them.                                                                                                                       |
| `value` (required)    | `string[]`                                                                                                                                                                                                  |                | Always an array, even for a single picker. "Nobody" has exactly one spelling — `[]` — rather than being `null` here and `[]` there.                                                 |
| `onChange` (required) | `(value: string[]) => void`                                                                                                                                                                                 |                | The new list of chosen ids.                                                                                                                                                         |
| `multiple`            | `boolean`                                                                                                                                                                                                   | `false`        | One person, or several. Single closes on pick; multi stays open.                                                                                                                    |
| `maxAvatars`          | `number`                                                                                                                                                                                                    | `3`            | How many avatars before the rest collapse to `+N`.                                                                                                                                  |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Unassigned'` | Shown on the field while nobody is chosen.                                                                                                                                          |
| `prefix`              | `string`                                                                                                                                                                                                    |                | Words before the value on the field, in the muted tone, as a filter bar names a field inside its control: "Type:" in "Type: any". With one, the placeholder reads as a value would. |
| `label`               | `string`                                                                                                                                                                                                    | `'People'`     | The accessible name of the list of people.                                                                                                                                          |
| `id`                  | `string`                                                                                                                                                                                                    |                | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                 |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |                | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.       |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`         | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                               |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |                | The role or scale it is coloured from.                                                                                                                                              |
| `disabled`            | `boolean`                                                                                                                                                                                                   |                | Not applicable: removed from the tab order and from form submission.                                                                                                                |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |                | Not editable, but still focusable and still submitted.                                                                                                                              |
| `className`           | `string`                                                                                                                                                                                                    |                | Added to the control's own classes.                                                                                                                                                 |

```ts
interface Person
```

Someone a UserPicker offers.

| Member            | Type      | Default | Description                                                                                                                                    |
| ----------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (required)   | `string`  |         | What `value` holds for this person.                                                                                                            |
| `name` (required) | `string`  |         | Shown in the list, and on the field when only this person is chosen; the avatar takes its initials.                                            |
| `detail`          | `string`  |         | Secondary line in the list — a handle, a team, a role.                                                                                         |
| `disabled`        | `boolean` |         | Shown, but neither the cursor nor a click can pick them.                                                                                       |
| `disabledReason`  | `string`  |         | Why a `disabled` person can't be picked, e.g. "Away until Monday." The list prints it under the greyed row and makes it the row's description. |
