---
title: Building a form
summary: Write a form's fields, layouts and buttons with the builder, typed by
  your registry, or as plain data.
order: 3
related: [The registry, Rendering and submitting, Visibility]
---

[//]: # 'written from building-a-form.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Building a form

Write a form's fields, layouts and buttons with the builder, typed by your
registry, or as plain data.

## The builder

`defineForm(registry).build((b) => [...])` hands you a builder with a
method for each kind in the registry, and returns the nodes as a
`FormConfig`. A field's method takes its options:

- **`name`**: its key in the form's values.
- **`label`** and **`description`**: drawn by the field wrapper.
- **`required`**: marks the label. It checks nothing: a
  [schema](validation.md) does.
- **`readOnly`**: shown, and still submitted, but changed neither by
  the reader nor by a reset. Its input is told, and the form ignores
  its changes: a filter's condition the page sets.
- **`defaultValue`**: what it starts at, typed as its kind holds it.
- **`config`**: its input's settings, typed by the kind: a select's
  `options`, a text field's `placeholder`. Always given, `{}` for none.
- **`when`**: [when it shows](visibility.md).
- **`filter`**: which part of the query's filter it holds, in a filter
  form: the condition its value writes, a range, presets, or rules
  (`FieldFilter`, below). Any other form ignores it.

A layout's method takes its props and its children: `b.card({ title },
[...])`. `@bh/ui`'s layouts are `card` and `group`, each with an
optional `title` and `description`, and `row`, `column` and `actions`,
with none.

**Layouts**

```tsx
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const profile = defineForm(registry).build((b) => {
  return [
    b.card({ title: 'Profile', description: 'How others see you.' }, [
      b.row({}, [
        b.text({
          name: 'first',
          label: 'First name',
          config: {},
        }),
        b.text({
          name: 'last',
          label: 'Last name',
          config: {},
        }),
      ]),
      b.select({
        name: 'language',
        label: 'Language',
        defaultValue: 'en',
        config: {
          options: [
            { value: 'en', label: 'English' },
            { value: 'fr', label: 'French' },
            { value: 'ka', label: 'Georgian' },
          ],
        },
      }),
      b.group({ title: 'Notifications' }, [
        b.toggle({
          name: 'digest',
          label: 'Weekly digest',
          config: { label: 'Weekly digest' },
        }),
        b.checkbox({
          name: 'mentions',
          label: 'Mentions',
          config: { label: 'Email me when someone mentions me' },
        }),
      ]),
    ]),
  ];
});

export function Layouts() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-560">
        <Form form={profile} />
      </div>
    </FormProvider>
  );
}
```

The row puts its fields side by side once it is 760 pixels wide, and
stacks them below that; the labels go beside their fields from 520.
Switch the panel to a phone's width to see both.

## Buttons

`b.submit({ label })` and `b.reset({ label })` are the form's buttons,
drawn where they sit by the registry's
[`action`](registry.md#what-a-registry-holds), or as a plain
`<button>` without one. A submit checks the values and calls
`onSubmit`; a reset puts them back to what was last submitted, else
where they started, and waits for a change to put back. Either takes a
`when`. `b.reset({ label, to: 'start' })` always puts them back where
they started, after a submit too, and waits for a change from there: a
filter's Clear. `@bh/ui`'s `actions` layout keeps them side by side at
their own widths:

```tsx
import { defineForm, defineRegistry } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
});

export const profile = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      config: {},
    }),
    b.actions({}, [b.reset({ label: 'Reset' }), b.submit({ label: 'Save' })]),
  ];
});
```

## Slots

`b.slot({ name })` is a place in the form the app fills, holding no
value. `<Form slots={{ [name]: node }}>` draws what it's given under that
name where the slot sits, inside a layout too, and nothing when it's given
none, so one stored form serves a page that fills it and one that doesn't.
A slot takes a `when`, and `<Form formApi>` takes `slots` as well. A
count beside a filter's fields, or a button of the app's own, is a slot.

```tsx
import { defineForm, defineRegistry, Form } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

const notes = defineForm(registry).build((b) => {
  return [b.textarea({ name: 'note', label: 'Note', config: {} }), b.slot({ name: 'saved' })];
});

export function Notes({ savedAt }: { savedAt: string }) {
  return <Form registry={registry} form={notes} slots={{ saved: <p>Saved {savedAt}</p> }} />;
}
```

## Values and checks

`build` takes a second argument, the form's own `defaultValues` and its
cross-field [`schema`](validation.md#across-fields), so a form
carries them wherever it is drawn. `<Form defaultValues>` is laid over
the form's, and `<Form schema>` takes its place.

```tsx
import * as v from 'valibot';
import { defineForm, defineRegistry } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
});

export const account = defineForm(registry).build(
  (b) => {
    return [b.text({ name: 'email', label: 'Email', config: {} })];
  },
  {
    defaultValues: { email: 'name@example.com' },
    schema: v.object({ email: v.pipe(v.string(), v.email('That is not an email.')) }),
  },
);
```

## Plain data

What the builder returns is plain data: a field is `kind: 'field'` with
its `type`, a layout is its own `kind` with `props` and `children`, a
button is `kind: 'action'` with its `action` and `label`, and a slot is
`kind: 'slot'` with its `name`. The same
form can be written without the builder, stored, or generated:

```tsx
import type { FormConfig } from '@bh/form';
import type { baseInputs, baseLayouts } from '@bh/ui';

export const form: FormConfig<typeof baseInputs, typeof baseLayouts> = {
  nodes: [
    {
      kind: 'card',
      props: { title: 'Profile' },
      children: [
        { kind: 'field', name: 'first', type: 'text', label: 'First name', config: {} },
        { kind: 'field', name: 'last', type: 'text', label: 'Last name', config: {} },
      ],
    },
    { kind: 'action', action: 'submit', label: 'Save' },
  ],
};
```

The data holds two things a builder doesn't take, and that don't survive
being stored: a field's `validate` schema, and a config key loaded by a
function ([Async options](async-options.md)). Both are functions,
added in code.

## Rules

- A name is unique across the whole form, layouts and all: two fields of
  one name throw when the form is drawn.
- A field's `config` is always given, `{}` when its input takes none.
- `required` marks the label and nothing else.
- The builder throws for a method no kind in the registry names.
- `submit`, `reset` and `slot` are the builder's own: `defineRegistry`
  throws for an input or a layout of those names, and for a layout named
  `field` or `action`.
- A button inside a list's item draws nothing: it submits or resets the
  whole form.

## Reference

```ts
defineForm<I extends InputRegistry, L extends LayoutComponentRegistry>(registry): DefineFormReturn<I, L>
```

Starts a form against a registry. `.build((b) => nodes, options)` hands over
a builder with a method per input kind and per layout kind, each typed by
its definition, and `submit` and `reset` for its buttons. It returns the
form `<Form form>` draws: the nodes, and the options' values to start at
and check across fields.

| Parameter             | Type                 | Default | Description |
| --------------------- | -------------------- | ------- | ----------- |
| `registry` (required) | `FormRegistry<I, L>` |         |             |

Returns `DefineFormReturn<I, L>`.

```ts
type Builder<R extends InputRegistry, L extends LayoutComponentRegistry = {}> = …
```

`defineForm`'s builder: per input kind, a method taking `FieldOptions` that
returns a field; per layout kind, one taking its props (and `when`) and its
children that returns a layout node; `submit` and `reset`, which return the
form's buttons, drawn where they sit; and `slot`, a place the app fills.

```ts
interface FieldOptions<R extends InputRegistry, K extends keyof R>
```

What a builder's input method takes: the field, less its `kind` and `type`.

| Member              | Type                              | Default | Description                                                               |
| ------------------- | --------------------------------- | ------- | ------------------------------------------------------------------------- |
| `name` (required)   | `string`                          |         | Its key in the form's values; unique across the whole form.               |
| `label`             | `string`                          |         | Its label, drawn by the field wrapper.                                    |
| `description`       | `string`                          |         | Its help text, drawn by the field wrapper.                                |
| `required`          | `boolean`                         |         | Marks the label. It checks nothing: a `validate` schema does.             |
| `readOnly`          | `boolean`                         |         | Shown and submitted, but changed neither by the reader nor by a reset.    |
| `defaultValue`      | `InferValue<R[K]>`                |         | What it starts at, unless the form's `defaultValues` names it.            |
| `config` (required) | `AuthorConfig<InferConfig<R[K]>>` |         | Its input's config, typed by the kind; any key may be an `AsyncResolver`. |
| `when`              | `WhenClause`                      |         | Shown only while this holds.                                              |
| `filter`            | `FieldFilter`                     |         | Which part of the query's filter it holds, in a filter form.              |

```ts
interface ActionOptions
```

What a builder's `submit` and `reset` take.

| Member             | Type                                | Default | Description                                                                    |
| ------------------ | ----------------------------------- | ------- | ------------------------------------------------------------------------------ |
| `label` (required) | `string`                            |         | The button's text.                                                             |
| `when`             | `WhenClause`                        |         | Shown only while this holds.                                                   |
| `to`               | `ResetTo`: `'start'`, `'submitted'` |         | A reset's: `'submitted'` (the default) or `'start'`, where it puts the values. |

```ts
interface SlotOptions
```

What a builder's `slot` takes.

| Member            | Type         | Default | Description                  |
| ----------------- | ------------ | ------- | ---------------------------- |
| `name` (required) | `string`     |         | Its key in `<Form slots>`.   |
| `when`            | `WhenClause` |         | Shown only while this holds. |

```ts
interface FormConfig<R extends InputRegistry, L extends LayoutComponentRegistry = {}> extends FormOptions
```

A form, as data: its tree of fields, layouts and buttons, in the order they are drawn.

| Member             | Type                      | Default | Description                                                                                                                                                                                                                                             |
| ------------------ | ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultValues`    | `Record<string, unknown>` |         | Values to start at, by field name, over each field's own default. `<Form defaultValues>` wins over these.                                                                                                                                               |
| `schema`           | `StandardSchemaV1`        |         | A check across fields, run on the visible fields' values after each field's own. `<Form schema>` wins over it.                                                                                                                                          |
| `commit`           | `Commit`                  |         | When its fields hand their values to the form: `'change'` (the default) at every keystroke, `'leave'` on Enter and on leaving the field, `{ after: 800 }` on those and after a pause. A field's config may say otherwise; `<Form commit>` wins over it. |
| `nodes` (required) | `LayoutNode<R, L>[]`      |         | The top-level nodes.                                                                                                                                                                                                                                    |

```ts
interface FormOptions
```

What a form knows of itself beside its nodes: where it starts, its check across fields, and when its fields commit.

| Member          | Type                      | Default | Description                                                                                                                                                                                                                                             |
| --------------- | ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultValues` | `Record<string, unknown>` |         | Values to start at, by field name, over each field's own default. `<Form defaultValues>` wins over these.                                                                                                                                               |
| `schema`        | `StandardSchemaV1`        |         | A check across fields, run on the visible fields' values after each field's own. `<Form schema>` wins over it.                                                                                                                                          |
| `commit`        | `Commit`                  |         | When its fields hand their values to the form: `'change'` (the default) at every keystroke, `'leave'` on Enter and on leaving the field, `{ after: 800 }` on those and after a pause. A field's config may say otherwise; `<Form commit>` wins over it. |

```ts
type FieldNode<R extends InputRegistry> = …
```

A field: a value the form holds under `name`, drawn with the input its
`type` names in the registry.

```ts
type FieldFilter = …
```

Which part of the query's filter a field holds: plain data, so a stored
`FormConfig` keeps it as it is. A filter form folds every field's value into
one `{ all: [...] }` by it, and puts a filter back onto its fields.

- `{ op }`: the field's value is the operand of `field op value`. `field` is
  the field's own name when absent. `map` turns an input's value, as a
  string key (`'true'`, `'24h'`), into the operand, and `null` into no
  condition.
- `{ range }`: a `[from, to]` value: `field gte from` and `field lte to`,
  each half only when it's set.
- `{ presets }`: the value names presets, each one on or off.
- `{ rules: true }`: the value is a list of filters, each kept as it is.

```ts
interface Preset
```

One named filter a field turns on or off: "Mine", "Updated this week". Its
`value` is what the field holds while it's on; its `filter` is what it adds
to the query's, an `all` of conditions or one condition.

| Member              | Type     | Default | Description                                                      |
| ------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `value` (required)  | `string` |         | What the field holds for it: `'mine'`.                           |
| `label` (required)  | `string` |         | How it reads: `'Mine'`.                                          |
| `filter` (required) | `Filter` |         | What it adds while it's on: `{ field: 'assignee', op: 'isMe' }`. |

```ts
interface ActionNode
```

A button: drawn where it sits in the tree by the registry's `action`, or as a plain `<button>`.

| Member              | Type                                | Default | Description                                                                                                                                                                                                   |
| ------------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind` (required)   | `'action'`                          |         |                                                                                                                                                                                                               |
| `action` (required) | `FormAction`: `'submit'`, `'reset'` |         |                                                                                                                                                                                                               |
| `label` (required)  | `string`                            |         | Its text.                                                                                                                                                                                                     |
| `when`              | `WhenClause`                        |         | Shown only while this holds.                                                                                                                                                                                  |
| `to`                | `ResetTo`: `'start'`, `'submitted'` |         | A reset's: where it puts the values. `'submitted'` (the default) to what was last submitted, else to where the form started; `'start'` always to where it started, after a submit too: a filter form's Clear. |

```ts
type ResetTo = 'start' | 'submitted';
```

Where a reset puts the values: `'submitted'`, to what was last submitted,
else to where the form started; `'start'`, always to where it started.

One of `'start'`, `'submitted'`.

```ts
interface SlotNode
```

A place in the form the app fills, holding no value: `<Form slots>` draws
what it's given under the slot's `name` where the node sits, and nothing
when it's given none. A filter form's count and its app's "Save to view"
are slots.

| Member            | Type         | Default | Description                  |
| ----------------- | ------------ | ------- | ---------------------------- |
| `kind` (required) | `'slot'`     |         |                              |
| `name` (required) | `string`     |         | Its key in `<Form slots>`.   |
| `when`            | `WhenClause` |         | Shown only while this holds. |

```ts
type LayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry = {}> = …
```

A node of a form's tree: a field, a layout holding more nodes, a button, or a slot the app fills.

```ts
type CustomLayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry> = …
```

A layout: nodes drawn inside the layout its `kind` names in the registry.

```ts
collectFields<R extends InputRegistry, L extends LayoutComponentRegistry = {}>(nodes): Map<string, FieldNode<R>>
```

Every field in a tree, by name, layouts opened; buttons and slots hold no
value and are skipped. Throws on a name used twice, which the form would
hold as one value.

| Parameter          | Type                 | Default | Description |
| ------------------ | -------------------- | ------- | ----------- |
| `nodes` (required) | `LayoutNode<R, L>[]` |         |             |

Returns `Map<string, FieldNode<R>>`.

## Types

`FieldFilter` and `Preset` name these, from
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
