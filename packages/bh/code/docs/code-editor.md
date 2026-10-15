---
title: CodeEditor
summary: Writes code, from a script or a YAML file to TSX or markdown, coloured
  as a code block colours it, growing with its text.
order: 3
related: [CodeBlock, Textarea]
---

[//]: # 'written from code-editor.doc.yaml by pnpm docs:sync; edit that file, not this one'

# CodeEditor

Writes code, from a script or a YAML file to TSX or markdown, coloured
as a code block colours it, growing with its text.

A strip names what it holds and counts its lines, with where the caret
is. It starts `minLines` tall and grows as the text does, so the page is
the one thing that scrolls; a long line scrolls sideways inside it.

## Import

```tsx
import { CodeEditor } from '@bh/code';
```

## Examples

A shell script, as a stack's setup is: `lang` picks the grammar, `title`
names it in the strip and is its accessible name.

**A setup script**

```tsx
import { useState } from 'react';
import { CodeEditor } from '@bh/code';

const SCRIPT = `# Runs before each deploy of a stack that connects.
set -eu
if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DATABASE'" | grep -q 1; then
  createdb --owner "$ROLE" "$DATABASE"
fi`;

export function ASetupScript() {
  const [script, setScript] = useState(SCRIPT);
  return <CodeEditor value={script} onChange={setScript} lang="shell" title="setup" minLines={4} />;
}
```

A Dockerfile. Its instructions are keywords, as in a code block.

**A dockerfile**

```tsx
import { useState } from 'react';
import { CodeEditor } from '@bh/code';

const DOCKERFILE = `FROM node:22-alpine AS build
WORKDIR /app
COPY . .
# The lockfile decides every version.
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

FROM caddy:2
COPY --from=build /app/dist /srv`;

export function ADockerfile() {
  const [text, setText] = useState(DOCKERFILE);
  return <CodeEditor value={text} onChange={setText} lang="dockerfile" title="Dockerfile" />;
}
```

Empty, with a `placeholder`, and `invalid` while it has a problem: the
border turns red and the field says so. The message is the app's,
below it.

**An empty script**

```tsx
import { useState } from 'react';
import { CodeEditor } from '@bh/code';
import { FieldError } from '@bh/ui';

export function AnEmptyScript() {
  const [script, setScript] = useState('');
  const empty = script.trim() === '';
  return (
    <div className="flex flex-col">
      <CodeEditor
        value={script}
        onChange={setScript}
        lang="shell"
        title="teardown"
        label="Teardown"
        minLines={3}
        placeholder="sh /etc/caddy/site.sh remove"
        invalid={empty}
      />
      {empty ? <FieldError>Give it a command, or turn teardown off.</FieldError> : null}
    </div>
  );
}
```

`problems` marks the lines a problem is on, as a code block marks them:
the number in the problem's tone with a bar beside it, and the line
tinted, red for an error and orange for a warning. The marks move with
the text as it's edited, until the app sends new ones.

**An unknown restart policy**

```tsx
import { useMemo, useState } from 'react';
import { CodeEditor, type LineProblems } from '@bh/code';
import { FieldError } from '@bh/ui';

const COMPOSE = `services:
  web:
    image: caddy:2
    restart: sometimes`;

const POLICY = /^restart: (?!(no|always|on-failure|unless-stopped)$)/;

export function AnUnknownRestartPolicy() {
  const [text, setText] = useState(COMPOSE);
  const line = text.split('\n').findIndex((row) => POLICY.test(row.trim())) + 1;
  const problems: LineProblems = useMemo(() => {
    return new Map(line > 0 ? [[line, 'error']] : []);
  }, [line]);
  return (
    <div className="flex flex-col">
      <CodeEditor
        value={text}
        onChange={setText}
        lang="yaml"
        title="compose.yaml"
        minLines={4}
        problems={problems}
        invalid={line > 0}
      />
      {line > 0 ? (
        <FieldError>Line {line}: restart is no, always, on-failure or unless-stopped.</FieldError>
      ) : null}
    </div>
  );
}
```

`readOnly` shows the text, numbered and coloured, without taking edits,
and drops the caret's place from the strip. For a fragment that is never
edited, a `CodeBlock` says so better.

**Locked while it deploys**

```tsx
import { useState } from 'react';
import { CodeEditor } from '@bh/code';
import { Switch } from '@bh/ui';

const COMPOSE = `services:
  web:
    image: caddy:2
    restart: unless-stopped`;

export function LockedWhileItDeploys() {
  const [text, setText] = useState(COMPOSE);
  const [deploying, setDeploying] = useState(true);
  return (
    <div className="flex flex-col gap-12">
      <Switch value={deploying} onChange={setDeploying} label="Deploying" />
      <CodeEditor
        value={text}
        onChange={setText}
        lang="yaml"
        title="compose.yaml"
        minLines={4}
        readOnly={deploying}
      />
    </div>
  );
}
```

## In a pane of its own

`bare` draws the lines alone, with no strip and no border, for a pane
that names and frames the code itself, as the docs site's examples do.

`extensions` takes what an app adds to CodeMirror, such as completions,
or wrapping for a language whose lines are prose. In markdown, a fence's
code is coloured in the language its first word names (` ```yaml `);
`fenceLanguage` names it otherwise, for fences whose first word names
something else.

## Keyboard and accessibility

It is CodeMirror's editor: the arrows, Home and End, undo (Ctrl-Z,
Cmd-Z on a Mac) and redo (Ctrl-Y, Cmd-Shift-Z on a Mac) are an
editor's. Tab indents the line or
the selection and Shift-Tab takes it back, so Tab doesn't leave it:
Escape, then Tab within two seconds, moves on to the next field, and
Ctrl-M (Shift-Alt-M on a Mac) lets Tab move on until it's pressed again.

The editable area is a `textbox`, multi-line. It is named by `label`, by
the element `labelledBy` points at, or by `title` when that is text. A
`<label htmlFor>` can't name it, since it's no form control: point
`labelledBy` at the label's id instead. `readOnly` sets
`aria-readonly`, and `invalid` sets `aria-invalid`.

## When not to use it

For prose, use `Textarea`: an editor numbers lines and colours them, and
Tab indents. For code the reader only reads, use `CodeBlock`.

## Props

| Prop               | Type                      | Default | Description                                                                                                                                       |
| ------------------ | ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required) | `string`                  |         | The text, verbatim.                                                                                                                               |
| `onChange`         | `(value: string) => void` |         | The whole text after each edit.                                                                                                                   |
| `lang`             | `string`                  |         | Picks the grammar: `shell` (or `sh`, `bash`), `dockerfile`, `yaml`, `tsx` (or `ts`, `jsx`, `js`) and `markdown` (or `md`). Any other edits plain. |
| `title`            | `ReactNode`               |         | Names the text in the strip above it: its file, or what the script is for.                                                                        |
| `id`               | `string`                  |         | The editable area's id.                                                                                                                           |
| `label`            | `string`                  |         | Its accessible name; by default the title, when that is text.                                                                                     |
| `labelledBy`       | `string`                  |         | The id of the element naming it, as a field's label does; wins over `label`.                                                                      |
| `minLines`         | `number`                  | `6`     | How tall it starts, in lines. It grows with its text from there.                                                                                  |
| `readOnly`         | `boolean`                 | `false` | Shows the text, numbered and coloured, without taking edits.                                                                                      |
| `placeholder`      | `string`                  |         | Shown while it is empty.                                                                                                                          |
| `invalid`          | `boolean`                 | `false` | The text has a problem: a red border, and `aria-invalid`.                                                                                         |
| `problems`         | `LineProblems`            |         | The lines with a problem: each number in the problem's tone, the line tinted, as a code block marks them.                                         |
| `bare`             | `boolean`                 | `false` | The lines alone, with no strip or border: for a pane that names and frames the code itself, as an example's does.                                 |
| `fenceLanguage`    | `FenceLanguage`           |         | In markdown, the language a fence's code is in, from its info string; by default the info's first word. Read with `lang`.                         |
| `extensions`       | `Extension`               | `[]`    | CodeMirror extensions the app adds, such as completions or line wrapping. Read when the editor is made.                                           |
