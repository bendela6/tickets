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

A strip names its file or its language, with a copy button that copies
the code without the numbers, and turns to a check, or to a cross when
the browser refused. The lines a passage is about can be marked, and the
rest recede.

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

`problems` marks the lines a problem is on, as an editor marks them: the
number in the problem's tone with a bar beside it, and the line tinted,
red for an error and orange for a warning. The other lines stay as they
are.

**The line that failed**

```tsx
import { CodeBlock } from '@bh/code';

const SETUP = `set -eu
createdb --owner "$ROLE" "$DATABASE"
psql -c "GRANT ALL ON DATABASE $DATABASE TO $ROLE"`;

export function TheLineThatFailed() {
  return (
    <CodeBlock
      value={SETUP}
      lang="sh"
      file="setup"
      problems={
        new Map([
          [2, 'error'],
          [3, 'warning'],
        ])
      }
    />
  );
}
```

`bare` draws the lines alone, with no strip, no border and no copy
control, for a pane that names and frames the code itself, as the docs
site's examples do.

## Keyboard and accessibility

The code is a `<pre>`, read as text; the line numbers are hidden from
screen readers and can't be selected, so a copied selection is the code
alone. The copy control is an icon-only button named by its tooltip:
Copy, then Copied, or Could not copy, for a moment after a click.

## When not to use it

For code the reader writes, use `CodeEditor`. For a document that holds
code, write it in markdown: `@bh/markdown`'s code block draws this.

## Props

| Prop               | Type                  | Default | Description                                                                                                                     |
| ------------------ | --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required) | `string`              |         | The code, verbatim.                                                                                                             |
| `lang`             | `string`              |         | Picks the grammar; one this package has none for shows plain.                                                                   |
| `file`             | `string`              |         | Names the fragment in the strip above it.                                                                                       |
| `marked`           | `ReadonlySet<number>` | `NONE`  | The lines the passage is about; the rest recede.                                                                                |
| `numbers`          | `boolean`             | `true`  | Numbers in a gutter. On by default.                                                                                             |
| `problems`         | `LineProblems`        |         | The lines with a problem: each number in the problem's tone, the line tinted, as an editor marks them.                          |
| `bare`             | `boolean`             | `false` | The lines alone, with no strip, border or copy control: for a pane that names and frames the code itself, as an example's does. |
