---
title: Validation and valibot
summary: Check each field's value with a schema, check the fields against each
  other, and build a whole form from a valibot schema.
order: 8
related: [Rendering and submitting, Building a form, Visibility]
---

[//]: # 'written from validation.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Validation and valibot

Check each field's value with a schema, check the fields against each
other, and build a whole form from a valibot schema.

## A field's check

A field's `validate` is any [Standard Schema](https://standardschema.dev):
valibot's, zod's, arktype's. Its first issue's message is the field's
problem, which the field wrapper draws. The builder takes no `validate`,
so it is added to the node the builder returns:

**Field checks**

```tsx
import { useState } from 'react';
import * as v from 'valibot';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

// The builder takes no `validate`: a field gets one as a key of its node.
const booking = defineForm(registry).build((b) => {
  return [
    {
      ...b.text({
        name: 'email',
        label: 'Email',
        required: true,
        config: {},
      }),
      validate: v.pipe(v.string(), v.nonEmpty('Enter an email.'), v.email('That is not an email.')),
    },
    {
      ...b.number({
        name: 'seats',
        label: 'Seats',
        required: true,
        config: { min: 1, max: 8 },
      }),
      validate: v.pipe(
        v.number('Enter how many.'),
        v.integer('Whole seats only.'),
        v.minValue(1, 'At least one.'),
        v.maxValue(8, 'Eight at most.'),
      ),
    },
    b.actions({}, [b.submit({ label: 'Book' })]),
  ];
});

export function FieldChecks() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={booking} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
```

The checks run when a field is left and on submit, over every field on
screen, and a submit with any problem doesn't call `onSubmit`. A field
shows its problem once it has been left, or once a submit has been
tried, so one the reader hasn't reached stays quiet. An untouched field
is checked at its starting value, `''` or `null`, so its schema's own
message is the one shown.

## Across fields

A rule about more than one field goes in the form's `schema`, given to
`build` beside the nodes (`<Form schema>` takes its place), which runs
on the visible fields' values once each field's own check has. An issue
whose path is one field is shown on that field, unless it has a problem
of its own; any other is the form-level error, which `renderFormError`
draws above the fields.

**Checks across fields**

```tsx
import { useState } from 'react';
import * as v from 'valibot';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldError, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

const rules = v.pipe(
  v.object({ email: v.string(), phone: v.string(), password: v.string(), repeat: v.string() }),
  // Names no one field: the form-level error.
  v.check((x) => Boolean(x.email || x.phone), 'Give an email or a phone number.'),
  // Forwarded to one field: shown on it.
  v.forward(
    v.check((x) => x.password === x.repeat, 'The two passwords differ.'),
    ['repeat'],
  ),
);

const account = defineForm(registry).build(
  (b) => {
    return [
      b.text({
        name: 'email',
        label: 'Email',
        config: {},
      }),
      b.text({
        name: 'phone',
        label: 'Phone',
        config: {},
      }),
      b.password({
        name: 'password',
        label: 'Password',
        config: {},
      }),
      b.password({
        name: 'repeat',
        label: 'Repeat it',
        config: {},
      }),
      b.actions({}, [b.submit({ label: 'Create' })]),
    ];
  },
  { schema: rules },
);

export function ChecksAcrossFields() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form
          form={account}
          onSubmit={setSent}
          renderFormError={(message) => <FieldError>{message}</FieldError>}
        />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
```

`v.forward` gives an issue its path. With `useStandaloneForm`, the
form-level error is its `formError`.

## From a valibot schema

`schemaToFormConfig`, from `@bh/form/valibot`, builds a form from a
valibot object schema: a field per entry, in order, with the entry
itself as its `validate`.

**From a schema**

```tsx
import { useState } from 'react';
import * as v from 'valibot';
import { defineRegistry, Form, FormProvider } from '@bh/form';
import { schemaToFormConfig } from '@bh/form/valibot';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const Member = v.object({
  name: v.pipe(v.string(), v.title('Name'), v.nonEmpty('Enter a name.')),
  email: v.pipe(v.string(), v.title('Email'), v.email('That is not an email.')),
  plan: v.pipe(v.picklist(['free', 'team', 'studio'], 'Pick a plan.'), v.title('Plan')),
  seats: v.nullish(v.pipe(v.number(), v.title('Seats'), v.minValue(1, 'At least one.'))),
  labels: v.pipe(v.array(v.string()), v.title('Labels')),
  notes: v.optional(
    v.pipe(
      v.string(),
      v.title('Notes'),
      v.description('Seen by the team only.'),
      v.metadata({ input: 'textarea' }),
    ),
  ),
});

const member = schemaToFormConfig(Member);

export function FromASchema() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={member} onSubmit={setSent}>
          <div className="mt-16">
            <Button type="submit" variant="solid">
              Add
            </Button>
          </div>
        </Form>
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
```

Each entry's input is inferred from its type:

| Entry                                   | Input                                           |
| --------------------------------------- | ----------------------------------------------- |
| `string`                                | `text`, or `email` if piped through `v.email()` |
| `number`, `boolean`, `date`             | `number`, `checkbox`, `date`                    |
| `picklist`, `enum`                      | `select`, its options the schema's values       |
| `array(string)`                         | `tags`                                          |
| `array(picklist)`                       | `multi-select`, with its options                |
| `array(object)`                         | `list`, each item a form of the object's own    |
| `object`, `strictObject`, `looseObject` | `object`, its fields a form of its own          |
| anything else                           | `text`                                          |

- `optional`, `nullish` and `nullable` are seen through, and make the
  field not required.
- In an entry's pipe, `v.title()` is its label and `v.description()` its
  help. `v.metadata({ input: 'textarea' })` picks its input, or
  `{ input: { type, config } }` with a config too.
- The second argument, `overrides`, sets a field's `label`,
  `description`, `type` or `config` by name, over all of that.

## Rules

- A hidden field's check doesn't run, and the cross-field schema is given
  the visible fields only.
- A field's problem is a string: its schema's first issue's message.
- `required` marks a label and checks nothing; a schema's
  `v.nonEmpty()` does.
- A field's own problem wins over one the cross-field schema gives it.
- A problem stays until the next check: leaving a field, or a submit.
- The cross-field schema's problem that belongs to no field shows from
  the first submit on.
- Inside a list's item or an object, each field's check runs once it is
  left, and only a schema that answers at once: an async one is skipped.

## Reference

```ts
schemaToFormConfig<R extends InputRegistry = InputRegistry>(schema, overrides?)
```

A form from a valibot object schema: a field per entry, its input inferred
from the entry's type and the entry itself as its `validate`. `overrides`
set a field's `label`, `description`, `type` or `config` by name, over
what is inferred. Its nodes are fields only.

| Parameter           | Type                                                                                                                | Default | Description |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| `schema` (required) | `unknown`                                                                                                           |         |             |
| `overrides`         | `Record< string, Partial<{ label: string; description: string; type: string; config: Record<string, unknown>; }> >` | `{}`    |             |

Returns `Omit<FormConfig<R>, 'nodes'> & { nodes: FieldNode<R>[] }`.
