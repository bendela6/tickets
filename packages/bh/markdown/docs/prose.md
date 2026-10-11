---
title: Prose
summary: Draws a markdown string as prose, inside an otherwise dense screen.
order: 5
related: [JsonViewer, Textarea]
---

[//]: # 'written from prose.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Prose

Draws a markdown string as prose, inside an otherwise dense screen.

It reads CommonMark and GitHub's additions (tables, strikethrough,
footnotes) with `MarkdownText`, and draws each element with `@bh/ui`'s
type and colours. Empty or missing text renders nothing.

## Import

```tsx
import { Prose } from '@bh/markdown';
```

## Examples

Headings, lists, code, tables and links, each in the library's type and
colours. A fence is a plain code block.

**Notes**

```tsx
import { Prose } from '@bh/markdown';

const NOTES = `## Packing list

Bring **two** bags, and see [the weather](https://example.com/weather) first.

- Apples
- Pears
- A \`map.pdf\` on the phone

| City   | Days |
| ------ | ---- |
| Lisbon | 3    |
| Porto  | 2    |

\`\`\`sh
cp map.pdf ~/trip/
\`\`\``;

export function Notes() {
  return <Prose>{NOTES}</Prose>;
}
```

It never runs what it is handed. Raw HTML draws nothing, a `:::` block is
text, and a link whose scheme is not `http:`, `https:` or `mailto:` is
plain text.

**Untrusted text**

```tsx
import { Prose } from '@bh/markdown';

const TEXT = `:::note
Stays text.
:::

A <b>bold</b> word, a [script link](javascript:void(0)) and a [mail link](mailto:name@example.com).`;

export function UntrustedText() {
  return <Prose>{TEXT}</Prose>;
}
```

## Keyboard and accessibility

Headings keep their level but take no `id`, since a screen can hold many
notes with the same heading. An image keeps its alt text, empty when it
has none.

## Props

| Prop                  | Type             | Default | Description                                                     |
| --------------------- | ---------------- | ------- | --------------------------------------------------------------- |
| `children` (required) | `string \| null` |         | The markdown to draw. Empty, blank or missing, nothing renders. |
| `className`           | `string`         |         | Added to the wrapper's classes.                                 |
