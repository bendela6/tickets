---
title: FieldLabel
summary: "A field's caption: a label in uppercase, with a mark when the field is
  required."
related: [FieldError, FieldWrapper, Input]
---

[//]: # 'written from field-label.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FieldLabel

A field's caption: a `<label>` in uppercase, with a mark when the field is
required.

It is for a field laid out by hand. In a form drawn by `@bh/form`,
[FieldWrapper](../field-wrapper/field-wrapper.md) draws it for you.

## Import

```tsx
import { FieldLabel } from '@bh/ui';
```

## Examples

`htmlFor` ties the label to its control's `id`. `required` adds a red
asterisk.

**Required**

```tsx
import { useState } from 'react';
import { FieldLabel, Input } from '@bh/ui';

export function Required() {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  return (
    <div className="flex w-240 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor="name" required>
          Name
        </FieldLabel>
        <Input id="name" value={name} onChange={setName} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor="nickname">Nickname</FieldLabel>
        <Input id="nickname" value={nickname} onChange={setNickname} />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

It is a `<label>`: tied to a control by `htmlFor`, it is the control's
name, and clicking it focuses the control. The asterisk is part of the
label's text, so the name a screen reader reads ends in `*`.

## Props

| Prop        | Type        | Default | Description                          |
| ----------- | ----------- | ------- | ------------------------------------ |
| `required`  | `boolean`   |         | Adds a red asterisk after the label. |
| `className` | `string`    |         | Added to its own classes.            |
| `children`  | `ReactNode` |         |                                      |

Also every `<label>` attribute (`LabelHTMLAttributes<HTMLLabelElement>`), passed through.
