---
title: Visibility
summary: Show a field, or a whole layout, only while other fields hold certain
  values, with when.
order: 6
related: [Building a form, Rendering and submitting, Async options]
---

[//]: # 'written from visibility.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Visibility

Show a field, or a whole layout, only while other fields hold certain
values.

## A clause

A node's `when` is a clause about other fields' values, by name. It
compares one field's value, or combines clauses:

| Clause                      | Holds when                        |
| --------------------------- | --------------------------------- |
| `{ field, eq: value }`      | the field's value is `value`      |
| `{ field, neq: value }`     | the field's value is not `value`  |
| `{ field, in: [a, b] }`     | the field's value is one of these |
| `{ field, truthy: true }`   | the field's value is truthy       |
| `{ all: [clause, clause] }` | every clause holds                |
| `{ any: [clause, clause] }` | at least one clause holds         |
| `{ not: clause }`           | the clause doesn't                |

Here the address card shows for courier and post, the intercom switch
for courier only, and its code once the switch is on as well:

**Delivery**

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

const delivery = defineForm(registry).build((b) => {
  return [
    b.segmented({
      name: 'method',
      label: 'Delivery',
      defaultValue: 'pickup',
      config: {
        options: [
          { value: 'pickup', label: 'Pickup' },
          { value: 'courier', label: 'Courier' },
          { value: 'post', label: 'Post' },
        ],
      },
    }),
    // The card, and everything in it, shows for courier and post.
    b.card({ title: 'Address', when: { field: 'method', in: ['courier', 'post'] } }, [
      b.text({
        name: 'street',
        label: 'Street',
        config: {},
      }),
      b.text({
        name: 'city',
        label: 'City',
        config: {},
      }),
      b.toggle({
        name: 'intercom',
        label: 'Intercom',
        when: { field: 'method', eq: 'courier' },
        config: { label: 'Has an intercom' },
      }),
      b.text({
        name: 'code',
        label: 'Intercom code',
        when: {
          all: [
            { field: 'method', eq: 'courier' },
            { field: 'intercom', truthy: true },
          ],
        },
        config: {},
      }),
    ]),
    b.actions({}, [b.submit({ label: 'Submit' })]),
  ];
});

export function Delivery() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-400 flex-col gap-12">
        <Form form={delivery} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
```

## Layouts

A layout's `when` shows or hides it with everything in it. A field shows
while its own `when` holds and every layout above it shows, so the
intercom code above needs no clause about the method's being courier or
post: its card's has one.

## What a hidden field keeps

A hidden field keeps its value: pick Courier, type a street, pick
Pickup and back, and the street is still there. But a submit leaves it
out, its own check doesn't run, and its async options don't hold the
submit up. What is sent is what is on screen.

## In your own code

`evaluateWhen` answers a clause for some values, the way the form does,
for code of your own that needs the same answer:

```tsx
import { evaluateWhen, type WhenClause } from '@bh/form';

const courier: WhenClause = { field: 'method', eq: 'courier' };
evaluateWhen(courier, { method: 'post' }); // false
```

## Rules

- `eq`, `neq` and `in` compare with `===`: an array or an object is equal
  only to itself.
- `truthy` is JavaScript's own: `''`, `0`, `null` and `false` are not,
  but an empty array is, so a multi-select with nothing chosen is truthy.
- A clause reads the fields beside it: at the top level, the form's; in
  a list's item or an object, that object's own.
- A node redraws only when a field its clause names changes.

## Reference

```ts
type WhenClause = …
```

When a node shows, from other fields' values: one field's value compared
(`eq`, `neq`, `in`, `truthy`), or clauses combined (`all`, `any`, `not`).

```ts
evaluateWhen(clause: WhenClause, values: Record<string, unknown>): boolean
```

Whether a clause holds for these values, as the form decides whether a node
shows. `eq`, `neq` and `in` compare with `===`; `truthy` with `Boolean`.

| Parameter           | Type                      | Default | Description |
| ------------------- | ------------------------- | ------- | ----------- |
| `clause` (required) | `WhenClause`              |         |             |
| `values` (required) | `Record<string, unknown>` |         |             |

Returns `boolean`.
