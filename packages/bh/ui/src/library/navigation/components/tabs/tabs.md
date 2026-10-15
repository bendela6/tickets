---
title: Tabs
summary: 'A strip of items with one selected: tabs over a panel, or a group of toggles.'
related: [SegmentedControl, Tree]
---

[//]: # 'written from tabs.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Tabs

A strip of items with one selected: tabs over a panel, or a group of
toggles.

`variant` is only the look. `role` is what the strip means: `tablist`
says each item shows a panel, and `group` says the items change something
in place, like a view mode or a filter.

## Import

```tsx
import { Tabs } from '@bh/ui';
```

## Examples

Each item has a `value` and a `label`, and may have an `icon` and a
`badge`, drawn after the label in mono. `value` is the selected item's,
and `onChange` gets the clicked one's. The panel is yours to draw.
`underline`, the default, is a ruled row.

**Tabs and panel**

```tsx
import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'files', label: 'Files', badge: 12 },
  { value: 'settings', label: 'Settings' },
];

export function TabsAndPanel() {
  const [tab, setTab] = useState('overview');
  return (
    <div className="flex flex-col gap-12">
      <Tabs items={ITEMS} value={tab} onChange={setTab} label="Project" />
      <p className="text-13/19 text-gray-11">The {tab} panel.</p>
    </div>
  );
}
```

`pill` sets the items in a well, the selected one raised.

**Pill**

```tsx
import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function Pill() {
  const [value, setValue] = useState('week');
  return <Tabs variant="pill" items={ITEMS} value={value} onChange={setValue} label="Range" />;
}
```

`rail` stacks them, the selected one filled in its `tone`.

**Rail**

```tsx
import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'profile', label: 'Profile', icon: 'user' as const },
  { value: 'appearance', label: 'Appearance', icon: 'sun' as const },
  { value: 'files', label: 'Files', icon: 'folder' as const },
];

export function Rail() {
  const [value, setValue] = useState('profile');
  return (
    <Tabs
      variant="rail"
      items={ITEMS}
      value={value}
      onChange={setValue}
      label="Settings"
      className="w-192"
    />
  );
}
```

`segment` is a hairline group of values in mono, which sits on the page
without a well. With `previousValue`, it outlines the item the selection
just left; the other variants ignore it.

**Segment**

```tsx
import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
];

export function Segment() {
  const [value, setValue] = useState('1');
  const [previous, setPrevious] = useState<string>();
  return (
    <Tabs
      variant="segment"
      role="group"
      items={ITEMS}
      value={value}
      previousValue={previous}
      onChange={(next) => {
        setPrevious(value);
        setValue(next);
      }}
      label="Speed"
    />
  );
}
```

With `role="group"`, the items are toggle buttons rather than tabs, for a
choice that changes something in place. They look the same.

**Toggle group**

```tsx
import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'list', label: 'List', icon: 'list' as const },
  { value: 'columns', label: 'Columns', icon: 'columns' as const },
];

export function ToggleGroup() {
  const [view, setView] = useState('list');
  return (
    <Tabs variant="pill" role="group" items={ITEMS} value={view} onChange={setView} label="View" />
  );
}
```

`size` sets the padding and the type. Each variant pads to suit its
shape.

**Sizes**

```tsx
import { useState } from 'react';
import { Tabs } from '@bh/ui';

const ITEMS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function Sizes() {
  const [value, setValue] = useState('week');
  return (
    <div className="flex flex-col items-start gap-12">
      <Tabs
        variant="pill"
        size="sm"
        items={ITEMS}
        value={value}
        onChange={setValue}
        label="Small"
      />
      <Tabs
        variant="pill"
        size="md"
        items={ITEMS}
        value={value}
        onChange={setValue}
        label="Medium"
      />
      <Tabs
        variant="pill"
        size="lg"
        items={ITEMS}
        value={value}
        onChange={setValue}
        label="Large"
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                   |
| ------------------ | ------------------------------------------------------ |
| `Tab`              | Moves to the next item. Each item is its own tab stop. |
| `Enter` or `Space` | Selects the focused item.                              |

Each item is a `<button>`, and the arrow keys don't move between them.

With `role="tablist"`, the strip is a `tablist` of `tab`s, and the
selected one is `aria-selected`. Tabs draws no panel and sets no
`aria-controls`. With `role="group"`, it is a `group` of buttons, and the
selected one is `aria-pressed`; the item `previousValue` outlines is not.
`label` names the strip, and `id` and `aria-describedby` land on it,
for a form field's label and help to point at.

`disabled` dims every item and takes it out of the tab order.
`readOnly` keeps each item's tab stop and sets `aria-disabled` on it,
since ARIA allows no `aria-readonly` on a tab or a button, and a click
changes nothing. A form's `tabs` field draws a strip of pills as a
`group`, each option's `count` as its badge.

## When not to use it

- For a setting in a form, use
  [SegmentedControl](../../../inputs/components/segmented-control/segmented-control.md): a
  `radiogroup` that takes the form controls' `size`, as a form's
  `segmented` field. Tabs are for a place to be: a list's statuses, or
  a panel.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default       | Description                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `variant`             | `TabsVariant`: `'underline'`, `'pill'`, `'rail'`, `'segment'`                                                                                                                                               | `'underline'` | The strip's shape: a ruled row, pills in a well, a vertical list, or a hairline group.                                                                       |
| `size`                | `TabsSize`: `'sm'`, `'md'`, `'lg'`                                                                                                                                                                          | `'md'`        | Padding and label size; each variant pads to suit its own shape.                                                                                             |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'`   | Which ramp the active item paints from. Defaults to `primary`.                                                                                               |
| `role`                | `TabsRole`: `'tablist'`, `'group'`                                                                                                                                                                          | `'tablist'`   | `tablist` for tabs that each show a panel; `group` for toggles that act in place.                                                                            |
| `items` (required)    | `{ value: string; label: ReactNode; icon?: IconName; badge?: ReactNode }[]`                                                                                                                                 |               | The items, in order: each a `value`, a `label`, and an optional `icon` and `badge`.                                                                          |
| `value` (required)    | `string`                                                                                                                                                                                                    |               | The selected item's `value`.                                                                                                                                 |
| `previousValue`       | `string`                                                                                                                                                                                                    |               | The item the selection just left, drawn outlined by `segment`.                                                                                               |
| `onChange` (required) | `(value: string) => void`                                                                                                                                                                                   |               | Called with an item's `value` when it is clicked.                                                                                                            |
| `label`               | `string`                                                                                                                                                                                                    |               | The strip's accessible name, as `aria-label`.                                                                                                                |
| `id`                  | `string`                                                                                                                                                                                                    |               | The strip's id, which a form field's label and help point at.                                                                                                |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |               | The ids of what describes the strip: a form field's help, or its problem.                                                                                    |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`       | Dims every item and takes it out of the tab order: none can be picked.                                                                                       |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`       | Keeps every item's tab stop, but a click changes nothing. Each item says so with `aria-disabled`, since ARIA allows no `aria-readonly` on a tab or a button. |
| `className`           | `string`                                                                                                                                                                                                    |               | Added to the strip's classes.                                                                                                                                |
