---
title: The toolbar
summary: The controls an editor's features make, above its text, one tab stop
  with the arrows along it.
order: 4
related: [RichTextEditor, The composer, Menu]
---

[//]: # 'written from toolbar.doc.yaml by pnpm docs:sync; edit that file, not this one'

# The toolbar

The controls an editor's features make, above its text, one tab stop
with the arrows along it.

The editor draws it while its text can be edited, never while disabled
or read-only. It is made from the features, so an editor with a few
has a short one, and one whose features make no control (a table,
alignment) has none.

## Examples

Marks, a link and lists: the editor's toolbar is the controls of
`['marks', 'link', 'lists']`, with the rest of the marks (highlight and
colour) under "More formatting".

**A few features**

```tsx
import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

export function AFewFeatures() {
  const [caption, setCaption] = useState('A *quiet* street at dawn.');
  return (
    <RichTextEditor
      label="Caption"
      features={['marks', 'link', 'lists']}
      value={caption}
      onChange={setCaption}
    />
  );
}
```

Every control: all the features, the app suggesting people (so `@` is
there) and uploading images (so Image is).

**Every control**

```tsx
import { useState } from 'react';
import { RichTextEditor, type SuggestionSource, type UploadImage } from '@bh/richtext/editor';

const PEOPLE = ['Ana Costa', 'Rui Lima', 'Inês Rocha'];

const people: SuggestionSource = {
  label: 'People',
  items: (query) => {
    return PEOPLE.filter((name) => name.toLowerCase().includes(query.toLowerCase())).map(
      (name) => ({ id: name, label: name }),
    );
  },
};

// Read the file in place of an upload, for the example.
const upload: UploadImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
};

export function EveryControl() {
  const [notes, setNotes] = useState('');
  return (
    <RichTextEditor
      label="Notes"
      features="full"
      suggestions={{ mention: people }}
      uploadImage={upload}
      value={notes}
      onChange={setNotes}
      placeholder="Every control the toolbar has…"
    />
  );
}
```

## The controls

The groups run in this order, a separator between each.

| Group    | Controls                                                                         | From                                       |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| Block    | The text style: paragraph, H1, H2, H3                                            | `headings`                                 |
| Marks    | Bold, italic, underline, strike, inline code                                     | `marks`                                    |
| Link     | Link, and `@` to mention                                                         | `link`; `mentions`, with people to suggest |
| Lists    | Bulleted, numbered and task lists                                                | `lists`, `taskList`                        |
| Blocks   | Quote, code block                                                                | `blockquote`, `codeBlock`                  |
| Insert   | Image                                                                            | `image`, with an upload                    |
| Overflow | "More formatting": highlight, text colour, callout, collapsible section, divider | `marks`, `callout`, `details`, `divider`   |

A mark or a block is a toggle, pressed while it is on at the selection.
A command with several kinds is a `Menu`: the text style, the list
(one toggle when the editor has a single kind), and "More formatting",
whose text colour and callout are submenus. A text colour is a token
(`var(--color-red-9)`), so a coloured word follows the theme.

## The link popup

With the `link` feature, the toolbar's Link and ⌘K (Ctrl+K) open the
link popup, a `Popover` anchored at the selection, or at the whole link
the caret is in. Enter applies the address (`example.com` becomes
`https://example.com`), an empty one takes the link away, and with
nothing selected the address goes in as its own linked text. Escape
closes it, and the focus goes back to the text. While the caret sits in
a link, a small popover under it shows where it goes, with Edit and
Remove, and leaves the focus in the text.

## Keyboard and accessibility

The toolbar is a `toolbar` named Formatting, and one tab stop, before
the text: the control last focused, or the first. The arrows move along
it, wrapping at its ends, and Home and End go to them. A control pressed
with the pointer leaves the focus in the text, so the selection stays
drawn; pressed with the keys, it keeps it, so several can be pressed in
a row and Tab goes on into the text. A toggle says `aria-pressed`, and a
menu's button `aria-haspopup`.

## Rules

- A control whose action the editor doesn't have isn't drawn, whatever
  the features say: no `@` without people to suggest, no Image without
  an upload.
- In a [composer](composer.md), the toolbar moves to a row under
  the text, beside the submit button.
