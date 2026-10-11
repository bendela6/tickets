---
title: Overview
summary: Describe a form as data and @bh/form draws it with the inputs you register.
order: 1
related: [The registry, Building a form, Instrument's bindings]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

Describe a form as data, its fields, their layout and when each one shows,
and `@bh/form` draws it with the inputs you register.

## Import

```tsx
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';
```

## A first form

A registry names the inputs a form may use, and `@bh/ui` supplies a full
set. The form is built against it, so a field of a kind the registry
lacks fails as you write it. Pick Phone to see `when` at work, then send:
only the fields on screen are sent.

**Contact**

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

const contact = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'name',
      label: 'Name',
      config: {},
    }),
    b.radio({
      name: 'reach',
      label: 'Reach me by',
      defaultValue: 'email',
      config: {
        options: [
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Phone' },
        ],
      },
    }),
    b.text({
      name: 'email',
      label: 'Email',
      when: { field: 'reach', eq: 'email' },
      config: { placeholder: 'name@example.com' },
    }),
    b.text({
      name: 'phone',
      label: 'Phone',
      when: { field: 'reach', eq: 'phone' },
      config: {},
    }),
    b.actions({}, [b.submit({ label: 'Send' })]),
  ];
});

export function Contact() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={contact} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
```

## The parts

1. **[A registry](registry.md)**: an input per kind (`text`, `select`,
   `date`), a layout per kind (`card`, `row`), the wrapper drawn around
   each field and the one around the form. `@bh/ui`'s are
   [Instrument's bindings](bindings.md).
2. **[A form](building-a-form.md)**: its fields, layouts and buttons as a tree
   of nodes, written with the builder `defineForm` hands you, or as plain
   data. Each field may show only [when](visibility.md) other fields
   hold certain values, load its options
   [from elsewhere](async-options.md), and
   [check its value](validation.md).
3. **[`<Form>`](rendering-and-submitting.md)**: draws the form with the
   registry the app's `FormProvider` gives every form, holds its values,
   and submits them.

The package draws no inputs of its own, so a form's data says nothing of
how it looks: a new design system is a new registry, not a new form.
[Writing an input](writing-an-input.md) adds a kind to one.

## Rules

- A field shows while its own `when` holds and every layout above it
  shows.
- Submitting sends the visible fields only.
- A field's name is its key in the values, unique across the whole form,
  layouts and all.
- The package draws nothing itself: every field, layout and wrapper comes
  from the registry.
