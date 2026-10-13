---
title: CodeBlock
summary: Shows a code fragment to read, its lines numbered and coloured by its language.
order: 2
related: [CodeEditor, Overview]
---

[//]: # 'written from code-block.doc.yaml by pnpm docs:sync; edit that file, not this one'

# CodeBlock

Shows a code fragment to read, its lines numbered and coloured by its
language.

A strip names its file or its language, with a copy control that copies
the code without the numbers. The lines a passage is about can be
marked, and the rest recede.

## Import

```tsx
import { CodeBlock } from '@bh/code';
```

## Examples

For a command or two the gutter is noise: `numbers` set to false drops
it.

**A command**

```tsx
import { CodeBlock } from '@bh/code';

const COMMAND = `curl -H "Authorization: Bearer $TOKEN" https://example.com/api/stacks`;

export function ACommand() {
  return <CodeBlock value={COMMAND} lang="sh" numbers={false} />;
}
```

`file` names the strip, and `marked` the lines the passage is about.

**The lines that changed**

```tsx
import { CodeBlock } from '@bh/code';

const COMPOSE = `services:
  web:
    image: caddy:2
    restart: unless-stopped
    environment:
      - SITE_ADDRESS=example.com`;

export function TheLinesThatChanged() {
  return <CodeBlock value={COMPOSE} lang="yaml" file="compose.yaml" marked={new Set([5, 6])} />;
}
```

## Keyboard and accessibility

The code is a `<pre>`, read as text; the line numbers are hidden from
screen readers and can't be selected, so a copied selection is the code
alone. The copy control is a button, named Copy.

## When not to use it

For code the reader writes, use `CodeEditor`. For a document that holds
code, write it in markdown: `@bh/markdown`'s code block draws this.

## Props

| Prop               | Type                  | Default | Description                                                   |
| ------------------ | --------------------- | ------- | ------------------------------------------------------------- |
| `value` (required) | `string`              |         | The code, verbatim.                                           |
| `lang`             | `string`              |         | Picks the grammar; one this package has none for shows plain. |
| `file`             | `string`              |         | Names the fragment in the strip above it.                     |
| `marked`           | `ReadonlySet<number>` | `NONE`  | The lines the passage is about; the rest recede.              |
| `numbers`          | `boolean`             | `true`  | Numbers in a gutter. On by default.                           |
