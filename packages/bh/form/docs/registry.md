---
title: The registry
summary: Choose the inputs, layouts, wrappers and button a form is drawn with.
order: 2
related: [Building a form, Instrument's bindings, Writing an input]
---

[//]: # 'written from registry.doc.yaml by pnpm docs:sync; edit that file, not this one'

# The registry

Choose the inputs, layouts and wrappers a form is drawn with, and give
each kind of field its starting value.

## What a registry holds

- **`inputs`**: by kind, the component that draws a field of that kind
  and the value it starts at. A field names its kind as its `type`.
- **`layouts`**: by kind, the component that draws a layout node around
  its children: a card, a row. `{}` for none.
- **`field`**: the wrapper drawn around every field: its label, the input,
  and its help or its problem.
- **`root`**, if any: the wrapper drawn around the whole form. Without one,
  the fields are drawn one after another with nothing between them.
- **`action`**, if any: the button drawn for a form's
  [submit and reset](building-a-form.md#buttons). Without one, a
  plain `<button>`.

An app builds one registry and draws every form with it. `@bh/ui` has a
piece for each slot ([Instrument's bindings](bindings.md)), so most
apps write this once:

```tsx
import { defineRegistry } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

export const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});
```

`defineRegistry` returns what it is given. It is there for the types:
`defineForm` reads each kind's config and value from them, so a field
is written with its own kind's config, and a kind the registry lacks is
an error as you type it.

## One registry for the app

`FormProvider` gives the registry to every `<Form>` and
`useStandaloneForm` under it, so the app wraps its root once and a form
is given only its form. A form given a `registry` of its own draws with
that one instead, for the one form in an app drawn another way.

```tsx
import type { ReactNode } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

// Once, around the app's root.
export function Providers({ children }: { children: ReactNode }) {
  return <FormProvider registry={registry}>{children}</FormProvider>;
}

// Anywhere under it: each <Form> is given only its form.
const profile = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      config: {},
    }),
  ];
});

export function Profile({ onSave }: { onSave: (values: Record<string, unknown>) => void }) {
  return <Form form={profile} onSubmit={onSave} />;
}
```

## Wrappers of your own

A wrapper is any component that takes the props the form gives it. This
form is drawn with `@bh/ui`'s inputs and a field wrapper of its own: a
compact label, a dot for required, the problem in place of the help.

**Own field wrapper**

```tsx
import {
  defineForm,
  defineRegistry,
  Form,
  FormProvider,
  type FieldWrapperProps,
  type RootWrapperProps,
} from '@bh/form';
import { baseInputs } from '@bh/ui';

// The label above, a dot for required, and the problem in place of the help.
// The two lines take the ids the input is described by.
function CompactField({
  name,
  label,
  description,
  required,
  error,
  descriptionId,
  errorId,
  children,
}: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-4">
      {label ? (
        <label htmlFor={name} className="text-13/19 font-500 text-gray-12 font-sans">
          {label}
          {required ? <span className="text-indigo-11"> •</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-12/17 text-red-11 font-sans">
          {error}
        </p>
      ) : description ? (
        <p id={descriptionId} className="text-12/17 text-gray-11 font-sans">
          {description}
        </p>
      ) : null}
    </div>
  );
}

// The space between fields: without a root, they are drawn with none.
function Stacked({ children }: RootWrapperProps) {
  return <div className="flex flex-col gap-16">{children}</div>;
}

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: {},
  field: { Component: CompactField },
  root: { Component: Stacked },
});

const note = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      required: true,
      config: {},
    }),
    b.textarea({
      name: 'body',
      label: 'Note',
      description: 'Plain text; line breaks are kept.',
      config: { rows: 3 },
    }),
  ];
});

export function OwnFieldWrapper() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-360">
        <Form form={note} />
      </div>
    </FormProvider>
  );
}
```

A field wrapper is given `name`, so its label can be a `<label>` for the
input's `id`, which `@bh/ui`'s inputs set to `name`. `descriptionId`
and `errorId` go on the lines that hold `description` and `error`: the
form points the input's `aria-describedby` at the problem if there is
one, else at the help. `touched`, `loading` and `configError` it draws
as it sees fit.

## Starting values

An input's `defaultValue` is what a field of its kind starts at when
neither the field nor the form gives one: `''` for text, `null` for a
number, `[]` for tags. It is the value the input draws as empty, so it
has to be one the input can hold: `@bh/ui`'s are on
[Instrument's bindings](bindings.md#inputs).

## Kinds are stored names

A form's data names its fields' kinds as strings, and a stored form
(in a database, in a file) keeps them. Renaming a kind is a migration of
that data, not a refactor. To change how a kind looks, change its
component and keep its name.

## Rules

- A field whose kind the registry lacks throws when the builder is asked
  for it, and, written as plain data, when the form draws it.
- A layout whose kind the registry lacks draws its children with no
  wrapper and no error, so a form built for another registry keeps its
  fields and loses its layout.
- `root` is optional, and nothing needs it: `@bh/ui`'s field wrapper and
  row measure their own width, not the form's.
- A form with no `registry` and no `FormProvider` above it throws, and
  says to add one.

## Reference

| Prop                  | Type                 | Default | Description                                                         |
| --------------------- | -------------------- | ------- | ------------------------------------------------------------------- |
| `registry` (required) | `FormRegistry<I, L>` |         | The inputs, layouts and wrappers every form under it is drawn with. |
| `children` (required) | `ReactNode`          |         | The app, or the part of it whose forms take this registry.          |

```ts
defineRegistry<I extends InputRegistry, L extends LayoutComponentRegistry>(registry): FormRegistry<I, L>
```

Types a registry: the inputs a form may name, its layouts, the wrappers
drawn around each field and around the form, and its button. Returns it as
given; the types are what `defineForm` builds against. Throws on an input
named `submit` or `reset`, which are the builder's buttons, and a layout
named for a node's own kind.

| Parameter             | Type                 | Default | Description |
| --------------------- | -------------------- | ------- | ----------- |
| `registry` (required) | `FormRegistry<I, L>` |         |             |

Returns `FormRegistry<I, L>`.

```ts
interface FormRegistry<I extends InputRegistry, L extends LayoutComponentRegistry>
```

What a form is drawn with: an input per kind, a layout per kind, and the wrappers.

| Member               | Type                     | Default | Description                                                                      |
| -------------------- | ------------------------ | ------- | -------------------------------------------------------------------------------- |
| `inputs` (required)  | `I`                      |         | The inputs a field may name, by kind.                                            |
| `layouts` (required) | `L`                      |         | The layouts a node may name, by kind; `{}` for none.                             |
| `field` (required)   | `FieldWrapperDefinition` |         | The wrapper drawn around every field.                                            |
| `root`               | `RootWrapperDefinition`  |         | The wrapper drawn around the whole form; without one, the fields are drawn bare. |
| `action`             | `ActionDefinition`       |         | The button drawn for a submit or reset node; without one, a plain `<button>`.    |

```ts
interface InputDefinition<TConfigResolved, TValue>
```

An input kind in a registry: the component that draws it, and the value it starts at.

| Member                 | Type                                                 | Default | Description                                                                               |
| ---------------------- | ---------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `Component` (required) | `ComponentType<InputProps<TConfigResolved, TValue>>` |         | The input, given the field's value, config and state.                                     |
| `defaultValue`         | `TValue`                                             |         | What a field of this kind starts at, when neither the field nor the form gives a default. |

```ts
interface LayoutComponentDefinition<TProps>
```

A layout kind in a registry: the component that draws it.

| Member                 | Type                                          | Default | Description                                                |
| ---------------------- | --------------------------------------------- | ------- | ---------------------------------------------------------- |
| `Component` (required) | `ComponentType<LayoutComponentProps<TProps>>` |         | The layout, given the node's props and its drawn children. |

```ts
interface LayoutComponentProps<TProps>
```

What a form gives the layout it draws for a layout node.

| Member                | Type        | Default | Description                                                    |
| --------------------- | ----------- | ------- | -------------------------------------------------------------- |
| `props` (required)    | `TProps`    |         | The node's props, as the form gives them: a card's title, say. |
| `children` (required) | `ReactNode` |         | The node's children, already drawn.                            |

```ts
interface FieldWrapperDefinition
```

A registry's field wrapper: the component drawn around every field.

| Member                 | Type                               | Default | Description                                                   |
| ---------------------- | ---------------------------------- | ------- | ------------------------------------------------------------- |
| `Component` (required) | `ComponentType<FieldWrapperProps>` |         | The wrapper: a label, the input, and its help or its problem. |

```ts
interface FieldWrapperProps
```

What a form gives the wrapper it draws around each field.

| Member                | Type        | Default | Description                                                                                                              |
| --------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name` (required)     | `string`    |         | The field's name in the form's values.                                                                                   |
| `label`               | `string`    |         | The field's label, from its definition.                                                                                  |
| `description`         | `string`    |         | Help text for the field, from its definition.                                                                            |
| `required` (required) | `boolean`   |         | Whether the field is required, from its definition.                                                                      |
| `error`               | `string`    |         | The field's validation message, once the field has been left or a submit tried.                                          |
| `descriptionId`       | `string`    |         | The id for the element that holds `description`, which the input is described by.                                        |
| `errorId`             | `string`    |         | The id for the element that holds `error`, or `configError`'s message: the input is described by it in the help's place. |
| `touched` (required)  | `boolean`   |         | Whether the reader has left the field yet.                                                                               |
| `loading` (required)  | `boolean`   |         | Whether the field's config is still resolving, as while its options load.                                                |
| `configError`         | `Error`     |         | Why the field's config failed to resolve, if it did.                                                                     |
| `children` (required) | `ReactNode` |         | The field's input, drawn from the registry.                                                                              |

```ts
interface RootWrapperDefinition
```

A registry's root wrapper: the component drawn around the whole form.

| Member                 | Type                              | Default | Description                        |
| ---------------------- | --------------------------------- | ------- | ---------------------------------- |
| `Component` (required) | `ComponentType<RootWrapperProps>` |         | The wrapper, given the drawn form. |

```ts
interface ActionDefinition
```

A registry's button: the component drawn for every submit and reset node.

| Member                 | Type                         | Default | Description                                          |
| ---------------------- | ---------------------------- | ------- | ---------------------------------------------------- |
| `Component` (required) | `ComponentType<ActionProps>` |         | The button, given what it does and the form's state. |

```ts
interface ActionProps
```

What a form gives the button it draws for a submit or reset node.

| Member                | Type                                | Default | Description                                                                            |
| --------------------- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `action` (required)   | `FormAction`: `'submit'`, `'reset'` |         | What it does: submit the form, or put its values back where they started.              |
| `label` (required)    | `string`                            |         | Its text, from the node.                                                               |
| `disabled` (required) | `boolean`                           |         | A reset with nothing to put back, and either while a submit runs.                      |
| `loading` (required)  | `boolean`                           |         | A submit running: the submit button shows it.                                          |
| `onClick`             | `() => void`                        |         | A reset's: puts the values back. A submit is a `type="submit"` button, and needs none. |
