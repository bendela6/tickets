---
title: Field
summary: 'A field laid out by hand: its label, its control, then a hint or an
  error, stacked.'
related: [FieldWrapper, FieldLabel, FieldError, Input]
---

[//]: # 'written from field.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Field

A field laid out by hand: its label, its control, then a hint or an
error, stacked.

It is for a form written as JSX, field by field. A form drawn by
`@bh/form` wraps its fields in [FieldWrapper](../field-wrapper/field-wrapper.md)
instead.

## Import

```tsx
import { Field } from '@bh/ui';
```

## Examples

`id` is the control's id, and the label is a
[FieldLabel](../field-label/field-label.md) for it. `hint` is the line
under the control, and `required` marks the label. The hint's id is
`<id>-hint`, for the control's `aria-describedby`.

**A field**

```tsx
import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function AField() {
  const [name, setName] = useState('');
  return (
    <Field
      id="project-name"
      label="Name"
      hint="Its files are named after it."
      required
      className="w-320"
    >
      <Input
        id="project-name"
        aria-describedby="project-name-hint"
        value={name}
        onChange={setName}
        placeholder="north-wing"
      />
    </Field>
  );
}
```

An `error` takes the hint's place, as a
[FieldError](../field-error/field-error.md) at `<id>-error`, so point
`aria-describedby` at whichever is shown and give the control
`tone="danger"`.

**With an error**

```tsx
import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function WithAnError() {
  const [name, setName] = useState('North Wing');
  const error = /^[a-z0-9-]*$/.test(name) ? undefined : 'Use lowercase letters, digits and dashes';
  return (
    <Field
      id="folder-name"
      label="Folder"
      hint="Lowercase, with dashes between words."
      error={error}
      className="w-320"
    >
      <Input
        id="folder-name"
        aria-describedby={error ? 'folder-name-error' : 'folder-name-hint'}
        value={name}
        onChange={setName}
        tone={error ? 'danger' : undefined}
      />
    </Field>
  );
}
```

With no `id` the label names a group of controls, each named by its own
`aria-label`: the field is a `role="group"` named by its caption and
described by the line under it.

**A group**

```tsx
import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function AGroup() {
  const [width, setWidth] = useState('1280');
  const [height, setHeight] = useState('720');
  return (
    <Field label="Size" hint="In pixels, the width then the height." className="w-320">
      <div className="flex items-center gap-8">
        <Input aria-label="Width" inputMode="numeric" value={width} onChange={setWidth} />
        <span aria-hidden className="text-13 text-gray-10">
          ×
        </span>
        <Input aria-label="Height" inputMode="numeric" value={height} onChange={setHeight} />
      </div>
    </Field>
  );
}
```

`className` reaches the field's own box, so a form gives each field the
width its value needs: an address wider than a port.

**Widths**

```tsx
import { useState } from 'react';
import { Field, Input } from '@bh/ui';

export function Widths() {
  const [host, setHost] = useState('files.example.com');
  const [port, setPort] = useState('8080');
  return (
    <div className="flex flex-wrap gap-12">
      <Field id="widths-host" label="Address" className="w-320 max-w-full">
        <Input id="widths-host" value={host} onChange={setHost} className="font-mono" />
      </Field>
      <Field id="widths-port" label="Port" className="w-96">
        <Input
          id="widths-port"
          inputMode="numeric"
          value={port}
          onChange={setPort}
          className="font-mono"
        />
      </Field>
    </div>
  );
}
```

## Keyboard and accessibility

With an `id`, the label is a `<label>` for the control, which it names,
and a click on it focuses the control. The asterisk is part of the
label's text. The control's own `aria-describedby` is the caller's:
`<id>-hint` or `<id>-error`. Without an `id`, the field names and
describes the group itself. An error is a `role="alert"`, announced when
it appears.

## Field or FieldWrapper

- **Field** is for a form laid out by hand. It always stacks, its hint
  can be any node, a link in it say, it can name a group, and a form
  gives it its width.
- **FieldWrapper** is the field slot of the registry `@bh/form` draws
  with. It takes the props the form gives a field, puts its label beside
  the control once the field is 520 pixels wide, and its description is
  a string.

## Props

| Prop                  | Type        | Default | Description                                                                                               |
| --------------------- | ----------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `id`                  | `string`    |         | The control's id: the label becomes its `<label>`. Left out, the label names a group of controls instead. |
| `label` (required)    | `ReactNode` |         | The field's caption, in uppercase above the control.                                                      |
| `hint`                | `ReactNode` |         | A line under the control: what goes in it, or what it does.                                               |
| `error`               | `ReactNode` |         | What is wrong with the value. Shown in the hint's place, in red, announced as an alert.                   |
| `required`            | `boolean`   |         | Adds a red asterisk after the label.                                                                      |
| `className`           | `string`    |         | Added to the field's classes: a width of its own, from the form.                                          |
| `children` (required) | `ReactNode` |         | The control, or the controls of a group.                                                                  |
