---
title: FieldWrapper
summary: 'Draws one form field: its label, its control, then its description or
  its error.'
related: [Field, FieldLabel, FieldError, Input]
---

[//]: # 'written from field-wrapper.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FieldWrapper

Draws one form field: its label, its control, then its description or its
error.

It is the `field` slot of the registry `@bh/form` draws a form with, so a
form wraps every field in it. It takes the props the form gives a field,
and draws the control it is given as its children. A form laid out by
hand uses [Field](../field/field.md).

## Import

```tsx
import { FieldWrapper } from '@bh/ui';
```

## Examples

The label is a [FieldLabel](../field-label/field-label.md) for `name`, so
the control takes `name` as its `id`. `required` marks the label, and
`description` sits under the control.

**Labelled field**

```tsx
import { useState } from 'react';
import { FieldWrapper, Input } from '@bh/ui';

export function LabelledField() {
  const [email, setEmail] = useState('');
  return (
    <div className="w-320">
      <FieldWrapper
        name="email"
        label="Email"
        description="Used to sign in."
        required
        touched={false}
        loading={false}
      >
        <Input id="email" type="email" value={email} onChange={setEmail} />
      </FieldWrapper>
    </div>
  );
}
```

An `error` takes the description's place, as a
[FieldError](../field-error/field-error.md), whatever `touched` says.
A `configError`, a config that failed to load, takes it before an
`error` does, with its own message. `touched` and `loading` change
nothing it draws. While `saving`, as when a form's `onCommit` saves the
field ([Draft, commit and submit](../../../../../../form/docs/draft-commit-submit.md)), it says
"Saving…" under the control.

**With an error**

```tsx
import { useState } from 'react';
import { FieldWrapper, Input } from '@bh/ui';

export function WithAnError() {
  const [city, setCity] = useState('');
  return (
    <div className="w-320">
      <FieldWrapper
        name="city"
        label="City"
        description="Where you live."
        error="Enter a city"
        required
        touched={false}
        loading={false}
      >
        <Input id="city" value={city} onChange={setCity} tone="danger" />
      </FieldWrapper>
    </div>
  );
}
```

Where the label goes depends on the field's own width, not the window's
(see [Layout](../../../../../docs/foundations/layout.md#containers)). From 520 pixels, it sits
beside the control in a 104-pixel column; below that, it sits on top. A
field with no `label` keeps the column empty, so its control lines up with
the others.

**Label beside**

```tsx
import { useState } from 'react';
import { FieldWrapper, Input } from '@bh/ui';

export function LabelBeside() {
  const [narrow, setNarrow] = useState('');
  const [wide, setWide] = useState('');
  return (
    <div className="flex flex-col gap-24">
      <div className="w-320">
        <FieldWrapper name="narrow" label="Name" required={false} touched={false} loading={false}>
          <Input id="narrow" value={narrow} onChange={setNarrow} />
        </FieldWrapper>
      </div>
      <div className="w-560">
        <FieldWrapper name="wide" label="Name" required={false} touched={false} loading={false}>
          <Input id="wide" value={wide} onChange={setWide} />
        </FieldWrapper>
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

The label is a `<label>` for `name`, so it names the control whose `id`
is `name`. The error is a `role="alert"`, announced when it appears;
"Saving…" is a `role="status"`.

The description takes `descriptionId` and the error `errorId`, and a
form gives the control `aria-describedby` pointing at whichever is
drawn, so a screen reader reads it with the control. Used outside a form,
pass the ids and point the control's `aria-describedby` at them
yourself.

## Props

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
