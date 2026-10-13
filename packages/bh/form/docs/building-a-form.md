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
- **`defaultValue`**: what it starts at, typed as its kind holds it.
- **`config`**: its input's settings, typed by the kind: a select's
  `options`, a text field's `placeholder`. Always given, `{}` for none.
- **`when`**: [when it shows](visibility.md).

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
`onSubmit`; a reset puts them back where they started, and waits for a
change to put back. Either takes a `when`. `@bh/ui`'s `actions` layout
keeps them side by side at their own widths:

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
    b.text({ name: 'name', label: 'Name', config: {} }),
    b.actions({}, [b.reset({ label: 'Reset' }), b.submit({ label: 'Save' })]),
  ];
});
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
its `type`, a layout is its own `kind` with `props` and `children`, and
a button is `kind: 'action'` with its `action` and `label`. The same
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
- `submit` and `reset` are the builder's own: `defineRegistry` throws for
  an input of either name, and for a layout named `field` or `action`.
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
children that returns a layout node; and `submit` and `reset`, which return
the form's buttons, drawn where they sit.

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
| `defaultValue`      | `InferValue<R[K]>`                |         | What it starts at, unless the form's `defaultValues` names it.            |
| `config` (required) | `AuthorConfig<InferConfig<R[K]>>` |         | Its input's config, typed by the kind; any key may be an `AsyncResolver`. |
| `when`              | `WhenClause`                      |         | Shown only while this holds.                                              |

```ts
interface ActionOptions
```

What a builder's `submit` and `reset` take.

| Member             | Type         | Default | Description                  |
| ------------------ | ------------ | ------- | ---------------------------- |
| `label` (required) | `string`     |         | The button's text.           |
| `when`             | `WhenClause` |         | Shown only while this holds. |

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
interface ActionNode
```

A button: drawn where it sits in the tree by the registry's `action`, or as a plain `<button>`.

| Member              | Type                                | Default | Description                  |
| ------------------- | ----------------------------------- | ------- | ---------------------------- |
| `kind` (required)   | `'action'`                          |         |                              |
| `action` (required) | `FormAction`: `'submit'`, `'reset'` |         |                              |
| `label` (required)  | `string`                            |         | Its text.                    |
| `when`              | `WhenClause`                        |         | Shown only while this holds. |

```ts
type LayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry = {}> = …
```

A node of a form's tree: a field, a layout holding more nodes, or a button.

```ts
type CustomLayoutNode<R extends InputRegistry, L extends LayoutComponentRegistry> = …
```

A layout: nodes drawn inside the layout its `kind` names in the registry.

```ts
collectFields<R extends InputRegistry, L extends LayoutComponentRegistry = {}>(nodes): Map<string, FieldNode<R>>
```

Every field in a tree, by name, layouts opened. Throws on a name used twice,
which the form would hold as one value.

| Parameter          | Type                 | Default | Description |
| ------------------ | -------------------- | ------- | ----------- |
| `nodes` (required) | `LayoutNode<R, L>[]` |         |             |

Returns `Map<string, FieldNode<R>>`.
