---
title: Writing an input
summary: Make a control of your own into a kind any form can name.
order: 10
related: [The registry, Instrument's bindings, Building a form]
---

[//]: # 'written from writing-an-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Writing an input

Make a control of your own into a kind any form can name.

## An input

An input is a component that takes `InputProps`: the field's `name`, its
`value` and `onChange`, its resolved `config`, and its state. This one
keeps an address to lowercase letters, digits and dashes as you type,
and is registered as `slug` beside `@bh/ui`'s kinds:

**Slug input**

```tsx
import { defineForm, defineRegistry, Form, FormProvider, type InputProps } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, Input, RootWrapper } from '@bh/ui';

interface SlugConfig {
  /** Shown before the field, as the address it ends. */
  prefix?: string;
}

/** Text kept to lowercase letters, digits and dashes, as typed. */
function SlugField(p: InputProps<SlugConfig, string>) {
  return (
    <div className="flex items-center gap-8">
      {p.config.prefix ? (
        <span className="text-13/19 text-gray-11 font-mono">{p.config.prefix}</span>
      ) : null}
      <Input
        // The field's label is for `name`; its help or problem has `describedBy`.
        id={p.name}
        aria-describedby={p.describedBy}
        name={p.name}
        value={p.value ?? ''}
        onChange={(next) => p.onChange(next.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
        onBlur={p.onBlur}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        className="font-mono"
      />
    </div>
  );
}

const registry = defineRegistry({
  inputs: baseInputs.register({ slug: { Component: SlugField, defaultValue: '' } }),
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const post = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      config: {},
    }),
    b.slug({
      name: 'slug',
      label: 'Address',
      config: { prefix: 'example.com/' },
    }),
  ];
});

export function SlugInput() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-400">
        <Form form={post} />
      </div>
    </FormProvider>
  );
}
```

Its config's type and its value's are the two type arguments of
`InputProps`, and the registry carries them to the builder: `b.slug`
takes a `prefix` and starts at `''`, and anything else is a type error.

## What an input does with its props

- **`name`**: the `id` of its focusable element, which the field
  wrapper's label is for.
- **`describedBy`**: that element's `aria-describedby`, the id of the
  help or the problem the wrapper draws under it.
- **`label`**: the field's label, which the wrapper draws. An input a
  `<label for>` cannot name, such as a group, names itself with it.
- **`value`**: drawn as given. It holds no value of its own, and it
  defaults an undefined one, which a registry with no `defaultValue` for
  it can give.
- **`onChange`**: called with the new value alone, not an event. It
  commits the value: it joins the form's values, and `onCommit` runs.
- **`commit`**: when the form's fields commit. An input that holds a
  draft until then passes it on (`commit` on `@bh/ui`'s text controls),
  and calls **`onDraft`** with the draft as it's typed, so a Save
  commits it first. An input with no draft ignores both.
- **`saving`**: the field's last commit is being saved by `onCommit`;
  the wrapper draws it too.
- **`onBlur`**: called when focus leaves it, which checks the form.
- **`error`**: drawn as invalid, `tone="danger"` in `@bh/ui`; the
  wrapper draws the message.
- **`disabled`**, and **`loading`** if its config loads: takes no
  changes.

## Registering it

A kind is a key of the registry's `inputs`: the component, and the
value a field of it starts at, which must be one it can hold and draws
as empty. Spread `baseInputs` to keep `@bh/ui`'s kinds.

```tsx
import type { ReactNode } from 'react';
import { defineRegistry, type InputProps } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

declare function SlugField(props: InputProps<{ prefix?: string }, string>): ReactNode;

export const registry = defineRegistry({
  inputs: baseInputs.register({ slug: { Component: SlugField, defaultValue: '' } }),
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});
```

## An input that draws fields

`list` and `object` draw forms inside a field. `NestedFields` draws some
fields with the registry of the `<Form>` around it, their values one
object that the input holds: it is the input's `value`, and each change
is a new one through `onChange`. `useFormRegistry` gives an input that
registry, and `defaultValuesOf` the object a new item starts as.

```tsx
import {
  defaultValuesOf,
  NestedFields,
  useFormRegistry,
  type FormConfig,
  type InputProps,
  type InputRegistry,
} from '@bh/form';

type Item = Record<string, unknown>;

// One item, with a button for a fresh one.
export function OneItem(p: InputProps<{ item: FormConfig<InputRegistry> }, Item | null>) {
  const registry = useFormRegistry();
  const fresh = () => p.onChange(defaultValuesOf(p.config.item.nodes, registry));
  return (
    <div id={p.name} onBlur={p.onBlur}>
      <NestedFields
        name={p.name}
        nodes={p.config.item.nodes}
        value={p.value ?? {}}
        onChange={p.onChange}
        disabled={p.disabled}
      />
      <button type="button" onClick={fresh}>
        Start again
      </button>
    </div>
  );
}
```

## Rules

- An input is controlled: what it shows is `value`, and what it changes
  goes through `onChange`. The one thing it may hold is a draft while
  it's typed in, before the field commits.
- A kind's `defaultValue` is a value its input can hold: it is what a
  field starts at, and what a list's new item holds.
- A kind's name is stored with every form that names it.
- Nested fields' names are made unique under the field's, as
  `links.0.url`, so their ids don't clash with the form's.

## Reference

```ts
interface InputProps<TConfigResolved, TValue>
```

What a form gives the input it draws for a field.

| Member                | Type                      | Default | Description                                                                                                                                                                                                    |
| --------------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (required)     | `string`                  |         | The field's name: put it on the focusable element as its `id`, which the field's label names.                                                                                                                  |
| `label`               | `string`                  |         | The field's label, from its definition. The wrapper draws it; an input whose element a `<label for>` cannot name (a group, a slider drawn on a div) names itself with it.                                      |
| `value` (required)    | `TValue`                  |         | The field's value. Undefined only when neither the field nor its input has a default.                                                                                                                          |
| `onChange` (required) | `(next: TValue) => void`  |         | Commits the field's value: it joins the form's values, and `onCommit` runs. Takes the new value alone.                                                                                                         |
| `commit`              | `Commit`                  |         | When the field commits, as the form says: pass it to a control that holds a draft (`commit` on `Input`). A field's own config may say otherwise. Undefined when the form says nothing: commit at every change. |
| `onDraft`             | `(draft: TValue) => void` |         | Tells the form what's typed before it commits, at every keystroke: a Save while the field is being typed in commits it first, and `useFieldDraft` reads it. A control with no draft needn't call it.           |
| `saving`              | `boolean`                 |         | Whether the field's last commit is still being saved by the form's `onCommit`.                                                                                                                                 |
| `onBlur` (required)   | `() => void`              |         | Call it when focus leaves the input: the form checks its values then.                                                                                                                                          |
| `config` (required)   | `TConfigResolved`         |         | The field's config, with every async key resolved; one still loading is left out.                                                                                                                              |
| `error`               | `string`                  |         | The field's problem, once the field has been left or a submit tried, or why its last commit failed to save.                                                                                                    |
| `disabled`            | `boolean`                 |         | Whether the form is submitting, when every input takes no changes.                                                                                                                                             |
| `readOnly`            | `boolean`                 |         | Whether the field is read-only: shown, and still submitted, but the reader can't change it. Pass it to the control's `readOnly`; the form ignores the field's `onChange` meanwhile.                            |
| `loading` (required)  | `boolean`                 |         | Whether the field's async config is still loading.                                                                                                                                                             |
| `configError`         | `Error`                   |         | Why the field's async config failed to load, if it did.                                                                                                                                                        |
| `describedBy`         | `string`                  |         | The id of what describes the field now, its problem or else its help: put it on the focusable element as `aria-describedby`.                                                                                   |

```ts
interface InputDefinition<TConfigResolved, TValue>
```

An input kind in a registry: the component that draws it, and the value it starts at.

| Member                 | Type                                                 | Default | Description                                                                               |
| ---------------------- | ---------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `Component` (required) | `ComponentType<InputProps<TConfigResolved, TValue>>` |         | The input, given the field's value, config and state.                                     |
| `defaultValue`         | `TValue`                                             |         | What a field of this kind starts at, when neither the field nor the form gives a default. |

| Prop                  | Type                                                            | Default | Description                                                                          |
| --------------------- | --------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `nodes` (required)    | `readonly LayoutNode<InputRegistry, LayoutComponentRegistry>[]` |         | The fields, as a FormConfig's `nodes`.                                               |
| `value` (required)    | `Record<string, unknown>`                                       |         | The object their values are in, by field name.                                       |
| `onChange` (required) | `(next: Record<string, unknown>) => void`                       |         | Called with the whole object, one field's value changed.                             |
| `name` (required)     | `string`                                                        |         | The field these belong to, which each name is made unique under: `shortcuts.0.keys`. |
| `disabled`            | `boolean`                                                       |         | Disables every input, as while the form submits.                                     |
| `readOnly`            | `boolean`                                                       |         | Makes every input read-only, as its field is: shown, never changed.                  |

```ts
useFormRegistry(): AnyFormRegistry
```

The registry of the `<Form>` around an input, or of the `FormProvider`; throws outside both.

Returns `AnyFormRegistry`.

```ts
defaultValuesOf(nodes, registry): Record<string, unknown>
```

A new object for these fields: each field's own default, else its input's.
What a list adds when asked for one more item.

| Parameter             | Type                                                            | Default | Description |
| --------------------- | --------------------------------------------------------------- | ------- | ----------- |
| `nodes` (required)    | `readonly LayoutNode<InputRegistry, LayoutComponentRegistry>[]` |         |             |
| `registry` (required) | `AnyFormRegistry`                                               |         |             |

Returns `Record<string, unknown>`.
