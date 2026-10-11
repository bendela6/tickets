---
title: FieldError
summary: A field's error message, in red, announced as an alert.
related: [FieldLabel, FieldWrapper, Input]
---

[//]: # 'written from field-error.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FieldError

A field's error message, in red, announced as an alert.

It is for a field laid out by hand. In a form drawn by `@bh/form`,
[FieldWrapper](../field-wrapper/field-wrapper.md) shows the error for you.

## Import

```tsx
import { FieldError } from '@bh/ui';
```

## Examples

Put it under the control. Give the control `tone="danger"`, which marks
it `aria-invalid`, and point its `aria-describedby` at the error's `id`.

**Under the field**

```tsx
import { useState } from 'react';
import { FieldError, FieldLabel, Input } from '@bh/ui';

export function UnderTheField() {
  const [key, setKey] = useState('Main Key');
  return (
    <div className="flex w-240 flex-col gap-4">
      <FieldLabel htmlFor="key" required>
        Key
      </FieldLabel>
      <Input id="key" value={key} onChange={setKey} tone="danger" aria-describedby="key-error" />
      <FieldError id="key-error">Use lowercase letters and dashes only</FieldError>
    </div>
  );
}
```

## Keyboard and accessibility

It is a `<p>` with `role="alert"`, so a screen reader announces it when
it appears. Other attributes, `id` among them, reach the `<p>`.

## Props

| Prop        | Type     | Default | Description               |
| ----------- | -------- | ------- | ------------------------- |
| `className` | `string` |         | Added to its own classes. |

Also every `<p>` attribute (`HTMLAttributes<HTMLParagraphElement>`), passed through.
