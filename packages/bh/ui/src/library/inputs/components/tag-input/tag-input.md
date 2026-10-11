---
title: TagInput
summary: Turns free text into tags, for values that don't exist until someone
  types them.
related: [MultiCombobox, Input]
---

[//]: # 'written from tag-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# TagInput

Turns free text into tags, for values that don't exist until someone
types them.

`value` is a `string[]` of the tags. Enter adds the draft, and so does
leaving the field. A tag that is already there, in any case, is refused:
a message names it, and its chip nudges once.

## Import

```tsx
import { TagInput } from '@bh/ui';
```

## Examples

Type a word and press Enter. Add "apple" again and it is refused; the
message clears on the next keystroke. Backspace in an empty draft removes
the last tag, but not while there is text to correct.

**Adding tags**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TagInput } from '@bh/ui';

export function AddingTags() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['apple', 'pear']);
  return (
    <div className="flex w-320 flex-col gap-6">
      <FieldLabel htmlFor={id}>Tags</FieldLabel>
      <TagInput id={id} value={tags} onChange={setTags} />
    </div>
  );
}
```

`suggestions` are offered under the field while you type, beside a button
that creates exactly what you typed. They save typing: any text is still
allowed. A suggestion already added is not offered again.

**With suggestions**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TagInput, type Option } from '@bh/ui';

const COLOURS: Option[] = [
  { value: 'red', label: 'red' },
  { value: 'green', label: 'green' },
  { value: 'blue', label: 'blue' },
  { value: 'yellow', label: 'yellow' },
];

export function WithSuggestions() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['red']);
  return (
    <div className="flex w-320 flex-col gap-6">
      <FieldLabel htmlFor={id}>Colours</FieldLabel>
      <TagInput id={id} suggestions={COLOURS} value={tags} onChange={setTags} />
    </div>
  );
}
```

`size` steps the field and its chips together. The field grows as the tags
wrap.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TagInput, type ControlSize } from '@bh/ui';

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['apple', 'pear']);
  return (
    <div className="flex w-320 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <div className="flex-1">
              <TagInput id={`${id}-${size}`} size={size} value={tags} onChange={setTags} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

`readOnly` drops the remove buttons and refuses new tags, and the field
keeps its tab stop. `disabled` also dims the field and takes it out of the
tab order.

**Disabled and read only**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TagInput } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['apple', 'pear']);
  return (
    <div className="flex w-320 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <TagInput id={`${id}-disabled`} disabled value={tags} onChange={setTags} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <TagInput id={`${id}-read-only`} readOnly value={tags} onChange={setTags} />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                        |
| ------------------ | ------------------------------------------- |
| `Enter`            | Adds the draft as a tag.                    |
| `Backspace`        | With an empty draft, removes the last tag.  |
| `Enter` or `Space` | On a chip's remove button, removes the tag. |

`id` goes to the text input, so a `<label htmlFor>` names it. The refusal
is a `role="alert"` message, and the input is `aria-invalid` while it
shows. Each chip's remove button is named "Remove" and the tag. `readOnly`
sets the input's `readonly`.

## When not to use it

To choose from a fixed list, use [MultiCombobox](../multi-combobox/multi-combobox.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default        | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suggestions`         | `Option[]`                                                                                                                                                                                                  | `[]`           | Existing tags to offer while typing. Free text is still allowed — these only save keystrokes and spelling.                                                                    |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Add a tag…'` | Shown in the field while there are no tags.                                                                                                                                   |
| `id`                  | `string`                                                                                                                                                                                                    |                | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |                | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string[]`                                                                                                                                                                                                  |                | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string[], event?: SyntheticEvent) => void`                                                                                                                                                         |                | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`         | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |                | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |                | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |                | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |                | Added to the control's own classes.                                                                                                                                           |
