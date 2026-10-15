---
title: Instrument's bindings
summary: The inputs, layouts, wrappers and button @bh/ui registers, what each
  kind holds, and what its config takes.
order: 9
related: [The registry, Writing an input, FieldWrapper]
---

[//]: # 'written from bindings.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Instrument's bindings

The inputs, layouts, wrappers and button `@bh/ui` registers, what each kind of
field holds, and what its config takes.

## Import

```tsx
import { baseFilter, baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';
```

`baseInputs` and `baseLayouts` are a registry's `inputs` and `layouts`;
`FieldWrapper`, `RootWrapper` and `FormButton` its `field`, `root` and `action`,
and `baseFilter` its `filter` ([The registry](registry.md)). Spread `baseInputs` to add kinds of
your own.

## Inputs

One kind per control, each drawing the component it names. Its value is
what the form holds for it, and empty is where a field of it starts.

| Kind             | Control                                                                                           | Value                              | Empty          | Config                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------- | --------------------------------------------------------------------- |
| `text`           | [Input](../../ui/src/library/inputs/components/input/input.md)                                    | `string`                           | `''`           | `placeholder`, `mono`, `prefix`, `commit`                             |
| `email`          | [Input](../../ui/src/library/inputs/components/input/input.md), `type="email"`                    | `string`                           | `''`           | `placeholder`, `commit`                                               |
| `textarea`       | [Textarea](../../ui/src/library/inputs/components/textarea/textarea.md)                           | `string`                           | `''`           | `rows`, `placeholder`, `commit`                                       |
| `number`         | [NumberInput](../../ui/src/library/inputs/components/number-input/number-input.md)                | `number \| null`                   | `null`         | `min`, `max`, `step`, `suffix`, `commit`                              |
| `select`         | [Combobox](../../ui/src/library/inputs/components/combobox/combobox.md)                           | `string \| null`                   | `null`         | `options`, `placeholder`, `counts`                                    |
| `multi-select`   | [MultiCombobox](../../ui/src/library/inputs/components/multi-combobox/multi-combobox.md)          | `string[]`                         | `[]`           | `options`, `placeholder`, `maxChips`, `counts`                        |
| `radio`          | [RadioGroup](../../ui/src/library/inputs/components/radio-group/radio-group.md)                   | `string`                           | `''`           | `options`, `variant`, `label`                                         |
| `segmented`      | [SegmentedControl](../../ui/src/library/inputs/components/segmented-control/segmented-control.md) | `string`                           | `''`           | `options`, `label`, `size`, `placeholder`, `counts`                   |
| `checkbox-group` | [CheckboxGroup](../../ui/src/library/inputs/components/checkbox-group/checkbox-group.md)          | `string[]`                         | `[]`           | `options`, `label`, `selectAllLabel`                                  |
| `toggle`         | [Switch](../../ui/src/library/inputs/components/switch/switch.md)                                 | `boolean`                          | `false`        | `label`                                                               |
| `checkbox`       | [Checkbox](../../ui/src/library/inputs/components/checkbox/checkbox.md)                           | `boolean`                          | `false`        | `label`, `description`                                                |
| `date`           | [DatePicker](../../ui/src/library/inputs/components/date-picker/date-picker.md)                   | `string \| null`, `yyyy-mm-dd`     | `null`         | `placeholder`, `min`, `max`                                           |
| `date-range`     | [DateRangePicker](../../ui/src/library/inputs/components/date-range-picker/date-range-picker.md)  | `[string \| null, string \| null]` | `[null, null]` | `placeholder`                                                         |
| `time`           | [TimePicker](../../ui/src/library/inputs/components/time-picker/time-picker.md)                   | `string \| null`, `HH:MM`          | `null`         | `stepMinutes`, `placeholder`                                          |
| `duration`       | [DurationInput](../../ui/src/library/inputs/components/duration-input/duration-input.md)          | `number \| null`, in minutes       | `null`         | `placeholder`, `budgetMinutes`                                        |
| `slider`         | [Slider](../../ui/src/library/inputs/components/slider/slider.md)                                 | `number`                           | `0`            | `min`, `max`, `step`, `label`, `valueText`                            |
| `range`          | [RangeSlider](../../ui/src/library/inputs/components/range-slider/range-slider.md)                | `[number, number]`                 | `[0, 100]`     | `min`, `max`, `step`, `label`                                         |
| `rating`         | [Rating](../../ui/src/library/inputs/components/rating/rating.md)                                 | `number`, `0` unrated              | `0`            | `max`, `label`, `showValue`                                           |
| `tags`           | [TagInput](../../ui/src/library/inputs/components/tag-input/tag-input.md)                         | `string[]`                         | `[]`           | `suggestions`, `placeholder`                                          |
| `password`       | [PasswordInput](../../ui/src/library/inputs/components/password-input/password-input.md)          | `string`                           | `''`           | `placeholder`, `commit`                                               |
| `pin`            | [PinInput](../../ui/src/library/inputs/components/pin-input/pin-input.md)                         | `string`, the whole code           | `''`           | `length`                                                              |
| `color`          | [ColorPicker](../../ui/src/library/inputs/components/color-picker/color-picker.md)                | `string \| null`, a hue's name     | `null`         | `placeholder`, `label`                                                |
| `icon`           | [IconPicker](../../ui/src/library/inputs/components/icon-picker/icon-picker.md)                   | `string \| null`, an icon's name   | `null`         | `placeholder`, `icons`                                                |
| `user`           | [UserPicker](../../ui/src/library/inputs/components/user-picker/user-picker.md)                   | `string[]`, people's ids           | `[]`           | `people` or `options`, `multiple`, `placeholder`                      |
| `file`           | [FileInput](../../ui/src/library/inputs/components/file-input/file-input.md)                      | `UploadFile[]`                     | `[]`           | `accept`, `multiple`, `onSelect`                                      |
| `search`         | [SearchInput](../../ui/src/library/inputs/components/search-input/search-input.md)                | `string`                           | `''`           | `placeholder`, `commit`, `shortcut`                                   |
| `toggle-chips`   | [ToggleChips](../../ui/src/library/inputs/components/toggle-chips/toggle-chips.md)                | `string[]`                         | `[]`           | `options`, `label`, `maxVisible`, `tone`, `counts`                    |
| `tabs`           | [Tabs](../../ui/src/library/navigation/components/tabs/tabs.md), pills in a `group`               | `string`                           | `''`           | `options`, `label`, `counts`                                          |
| `avatars`        | [Avatar](../../ui/src/library/primitives/components/avatar/avatar.md)s as toggles                 | `string[]`, people's ids           | `[]`           | `people` or `options`, `maxVisible`, `label`                          |
| `rules`          | a chip per condition                                                                              | `Filter[]`, joined by `all`        | `[]`           | `add`, `operatorInputs`, `fields`, `operators`, `kinds`, `optionsFor` |
| `json`           | [Textarea](../../ui/src/library/inputs/components/textarea/textarea.md), parsed as you type       | `string`, the text itself          | `''`           | `rows`, `placeholder`                                                 |
| `list`           | a form per item                                                                                   | `Record<string, unknown>[]`        | `[]`           | `item`, `itemLabel`                                                   |
| `object`         | a form inside the form                                                                            | `Record<string, unknown> \| null`  | `null`         | `fields`                                                              |

`select`, `multi-select`, `radio`, `segmented`, `checkbox-group`,
`toggle-chips`, `tabs`, `user` and `avatars` are disabled while their
config [loads](async-options.md).
Every kind passes a [read-only](building-a-form.md#the-builder)
field's `readOnly` to its control, which shows the value and takes no
change; a `list` then offers no Add, move or Remove, and its items' and
an `object`'s fields are read-only too.
`InputKind` names every kind, and `ValueOfKind` what each one holds.

`commit`, in the config of `text`, `email`, `password`, `textarea`,
`number` and `search`, says when the field hands what you type to the form:
`'change'` (the default) at every keystroke, `'leave'` on Enter and on
leaving the field, `{ after: 800 }` on those and after a pause. Until
then the field holds a draft, and the form's value is the last one
committed.

A `segmented`'s `placeholder` is a first segment, labelled as given,
that holds `''`: the choice of none, so the field can go back to empty.
Its `size` is the control's height, `'xs'`, `'md'` or `'lg'`.

A `tabs` field draws each option as a tab, its `count` as the tab's
badge: a list's statuses, "Open 12 · Resolved 40 · Ignored 3".

A `select`, `multi-select`, `toggle-chips`, `segmented` or `tabs`
field's `counts: true` is for a filter form, which fills each option's
`count` with the rows picking it would show. An option's `color` in
them may be any bh tone, as a resource's options' are: a role's
(`'success'`) is painted from its hue, green.

An `avatars` field draws each of its `people` as a 30-pixel avatar
that a click presses, ringed in the primary tone while pressed, and
the people past `maxVisible`, 6 unless set, behind a `+N` that opens
[UserPicker](../../ui/src/library/inputs/components/user-picker/user-picker.md)'s list. "No one" is no
toggle: in a filter it is a preset of its own.

A `user` or `avatars` field takes `options` in place of `people`, as a
filter form gives a ref field's rows: each option's value is a
person's id, its label their name.

A `search`'s `shortcut`, `'/'` or `'mod+K'`, is drawn in the empty box
and bound on the page while the field is drawn: the key puts the focus
in the box, unless the focus is in another field, where it types.

A `<label for>` names one element, and `radio`, `segmented`,
`checkbox-group`, `toggle-chips`, `tabs`, `avatars`, `rating`, `slider`
and `range` are drawn as groups or
on a div, which it cannot name. Those take the field's label as their
accessible name instead; a `label` in their config names them in its
place.

The kinds a filter bar draws most, each changing the form's value as
it is pressed or typed: `search`, `tabs`, a `segmented` with a
placeholder, `toggle-chips` and `avatars`. Press `/` to reach the
search box.

**Kinds for filters**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const PEOPLE = [
  { id: '1', name: 'Nino Beridze' },
  { id: '2', name: 'Luka Tsereteli' },
  { id: '3', name: 'Mariam Gelashvili' },
  { id: '4', name: 'Dato Abashidze', detail: '@dato' },
  { id: '5', name: 'Salome Javakhishvili' },
];

const library = defineForm(registry).build((b) => {
  return [
    b.search({ name: 'search', label: 'Search', config: { shortcut: '/' } }),
    b.tabs({
      name: 'watched',
      label: 'Watched',
      config: {
        options: [
          { value: 'unwatched', label: 'Unwatched', count: 138 },
          { value: 'watched', label: 'Watched', count: 61 },
        ],
      },
    }),
    b.segmented({
      name: 'kind',
      label: 'Kind',
      config: {
        placeholder: 'Any',
        options: [
          { value: 'video', label: 'Video' },
          { value: 'audio', label: 'Audio' },
        ],
      },
    }),
    b['toggle-chips']({
      name: 'quality',
      label: 'Quality',
      config: {
        options: [
          { value: 'sd', label: 'SD', count: 40 },
          { value: 'hd', label: 'HD', count: 91 },
          { value: '4k', label: '4K', count: 7 },
        ],
      },
    }),
    b.avatars({
      name: 'sharedBy',
      label: 'Shared by',
      config: { people: PEOPLE, maxVisible: 3 },
    }),
  ];
});

export function KindsForFilters() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-560 flex-col gap-12">
        <Form
          form={library}
          onCommit={(_, now) => {
            setValues(now);
          }}
        />
        <pre className="text-12 text-gray-11 font-mono break-all whitespace-pre-wrap">
          {JSON.stringify(values)}
        </pre>
      </div>
    </FormProvider>
  );
}
```

## Two kinds for one value

`toggle` and `checkbox` both hold a boolean, and `radio`, `segmented`
and `select` one string. Which one a form uses is a decision a stored
form records: a switch reads as taking effect at once, a checkbox as a
value saved with the form; a radio group shows every option, a select
keeps them behind a trigger.

## A filter's rules

A `rules` field draws each condition as a chip: the field's label in
bold, the operator in its words for the field ("is before" on a date,
"has any of" on a list), the values as pills in their options' colors,
a ref's by the titles `optionsFor` gives, and an × that drops it. Its
`fields`, `operators`, `kinds` and `optionsFor` are a filter form's to
give, from the resource's metadata. A read-only field's chips are grey,
with a lock and no ×.

Its + Filter adds one in three steps in one popover: a field whose
`query.filter` isn't empty, an operator it allows in its words, then
the value, drawn by the input a form draws for it: `select` for `equals`
on an option or a ref, `multi-select` for `in`, `text`, `number`
(with "days" for `inLast`), `date`, Yes and No for a boolean, the
input `operatorInputs` names for an app's own operator, and nothing for
`empty` or `isMe`. The rule is a draft until Add; Cancel and Escape
drop it. A click on a chip opens it at its operator.

An `any` or `not` group, which a view or the API may hold but a
filter form never writes, is one grey chip that reads it in words,
"Owner is me or Starred is Yes". It can't be opened, it is kept as it
is while the rest changes, and its × removes it.

**Rules**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import type { FieldMeta, Filter } from '@bh/resource';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

/** A field of a made-up media library, filterable by `filter`. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: false, search: false },
    write: { create: true, update: true, required: false },
  };
}

const FIELDS: FieldMeta[] = [
  field(
    'kind',
    'Kind',
    {
      kind: 'option',
      settings: {
        options: [
          { value: 'video', label: 'Video', color: 'indigo', order: 0 },
          { value: 'audio', label: 'Audio', color: 'teal', order: 1 },
          { value: 'image', label: 'Image', color: 'orange', order: 2 },
        ],
      },
    },
    ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'],
  ),
  field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, ['in', 'notIn', 'isMe']),
  field('uploaded', 'Uploaded', { kind: 'date' }, ['lt', 'gt', 'inLast', 'notInLast']),
  field('size', 'Size', { kind: 'number' }, ['lt', 'gte']),
  field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith']),
  field('starred', 'Starred', { kind: 'boolean' }, ['equals']),
];

/** The people an owner may be, as an app's API would name them. */
async function optionsFor(target: FieldMeta) {
  return target.key === 'owner'
    ? [
        { value: '1', label: 'Nino Beridze' },
        { value: '2', label: 'Luka Tsereteli' },
      ]
    : [];
}

const form = defineForm(registry).build((b) => {
  return [b.rules({ name: 'rules', label: 'Filters', config: { fields: FIELDS, optionsFor } })];
});

export function Rules() {
  const [rules, setRules] = useState<Filter[]>([
    { field: 'kind', op: 'in', value: ['video', 'audio'] },
    { field: 'uploaded', op: 'inLast', value: 30 },
    // A group, as a saved view may hold: one chip in words.
    {
      any: [
        { field: 'owner', op: 'isMe' },
        { field: 'starred', op: 'equals', value: true },
      ],
    },
  ]);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-640 flex-col gap-12">
        <Form
          form={form}
          values={{ rules }}
          onCommit={(_, now) => {
            setRules(now.rules as Filter[]);
          }}
        />
        <pre className="text-12 text-gray-11 font-mono break-all whitespace-pre-wrap">
          {JSON.stringify({ all: rules })}
        </pre>
      </div>
    </FormProvider>
  );
}
```

With `add: 'panel'`, a Filters button with how many rules there are
opens a panel from the right edge instead, every rule a row: its field,
its operator as a select, and its value's input. A row applies as soon
as it is whole; one whose new operator still wants a value applies
nothing until it has one. + Filter at the panel's foot adds one in the
same three steps, and the chips still show in the bar. A rule the panel
can't draw, as an attribute's a preset wrote, is a row in words.

**Rules panel**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import type { FieldMeta, Filter } from '@bh/resource';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

/** A field of a made-up crawler's runs, filterable by `filter`. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: false, search: false },
    write: { create: true, update: true, required: false },
  };
}

const FIELDS: FieldMeta[] = [
  field(
    'status',
    'Status',
    {
      kind: 'option',
      settings: {
        options: [
          { value: 'running', label: 'Running', color: 'blue', order: 0 },
          { value: 'done', label: 'Done', color: 'green', order: 1 },
          { value: 'failed', label: 'Failed', color: 'red', order: 2 },
        ],
      },
    },
    ['equals', 'in', 'notIn'],
  ),
  field('pages', 'Pages', { kind: 'number' }, ['lt', 'gte']),
  field('started', 'Started', { kind: 'date' }, ['inLast', 'gt']),
  field('site', 'Site', { kind: 'text' }, ['contains', 'startsWith']),
];

const form = defineForm(registry).build((b) => {
  return [b.rules({ name: 'rules', label: 'Filters', config: { add: 'panel', fields: FIELDS } })];
});

export function RulesPanel() {
  const [rules, setRules] = useState<Filter[]>([{ field: 'pages', op: 'gte', value: 100 }]);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-640 flex-col gap-12">
        <Form
          form={form}
          values={{ rules }}
          onCommit={(_, now) => {
            setRules(now.rules as Filter[]);
          }}
        />
        <pre className="text-12 text-gray-11 font-mono break-all whitespace-pre-wrap">
          {JSON.stringify({ all: rules })}
        </pre>
      </div>
    </FormProvider>
  );
}
```

## Lists and objects

A `list` holds any number of objects of one shape, its `item` the form
of one; Add puts a new one at the end, filled with its fields' defaults,
and each moves up and down and comes out. An `object` holds one, its
`fields` the form of it. Both draw their fields with the form's own
registry.

**Lists and objects**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

const page = defineForm(registry).build((b) => {
  return [
    b.list({
      name: 'links',
      label: 'Links',
      config: {
        itemLabel: 'Link',
        // One item's fields, as plain data: a list's items are forms of their own.
        item: {
          nodes: [
            { kind: 'field', name: 'label', type: 'text', label: 'Label', config: {} },
            {
              kind: 'field',
              name: 'url',
              type: 'text',
              label: 'Address',
              config: { prefix: 'https://' },
            },
          ],
        },
      },
    }),
    b.object({
      name: 'size',
      label: 'Size',
      config: {
        fields: {
          nodes: [
            { kind: 'field', name: 'width', type: 'number', label: 'Width', config: {} },
            { kind: 'field', name: 'height', type: 'number', label: 'Height', config: {} },
          ],
        },
      },
    }),
    b.actions({}, [b.submit({ label: 'Submit' })]),
  ];
});

export function ListsAndObjects() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-400 flex-col gap-12">
        <Form form={page} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
```

## Layouts

| Kind      | Props                  | Draws                                                                                               |
| --------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `card`    | `title`, `description` | A [Card](../../ui/src/library/layout/components/card/card.md) with its title in a header, an `<h3>` |
| `group`   | `title`, `description` | A rule and a caption, an `<h4>`, and no surface: a part of a card                                   |
| `row`     | none                   | Its fields side by side once it is 760 pixels wide, stacked below that                              |
| `column`  | none                   | Its fields stacked, spaced as the form's own                                                        |
| `actions` | none                   | Its buttons side by side at their own widths, a little below the fields                             |
| `inline`  | `overflow`, `narrow`   | A filter bar's row: its fields side by side, each named inside or before it                         |

`inline` lays its fields, buttons and slots 6 pixels apart in one row,
each at its own width and centred; a `search` field grows to fill
what's left, from 160 pixels. A filter's count and changes and the
form's buttons sit at the row's end, past the free space, and a reset
with nothing to reset, Clear before any condition, isn't drawn. More
than fits wraps onto more lines
(`overflow: 'wrap'`, the default), scrolls sideways on one line that
fades at its end while there is more (`'scroll'`), or shows a `rules`
field's first `n` chips and a "+3 more" button that shows the rest
(`{ collapse: n }`). Its fields get
[InlineFieldWrapper](../../ui/src/library/forms/components/inline-field-wrapper/inline-field-wrapper.md) in place of
the registry's `field`: a `select`, `multi-select`, `date`,
`date-range` or `user` draws its label inside its trigger, "Kind:
any", and every control takes the 30-pixel rung. `narrow`, `{ below, keep }`, is a filter
form's: below `below` pixels of the form's own width only the fields named in
`keep` stay in the row.

**Inline overflow**

```tsx
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import type { FieldMeta, Filter } from '@bh/resource';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

/** A field of a made-up media library, filterable by `filter`. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: false, search: false },
    write: { create: true, update: true, required: false },
  };
}

const FIELDS: FieldMeta[] = [
  field('size', 'Size', { kind: 'number' }, ['lt', 'gte']),
  field('title', 'Title', { kind: 'text' }, ['contains']),
  field('starred', 'Starred', { kind: 'boolean' }, ['equals']),
  field('uploaded', 'Uploaded', { kind: 'date' }, ['inLast']),
];

const RULES: Filter[] = [
  { field: 'size', op: 'gte', value: 100 },
  { field: 'title', op: 'contains', value: 'trailer' },
  { field: 'starred', op: 'equals', value: true },
  { field: 'uploaded', op: 'inLast', value: 30 },
];

/** The same row three ways, each 375 pixels wide. */
const ROWS = [
  ['wrap', 'wrap'],
  ['scroll', 'scroll'],
  ['{ collapse: 2 }', { collapse: 2 }],
] as const;

export function InlineOverflow() {
  return (
    <FormProvider registry={registry}>
      <div className="flex flex-col gap-16">
        {ROWS.map(([name, overflow]) => {
          const form = defineForm(registry).build((b) => {
            return [
              b.inline({ overflow }, [
                b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search' } }),
                b.rules({ name: 'rules', label: 'Filters', config: { fields: FIELDS } }),
              ]),
            ];
          });
          return (
            <div key={name} className="flex flex-col gap-6">
              <code className="text-12 text-gray-11 font-mono">overflow: {name}</code>
              <div className="border-gray-6 rounded-6 border-1.5 w-375 max-w-full p-10">
                <Form form={form} values={{ rules: RULES }} />
              </div>
            </div>
          );
        })}
      </div>
    </FormProvider>
  );
}
```

## Wrappers

[FieldWrapper](../../ui/src/library/forms/components/field-wrapper/field-wrapper.md) draws a field's label,
its input, and its help or its problem; the label sits beside the field
once the field is 520 pixels wide, above it below that. `RootWrapper`
spaces the form's top-level fields. `FormButton` draws a submit as a solid
[Button](../../ui/src/library/primitives/components/button/button.md) that shows the submit running,
and a reset as a ghost one. In an `inline` row,
[InlineFieldWrapper](../../ui/src/library/forms/components/inline-field-wrapper/inline-field-wrapper.md) names each
field inside its control, before it, or for a screen reader only, and
shows its problem beside it.

## A filter form's parts

`baseFilter` is a registry's `filter`, what a
[filter form](filter-form.md) draws besides its fields:

| Part      | Draws                                                                                                               | Where                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `count`   | [FilterCount](../../ui/src/library/forms/components/filter-count/filter-count.md): "4 of 6 tasks"                   | its `count` slot                                  |
| `changes` | [FilterChanges](../../ui/src/library/forms/components/filter-changes/filter-changes.md): "1 change waiting"         | its `changes` slot, with an Apply                 |
| `sheet`   | [FilterSheet](../../ui/src/library/forms/components/filter-sheet/filter-sheet.md): the Filters button and its sheet | where its bar's first moved field was, on a phone |

## Rules

- A kind's name is stored with every form that uses it: renaming one is
  a migration of that data.
- A kind's empty value is one its control can draw: a field never
  starts undefined.
- A field's problem shows once the field has been left or a submit
  tried, and `touched` says which fields have been left. The field
  wrapper draws whatever problem it is given.

## Reference

```ts
type InputKind = keyof typeof baseInputs;
```

The kinds a FormConfig may name — the vocabulary anything GENERATING one has
to speak.

This is the seam the table engine joins at. `propsToForm` picks a kind per
column and emits a FormConfig; the form layer resolves it through
`baseInputs` and never learns which control it ended up rendering. Derived
from the registry rather than restated, so a kind cannot be added to one
without the other.

These strings are serialised into stored FormConfigs, so renaming one is a
data migration, not a refactor.

One of `'number'`, `'object'`, `'duration'`, `'select'`, `'color'`, `'text'`, `'search'`, `'icon'`, `'file'`, `'user'`, `'list'`, `'textarea'`, `'time'`, `'checkbox'`, `'radio'`, `'slider'`, `'toggle'`, `'email'`, `'multi-select'`, `'date'`, `'json'`, `'password'`, `'pin'`, `'segmented'`, `'checkbox-group'`, `'tags'`, `'rating'`, `'range'`, `'date-range'`, `'toggle-chips'`, `'tabs'`, `'avatars'`, `'rules'`.

```ts
interface ValueOfKind
```

What a field of each kind holds — the other half of the contract, and the
half a type cannot infer from `defaultValue` alone (`null` is both an empty
number and an empty select).

Nullability is meaning here, not style: a number field can be empty where a
toggle cannot, and a multi-select uses `[]` rather than null so "nothing
selected" has exactly one spelling.

| Member                      | Type                               | Default | Description                                                                                                                                   |
| --------------------------- | ---------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `text` (required)           | `string`                           |         |                                                                                                                                               |
| `email` (required)          | `string`                           |         | The address as typed: the field's schema checks it.                                                                                           |
| `textarea` (required)       | `string`                           |         |                                                                                                                                               |
| `number` (required)         | `number \| null`                   |         |                                                                                                                                               |
| `select` (required)         | `string \| null`                   |         |                                                                                                                                               |
| `multi-select` (required)   | `string[]`                         |         |                                                                                                                                               |
| `radio` (required)          | `string`                           |         | `''` is "nothing chosen" — a radio group is never null, it is unselected.                                                                     |
| `toggle` (required)         | `boolean`                          |         |                                                                                                                                               |
| `checkbox` (required)       | `boolean`                          |         |                                                                                                                                               |
| `date` (required)           | `string \| null`                   |         | ISO `yyyy-mm-dd`. A calendar day has no time and no zone; a `Date` has both.                                                                  |
| `slider` (required)         | `number`                           |         | Never null: a thumb is always somewhere, so an empty slider would render a position and lie about it. A number that can be empty is `number`. |
| `json` (required)           | `string`                           |         |                                                                                                                                               |
| `password` (required)       | `string`                           |         |                                                                                                                                               |
| `pin` (required)            | `string`                           |         | The whole code, not one value per cell.                                                                                                       |
| `segmented` (required)      | `string`                           |         |                                                                                                                                               |
| `checkbox-group` (required) | `string[]`                         |         |                                                                                                                                               |
| `tags` (required)           | `string[]`                         |         | Free text, so these are the values themselves rather than ids into a list.                                                                    |
| `rating` (required)         | `number`                           |         | 0 is unrated — a real answer, which is why this is not nullable.                                                                              |
| `range` (required)          | `[number, number]`                 |         | Two thumbs are always somewhere, so a range is never null.                                                                                    |
| `date-range` (required)     | `[string \| null, string \| null]` |         | Either half may be null: a half-picked range is a real state to hold.                                                                         |
| `time` (required)           | `string \| null`                   |         | `HH:MM`, a clock reading.                                                                                                                     |
| `duration` (required)       | `number \| null`                   |         | MINUTES, a length. Looks like `time` and means something else entirely.                                                                       |
| `color` (required)          | `string \| null`                   |         | A hue name from the eleven ramps.                                                                                                             |
| `icon` (required)           | `string \| null`                   |         | An icon name from the registry.                                                                                                               |
| `user` (required)           | `string[]`                         |         | Person ids, in both single and multi mode.                                                                                                    |
| `file` (required)           | `UploadFile[]`                     |         |                                                                                                                                               |
| `search` (required)         | `string`                           |         | The text searched for.                                                                                                                        |
| `toggle-chips` (required)   | `string[]`                         |         | The pressed chips' values, in the order they were pressed.                                                                                    |
| `tabs` (required)           | `string`                           |         | `''` is no tab chosen, as a radio group's.                                                                                                    |
| `avatars` (required)        | `string[]`                         |         | Person ids, as `user`'s, in the order they were pressed.                                                                                      |
| `rules` (required)          | `Filter[]`                         |         | A filter's rules, each joined to the rest by `all`: conditions, and any group kept as it is.                                                  |
| `list` (required)           | `Record<string, unknown>[]`        |         | Each item an object of its own fields' values.                                                                                                |
| `object` (required)         | `Record<string, unknown> \| null`  |         | Null until a field in it is given a value.                                                                                                    |

| Prop                  | Type        | Default | Description                                                                                                                                   |
| --------------------- | ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (required)     | `string`    |         | The field's name in the form's values.                                                                                                        |
| `type`                | `string`    |         | The field's kind, as its input is registered: 'select', 'search'. A wrapper may place the label its own way per kind, as a filter bar's does. |
| `label`               | `string`    |         | The field's label, from its definition.                                                                                                       |
| `description`         | `string`    |         | Help text for the field, from its definition.                                                                                                 |
| `required` (required) | `boolean`   |         | Whether the field is required, from its definition.                                                                                           |
| `error`               | `string`    |         | The field's problem: its validation message, once the field has been left or a submit tried, or why its last commit failed to save.           |
| `descriptionId`       | `string`    |         | The id for the element that holds `description`, which the input is described by.                                                             |
| `errorId`             | `string`    |         | The id for the element that holds `error`, or `configError`'s message: the input is described by it in the help's place.                      |
| `touched` (required)  | `boolean`   |         | Whether the reader has left the field yet.                                                                                                    |
| `loading` (required)  | `boolean`   |         | Whether the field's config is still resolving, as while its options load.                                                                     |
| `configError`         | `Error`     |         | Why the field's config failed to resolve, if it did.                                                                                          |
| `saving`              | `boolean`   |         | Whether the field's last commit is still being saved by the form's `onCommit`.                                                                |
| `children` (required) | `ReactNode` |         | The field's input, drawn from the registry.                                                                                                   |

| Prop                  | Type        | Default | Description                                   |
| --------------------- | ----------- | ------- | --------------------------------------------- |
| `children` (required) | `ReactNode` |         | The form's fields and layouts, already drawn. |

| Prop                  | Type                                | Default | Description                                                                            |
| --------------------- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `action` (required)   | `FormAction`: `'submit'`, `'reset'` |         | What it does: submit the form, or put its values back where they started.              |
| `label` (required)    | `string`                            |         | Its text, from the node.                                                               |
| `disabled` (required) | `boolean`                           |         | A reset with nothing to put back, and either while a submit runs.                      |
| `loading` (required)  | `boolean`                           |         | A submit running: the submit button shows it.                                          |
| `onClick`             | `() => void`                        |         | A reset's: puts the values back. A submit is a `type="submit"` button, and needs none. |

## Types

`ValueOfKind` names `Filter`, a `rules` field's value, from
[`@bh/resource`](../../../shared/resource/docs/contract.md):

```ts
/** A registered operator's name: one of bh's fifteen or an app's own. */
export type Operator = string;

/** A field's key, or an option field's key, a dot and one of its attributes: 'status.kind'. */
export type FieldPath = string;

/** One value: text, a finite number, or a boolean. */
export type Scalar = string | number | boolean;

/** Which rows: conditions on their fields, joined by all, any and not. */
export type Filter = { all: Filter[] } | { any: Filter[] } | { not: Filter } | Condition;

/** One field, one operator, and what it compares with; no value for an operator that takes none. */
export interface Condition {
  field: FieldPath;
  op: Operator;
  value?: Scalar | Scalar[];
}
```
