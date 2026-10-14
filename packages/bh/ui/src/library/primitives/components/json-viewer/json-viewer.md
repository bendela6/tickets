---
title: JsonViewer
summary: Reads a JSON document, folded and numbered, and edits it when given an
  `onChange`.
related: [useCopy, Prose]
---

[//]: # 'written from json-viewer.doc.yaml by pnpm docs:sync; edit that file, not this one'

# JsonViewer

Reads a JSON document, and edits it when given an `onChange`.

Pass `value` for something already parsed, or `source` for text. Text is
parsed here, and text that will not parse is shown as it came, with the
line and column where it stopped.

## Import

```tsx
import { JsonViewer } from '@bh/ui';
```

## Examples

The document is pretty-printed, coloured by kind and numbered. Every
container folds at its chevron, and Alt-click folds or opens its whole
branch. The line numbers are the document's, so they skip across a fold.
Copy, in the toolbar, copies the whole document unfolded, and turns to a
check, or to a cross when the browser refused.

A value JSON has no spelling for (`undefined`, `NaN`, a function) is drawn
in red rather than dropped, and a cycle reads `[Circular]`.

**Reading**

```tsx
import { JsonViewer } from '@bh/ui';

const CITY = {
  name: 'Lisbon',
  country: 'Portugal',
  population: 545796,
  coastal: true,
  twin: null,
  districts: ['Alfama', 'Baixa', 'Belém'],
  weather: { month: 'June', highC: 27, lowC: 17 },
};

export function Reading() {
  return <JsonViewer value={CITY} label="lisbon.json" maxHeight={320} />;
}
```

`defaultExpandedDepth` sets how many levels open first. Unset, all of them
do, unless the document runs past 500 lines: then the root opens and
everything under it stays shut.

**Opened to one level**

```tsx
import { JsonViewer } from '@bh/ui';

const CITY = {
  name: 'Lisbon',
  districts: ['Alfama', 'Baixa', 'Belém'],
  weather: { month: 'June', highC: 27, lowC: 17 },
};

export function OpenedToOneLevel() {
  return <JsonViewer value={CITY} label="lisbon.json" defaultExpandedDepth={1} />;
}
```

Given an `onChange`, the viewer edits, and hands each edit back to
whoever holds the document: a value for `value`, text for `source`.

Click a key to rename it, or a value to retype it. A value is typed as
JSON, so `42` is a number, `"42"` a string and `{}` an object. Hovering or
focusing a line shows its controls: add a member, edit a container as
text, remove. Undo and Redo sit in the toolbar.

**Editing**

```tsx
import { useState } from 'react';
import { JsonViewer } from '@bh/ui';

export function Editing() {
  const [basket, setBasket] = useState<unknown>({
    owner: 'Name',
    fruits: [
      { name: 'Apples', count: 4 },
      { name: 'Pears', count: 2 },
    ],
    delivered: false,
  });
  return <JsonViewer value={basket} onChange={setBasket} label="basket.json" maxHeight={360} />;
}
```

Text that will not parse is shown as given, its failing line marked,
under an alert with the line and column where it stopped. With an
`onChange`, Edit as text in the toolbar opens it to be fixed.

**Text that will not parse**

```tsx
import { useState } from 'react';
import { JsonViewer } from '@bh/ui';

export function TextThatWillNotParse() {
  const [text, setText] = useState('{\n  "city": "Oslo",\n  "rivers":,\n  "coastal": true\n}');
  return <JsonViewer source={text} onChange={setText} label="oslo.json" />;
}
```

`toolbar={false}` and `lineNumbers={false}` leave only the document, for
a short value. The folds still work.

**Without the chrome**

```tsx
import { JsonViewer } from '@bh/ui';

export function WithoutTheChrome() {
  return (
    <JsonViewer
      value={{ file: 'photo.jpg', bytes: 148223 }}
      label="Attachment"
      toolbar={false}
      lineNumbers={false}
    />
  );
}
```

## Keyboard and accessibility

| Key                             | Does                                                                       |
| ------------------------------- | -------------------------------------------------------------------------- |
| `Enter`                         | Commits the open key or value editor, if its draft parses.                 |
| `Escape`                        | Closes the open editor and leaves the line as it was.                      |
| `Ctrl+Enter` or `Cmd+Enter`     | Saves the text editor, if its text parses.                                 |
| `Ctrl+Z` or `Cmd+Z`             | Undoes the last edit, with the focus in the document and not in an editor. |
| `Ctrl+Shift+Z` or `Cmd+Shift+Z` | Redoes the last edit undone.                                               |

Leaving a key or value editor commits a draft that parses and drops one
that does not.

The document is a `role="group"` named by `label`, `JSON` by default.
Each chevron is a button named for its line, such as `Collapse weather`,
with `aria-expanded`. The toolbar's tools, and the text editor's Save and
Cancel, are icon-only buttons, each named by its tooltip: Collapse,
Expand, Edit as text, Undo, Redo, and Copy, which says Copied or Could
not copy for a moment after. The line numbers are hidden from assistive
tech. A parse error is a `role="alert"`, and an editor's field is
labelled and sets `aria-invalid` while its draft will not parse. After an
edit, the focus returns to the document, which takes focus but is not a
tab stop.

## Props

| Prop                   | Type                                                    | Default  | Description                                                                                            |
| ---------------------- | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `value`                | `unknown`                                               |          | The document, already parsed. Pass this or `source`.                                                   |
| `source`               | `string`                                                |          | The document as text, parsed here. Pass this or `value`.                                               |
| `onChange`             | `((next: unknown) => void) \| ((next: string) => void)` |          | Makes the document editable, and receives each edit: a value for `value`, text for `source`.           |
| `defaultExpandedDepth` | `number`                                                |          | How many levels are open on first render: unset, all of them, unless the document runs past 500 lines. |
| `lineNumbers`          | `boolean`                                               | `true`   | The gutter. Worth turning off for a two-line value, where the numbers are noise.                       |
| `toolbar`              | `boolean`                                               | `true`   | The header strip: the line count, fold-all, undo/redo when editable, and copy.                         |
| `label`                | `string`                                                | `'JSON'` | Names the document - in the header, and to assistive tech.                                             |
| `maxHeight`            | `number`                                                |          | Caps the body and scrolls past it. Unset lets the document run its full height.                        |
| `className`            | `string`                                                |          | Added to the frame's own classes.                                                                      |
