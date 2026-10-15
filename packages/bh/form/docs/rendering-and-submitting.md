---
title: Rendering and submitting
summary: Draw a form, start it with values, take what it submits, and submit it
  from a button outside it.
order: 4
related: [Building a form, Validation and valibot, Visibility]
---

[//]: # 'written from rendering-and-submitting.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Rendering and submitting

Draw a form, start it with values, take what it submits, and submit it
from a button outside it.

## Drawing a form

`<Form form={…}>` draws the form inside a `<form>` with the registry
the app's [`FormProvider`](registry.md#one-registry-for-the-app)
gives it, and holds the values. Its buttons are nodes of the form like
its fields: [`b.submit()`](building-a-form.md#buttons) submits,
as does Enter in a one-line field, and `b.reset()` puts the values
back. `onSubmit` is then called with the values, once every
[check](validation.md) passes. A form that saves each field as it
commits takes `onCommit` instead, or as well:
[Draft, commit and submit](draft-commit-submit.md).

`<Form>`'s children are drawn inside the `<form>` after the fields, for
anything else: a button the registry's doesn't suit, or a line that reads
a value.

## Starting values

A field starts at `<Form defaultValues>` for its name, else the form's
own (`build`'s `defaultValues`), else its own `defaultValue`, else its
input's from the registry. Here the title comes from `<Form>`, the pages
from the field, and the labels from the input: `[]`, which `tags` draws
as empty.

**Starting values**

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

const report = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      config: {},
    }),
    b.number({
      name: 'pages',
      label: 'Pages',
      defaultValue: 1,
      config: { min: 1 },
    }),
    b.tags({
      name: 'labels',
      label: 'Labels',
      config: { placeholder: 'Add a label' },
    }),
    b.actions({}, [b.submit({ label: 'Submit' })]),
  ];
});

export function StartingValues() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={report} defaultValues={{ title: 'Quarterly report' }} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
```

While a submit is checking the values and running `onSubmit`, every input
is disabled. A submit first waits for the
[async options](async-options.md) of the fields on screen.

## Values from outside

A form whose value lives elsewhere, as a filter's lives in the address,
takes it as `<Form values>`: Back, or another part of the page, changes
it, and the form follows. Each time `values` changes, compared by what it
holds rather than by identity, so the same value handed back after a
commit is no change, the fields take it, without a remount and without
running `onCommit`. A field being typed in keeps its draft, and commits
it when it would have. `defaultValues` stays where the form started, so a
reset still goes there. `useStandaloneForm` takes `values` too.

**Values from outside**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const filters = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      config: { commit: 'leave' },
    }),
    b.segmented({
      name: 'status',
      label: 'Status',
      config: {
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ],
      },
    }),
  ];
});

// The page holds the value, as an address would: the form follows it, and
// tells the page of each change it commits.
export function ValuesFromOutside() {
  const [value, setValue] = useState<Record<string, unknown>>({ title: '', status: 'open' });
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form
          form={filters}
          values={value}
          onCommit={(_, values) => setValue((now) => ({ ...now, ...values }))}
        />
        <div className="flex gap-8">
          <Button variant="ghost" onClick={() => setValue({ title: '', status: 'closed' })}>
            Back to closed
          </Button>
        </div>
        <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(value)}</pre>
      </div>
    </FormProvider>
  );
}
```

## A button outside the form

A Save button in a dialog's footer, or a page's header, sits outside the
form. `useStandaloneForm` holds the form instead, given the form and
`onSubmit` (and the provider's registry, so it is called under the
provider); `<Form formApi>` draws it, and its `submit`, `reset`,
`isDirty` and `isSubmitting` are yours to use. `isDirty` means
committed but not submitted, so it's false again after a Save.

**Button outside the form**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider, useStandaloneForm } from '@bh/form';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const settings = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      defaultValue: 'Studio',
      config: {},
    }),
    b.select({
      name: 'zone',
      label: 'Time zone',
      defaultValue: 'utc',
      config: {
        options: [
          { value: 'utc', label: 'UTC' },
          { value: 'tbilisi', label: 'Tbilisi (UTC+4)' },
          { value: 'lisbon', label: 'Lisbon (UTC+0/+1)' },
        ],
      },
    }),
    b.toggle({
      name: 'listed',
      label: 'Listed',
      config: { label: 'Listed' },
    }),
  ];
});

export function ButtonOutsideTheForm() {
  return (
    <FormProvider registry={registry}>
      <SettingsPanel />
    </FormProvider>
  );
}

// Under the provider, so the hook finds the registry as the form does.
function SettingsPanel() {
  const [saved, setSaved] = useState<Record<string, unknown>>();
  const api = useStandaloneForm({ form: settings, onSubmit: setSaved });
  return (
    <div className="flex w-full max-w-400 flex-col gap-16">
      <Form formApi={api} />
      <div className="border-gray-6 flex items-center gap-8 border-t-1 pt-12">
        <span className="text-12/17 text-gray-11 flex-1 font-sans">
          {api.isDirty ? 'Unsaved changes' : 'No changes'}
        </span>
        <Button variant="ghost" disabled={!api.isDirty} onClick={() => api.reset()}>
          Reset
        </Button>
        <Button
          variant="solid"
          disabled={!api.isDirty}
          loading={api.isSubmitting}
          onClick={() => void api.submit()}
        >
          Save
        </Button>
      </div>
      {saved ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(saved)}</pre> : null}
    </div>
  );
}
```

The form, `defaultValues`, `onSubmit` and the cross-field `schema` go to
the hook, not to `<Form>`, whose types refuse them beside `formApi`.

## Reading a value

Anything drawn inside `<Form>` (its children, an input, a layout) can
read a field's value as it changes with `useFieldValue`.

**Reading a value**

```tsx
import { defineForm, defineRegistry, Form, FormProvider, useFieldValue } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const card = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      config: {},
    }),
    b.textarea({
      name: 'bio',
      label: 'Bio',
      config: { rows: 3 },
    }),
  ];
});

// Drawn inside <Form>, so it can read the values as they change.
function Preview() {
  const name = useFieldValue<string>('name');
  const bio = useFieldValue<string>('bio');
  return (
    <p className="text-12/17 text-gray-11 mt-12 font-sans">
      Hello, {name || 'stranger'}. Your bio is {bio.length} of 160 characters.
    </p>
  );
}

export function ReadingAValue() {
  return (
    <FormProvider registry={registry}>
      <div className="w-full max-w-360">
        <Form form={card}>
          <Preview />
        </Form>
      </div>
    </FormProvider>
  );
}
```

## Rules

- `onSubmit` is given the visible fields' values only; a hidden field
  keeps its value in the form, and has it back when it shows again.
- `<Form formApi>` draws the form the hook holds and never builds a
  second one, so both see the same values, checks and loading options.
- `useFieldValue` throws outside a `<Form>`.
- `reset` puts every value back where it started, or to what was last
  submitted; never to `values`, which the form follows but didn't start
  at.
- Both buttons wait while a submit runs, and a reset waits for a change
  to put back.

## Reference

| Prop              | Type                                                         | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry`        | `FormRegistry<I, L>`                                         |         | The inputs, layouts and wrappers it is drawn with: the nearest `FormProvider`'s when omitted, which is how an app gives every form one.                                                                                                                                                                                                                                                                                   |
| `renderFormError` | `(msg: string) => ReactNode`                                 |         | Draws the form-level error: what the cross-field `schema` finds that names no one field. Drawn above the fields, only while there is one.                                                                                                                                                                                                                                                                                 |
| `slots`           | `Readonly<Record<string, ReactNode>>`                        |         | What the form's slot nodes hold, by name, each drawn where its node sits: a count, a button of the app's. A slot given nothing draws nothing.                                                                                                                                                                                                                                                                             |
| `children`        | `ReactNode`                                                  |         | Drawn inside the `<form>`, after the fields: anything that reads a value with `useFieldValue`, or a button the form's own `b.submit()` cannot be.                                                                                                                                                                                                                                                                         |
| `form`            | `FormConfig<I, L>`                                           |         | The form: its fields, layouts and buttons, as `defineForm` builds it.                                                                                                                                                                                                                                                                                                                                                     |
| `defaultValues`   | `Record<string, unknown>`                                    |         | Values to start at, by field name, over the form's and each field's own.                                                                                                                                                                                                                                                                                                                                                  |
| `values`          | `Record<string, unknown>`                                    |         | Values from outside that the form follows, by field name, apart from where it started: an address's, after Back. Each time they change, compared by what they hold, so the same value handed back after a commit is no change, the fields take them, without a remount and without running `onCommit`; a field being typed in keeps its draft. `defaultValues` stays where the form started, so a reset still goes there. |
| `onSubmit`        | `(values: Record<string, unknown>) => void \| Promise<void>` |         | Called on submit, once every check passes, with the visible fields' values.                                                                                                                                                                                                                                                                                                                                               |
| `onCommit`        | `OnCommit`                                                   |         | Called each time a field commits, with what changed (`{ field, value, previous }`) and the visible fields' values after it: a form that saves as you go saves here. While a promise it returns runs, the field shows it's saving; if it fails, the field keeps the value and shows the error.                                                                                                                             |
| `commit`          | `Commit`                                                     |         | When the fields commit: `'change'` (the default) at every keystroke, `'leave'` on Enter and on leaving the field, `{ after: 800 }` on those and after a pause. Over the form's own; a field's config may say otherwise.                                                                                                                                                                                                   |
| `schema`          | `StandardSchemaV1`                                           |         | A check across fields, run on the visible fields' values after each field's own, in place of the form's own. Only without `formApi`: with it, the schema goes to `useStandaloneForm`.                                                                                                                                                                                                                                     |
| `formApi`         | `FormApi`                                                    |         | The form `useStandaloneForm` holds, to draw instead of one of its own: the hook was given the form, its `defaultValues`, `onSubmit` and `schema`.                                                                                                                                                                                                                                                                         |

```ts
useStandaloneForm<R extends InputRegistry, L extends LayoutComponentRegistry = LayoutComponentRegistry>(options)
```

Holds a form outside `<Form>`, for a Save button, a dirty marker or a reset
of your own: pass what it returns to `<Form formApi>` to draw it.

| Parameter                 | Type                                                         | Default | Description                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)      | `UseStandaloneFormOptions<R, L>`                             |         |                                                                                                                                                                            |
| `options.form` (required) | `FormConfig<R, L>`                                           |         | The form, as `defineForm` builds it: `<Form formApi>` draws it.                                                                                                            |
| `options.registry`        | `FormRegistry<R, L>`                                         |         | The registry the form is drawn with: a field with no default of its own starts at its input's `defaultValue`. The nearest `FormProvider`'s when omitted, as `<Form>`'s is. |
| `options.defaultValues`   | `Record<string, unknown>`                                    |         | Values to start at, by field name, over the form's and each field's own.                                                                                                   |
| `options.values`          | `Record<string, unknown>`                                    |         | Values from outside that the form follows, apart from where it started. See `<Form values>`.                                                                               |
| `options.onSubmit`        | `(values: Record<string, unknown>) => void \| Promise<void>` |         | Called on submit, once every check passes, with the visible fields' values.                                                                                                |
| `options.onCommit`        | `OnCommit`                                                   |         | Called each time a field commits, with what changed and the visible fields' values after it. See `<Form onCommit>`.                                                        |
| `options.commit`          | `Commit`                                                     |         | When the fields commit, over the form's own `commit`. See `<Form commit>`.                                                                                                 |
| `options.schema`          | `StandardSchemaV1`                                           |         | Optional cross-field schema run against the visibility-stripped values after per-field validators. See `UseFormOptions['schema']`.                                         |

Returns `FormApi`.

```ts
interface UseStandaloneFormOptions<R extends InputRegistry, L extends LayoutComponentRegistry = LayoutComponentRegistry>
```

`useStandaloneForm`'s options: the form, its registry, and what to do on submit.

| Member            | Type                                                         | Default | Description                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form` (required) | `FormConfig<R, L>`                                           |         | The form, as `defineForm` builds it: `<Form formApi>` draws it.                                                                                                            |
| `registry`        | `FormRegistry<R, L>`                                         |         | The registry the form is drawn with: a field with no default of its own starts at its input's `defaultValue`. The nearest `FormProvider`'s when omitted, as `<Form>`'s is. |
| `defaultValues`   | `Record<string, unknown>`                                    |         | Values to start at, by field name, over the form's and each field's own.                                                                                                   |
| `values`          | `Record<string, unknown>`                                    |         | Values from outside that the form follows, apart from where it started. See `<Form values>`.                                                                               |
| `onSubmit`        | `(values: Record<string, unknown>) => void \| Promise<void>` |         | Called on submit, once every check passes, with the visible fields' values.                                                                                                |
| `onCommit`        | `OnCommit`                                                   |         | Called each time a field commits, with what changed and the visible fields' values after it. See `<Form onCommit>`.                                                        |
| `commit`          | `Commit`                                                     |         | When the fields commit, over the form's own `commit`. See `<Form commit>`.                                                                                                 |
| `schema`          | `StandardSchemaV1`                                           |         | Optional cross-field schema run against the visibility-stripped values after per-field validators. See `UseFormOptions['schema']`.                                         |

```ts
interface FormApi
```

A form held outside `<Form>`: its state, and what a button of its own can do.

| Member                    | Type                                                                                                                                                                   | Default | Description                                                                                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isDirty` (required)      | `boolean`                                                                                                                                                              |         | Whether the form holds committed values it hasn't submitted: they differ from what was last submitted, or from where it started. What "Unsaved changes", a Save button and a warning on leaving the page go by. Never, in a form with no `onSubmit`: it saves as it goes. |
| `hasDrafts` (required)    | `boolean`                                                                                                                                                              |         | Whether a field holds a draft it hasn't committed yet, as while it's typed in at `commit: 'leave'`. A Save is worth pressing then too: it commits the draft first.                                                                                                        |
| `isSubmitting` (required) | `boolean`                                                                                                                                                              |         | Whether a submit is checking the values or running `onSubmit`.                                                                                                                                                                                                            |
| `isValid` (required)      | `boolean`                                                                                                                                                              |         | Whether the last check found no problem; true until a check runs.                                                                                                                                                                                                         |
| `formError` (required)    | `string`                                                                                                                                                               |         | The current top-level form error, if any. Populated when a top-level `schema` produces issues whose path is empty or multi-segment (i.e. they cannot be attributed to a single field). Cleared once validation passes.                                                    |
| `submit` (required)       | `() => Promise<void>`                                                                                                                                                  |         | Submits as the form's own submit button would: commits the drafts (a Save while typing loses nothing), waits for async config and for commits still saving, checks, then calls `onSubmit`.                                                                                |
| `reset` (required)        | `(options?: ResetOptions) => void`                                                                                                                                     |         | Puts every value back to what was last submitted, else to where it started; with `{ to: 'start' }`, always to where it started.                                                                                                                                           |
| `getValues` (required)    | `() => Record<string, unknown>`                                                                                                                                        |         | Every value now, hidden fields' too.                                                                                                                                                                                                                                      |
| `__internals` (required)  | `{ form: unknown; cache: ResolverCache; config: FormConfig<InputRegistry, LayoutComponentRegistry>; commits: Commits; commit?: Commit; submit: () => Promise<void>; }` |         | What `<Form formApi>` draws from; not for an app's own code.                                                                                                                                                                                                              |

```ts
useFieldValue<T = unknown>(name: string): T
```

A field's value as it is edited, for anything drawn inside `<Form>` (its
children, an input, a layout). Throws outside one.

| Parameter         | Type     | Default | Description |
| ----------------- | -------- | ------- | ----------- |
| `name` (required) | `string` |         |             |

Returns `T`.
