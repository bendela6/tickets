---
title: ExamplePanel
summary: Show what a piece of code draws beside the code, to read, copy, resize
  and open full screen, and to edit with the app's own editor.
order: 4
related: [CodeEditor, CodeBlock, Dialog]
---

[//]: # 'written from example-panel.doc.yaml by pnpm docs:sync; edit that file, not this one'

# ExamplePanel

Show what a piece of code draws beside the code, to read, copy, resize
and open full screen, and to edit with the app's own editor.

The panel runs nothing. The app renders the result, hands it in with
the code that draws it, and says what is wrong with the code if it
knows. The panel lays the two out: the result on a stage, the code, or
both, under or beside each other, with the controls for each on hover.
Every example on this site is one.

## Import

```tsx
import { ExamplePanel, problemLines, type CodeProblem } from '@bh/code';
```

## A result and its code

`result` is what the app rendered and `code` what draws it; `title`
names the example in its header and to a screen reader, as the region
`Example: <title>`. Without an `editor`, the code is drawn read-only, in
`lang`'s colors (TSX unless said), and the code's bar names it by
`file`, or by its grammar in capitals.

`mode` is what the panel opens on: `view`, the result alone with the
way to the code over its corner; `split`, both; or `source`, the code
alone. A split's code goes under the result, or, with
`layout="horizontal"` or its button, beside it where the panel is 640 pixels
wide. `height` is the stage's least height, 200 pixels unless given,
and `collapse` how many lines of code show before it scrolls, 12.

`actions` are the app's own controls, in the header before Full screen,
and shown with it: below, the size the button is drawn at, which
changes the result and the code together.

**A button in three sizes**

```tsx
import { useState } from 'react';
import { ExamplePanel } from '@bh/code';
import { Button, SegmentedControl, type ButtonSize } from '@bh/ui';

const SIZES = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

export function AButtonInThreeSizes() {
  const [size, setSize] = useState<ButtonSize>('md');
  // The code says what the result draws: the app writes both.
  const code = `<Button variant="solid" size="${size}">\n  Save the shelf\n</Button>`;
  return (
    <ExamplePanel
      title="Save the shelf"
      code={code}
      mode="split"
      height={120}
      result={
        <Button variant="solid" size={size}>
          Save the shelf
        </Button>
      }
      actions={
        <SegmentedControl
          size="xs"
          label="Save the shelf: size"
          options={SIZES}
          value={size}
          onChange={(next) => setSize(next as ButtonSize)}
        />
      }
    />
  );
}
```

## Code the reader edits

`editor` takes the code pane: the app's editor, which holds the code as
the reader changes it. The app reads the code again on each change,
renders what it draws, and passes back the problems it found. Each is a
`CodeProblem`: its `line` when known, its `severity`, an error or a
warning, and its `message`. The panel lists them under the code, and
while the code is hidden, the errors under the result, so a broken
example says so. `problemLines` turns them into the lines to mark, an
editor's or a code block's `problems`, each with its worst.

`edited` says the code differs from what the app first showed, and the
bar says so; `onReset` puts it back, from the bar's Reset the source.
Below, the app reads a book a line: take the dash off a line, or the
author off a book.

**A reading list**

```tsx
import { useMemo, useState } from 'react';
import { CodeEditor, ExamplePanel, problemLines, type CodeProblem } from '@bh/code';

const LIST = `- Middlemarch, George Eliot
- Persuasion, Jane Austen
- The Leopard, Giuseppe di Lampedusa`;

interface Book {
  title: string;
  author?: string;
}

/** The app's own reading of its code: a book a line, and what is wrong with each. */
function readList(text: string): { books: Book[]; problems: CodeProblem[] } {
  const books: Book[] = [];
  const problems: CodeProblem[] = [];
  text.split('\n').forEach((row, index) => {
    const line = index + 1;
    if (row.trim() === '') {
      return;
    }
    if (!row.startsWith('- ')) {
      problems.push({ line, severity: 'error', message: 'Start each book with a dash.' });
      return;
    }
    const [title = '', author] = row.slice(2).split(', ');
    if (author === undefined) {
      problems.push({ line, severity: 'warning', message: `${title} has no author.` });
    }
    books.push({ title, author });
  });
  return { books, problems };
}

export function AReadingList() {
  const [text, setText] = useState(LIST);
  const { books, problems } = useMemo(() => readList(text), [text]);
  return (
    <ExamplePanel
      title="A reading list"
      code={text}
      lang="yaml"
      file="reading-list.yaml"
      mode="split"
      edited={text !== LIST}
      onReset={() => setText(LIST)}
      problems={problems}
      editor={
        <CodeEditor
          value={text}
          onChange={setText}
          lang="yaml"
          label="A reading list: source"
          problems={problemLines(problems)}
          bare
        />
      }
      result={
        <ol className="text-14 text-gray-12 flex list-decimal flex-col gap-4 pl-20">
          {books.map((book, index) => {
            return (
              <li key={`${index}-${book.title}`}>
                <span className="font-500">{book.title}</span>
                {book.author ? <span className="text-gray-11">, {book.author}</span> : null}
              </li>
            );
          })}
        </ol>
      }
    />
  );
}
```

## Resizing and full screen

The panel's bottom edge drags its height, and a split's divider the
result's share of it; each arrangement keeps the height it was dragged
to. Full screen opens the panel in a dialog that fills the window, the
code beside the result where there is room, and leaves a note in the
panel's place; Esc, or Leave full screen, brings it back, the focus on
Full screen again.

## Keyboard and accessibility

| Key        | Does                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Tab`      | Moves through the controls, which show as they take the focus.                                                                 |
| `↑` or `↓` | On the bottom edge, makes the panel shorter or taller, 24 pixels a press; on a split's divider, gives the result less or more. |
| `←` or `→` | On a divider between the result and the code beside it, gives the result less or more.                                         |
| `Esc`      | Leaves full screen.                                                                                                            |

The panel is a region named `Example: <title>`, and its title a heading.
What it shows is a radio group, `<title>: show`. The bottom edge and a
split's divider are separators, named `<title>: height` and `<title>:
result and code`, with their value; full screen is a dialog named by
the title. Every control is a button named by its tooltip, and the
problems are a list named Problems.

## Rules

- **It runs nothing.** The result, the code, the editor and the
  problems are the app's; the panel draws them.
- **The code is what draws the result.** Copy copies `code` as it
  stands, edited or not.
- **One result at a time.** Full screen takes the result, and the panel
  keeps its place on the page with a note.
- **The controls keep out of the way** until a reader reaches for them:
  on hover, on focus, and always where nothing hovers.

## Reference

`ReactNode` and `Ref` are React's: anything React can draw, and a ref
to an element, here the panel's `<section>`.

| Prop                | Type                                                | Default                | Description                                                                                             |
| ------------------- | --------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `title` (required)  | `string`                                            |                        | Names the example, in its header and to a screen reader.                                                |
| `code` (required)   | `string`                                            |                        | The code as it stands: what Copy copies, and what the code pane shows without `editor`.                 |
| `lang`              | `string`                                            |                        | The code's grammar, for a pane drawn read-only and the bar's name: TSX unless said.                     |
| `file`              | `string`                                            |                        | What the code bar names the code by: its file. Its grammar, in capitals, without it.                    |
| `editor`            | `ReactNode`                                         |                        | The code pane: the app's editor. Without it, `code` drawn read-only, its problems' lines marked.        |
| `result` (required) | `ReactNode`                                         |                        | What the code draws, as the app rendered it.                                                            |
| `problems`          | `readonly CodeProblem[]`                            | `[]`                   | What is wrong with the code: listed under it, the errors under the result too while the code is hidden. |
| `edited`            | `boolean`                                           | `false`                | The code differs from what the app first showed: the bar says so.                                       |
| `onReset`           | `() => void`                                        |                        | Given, the bar offers Reset the source, while `edited`.                                                 |
| `mode`              | `ExamplePanelMode`: `'view'`, `'split'`, `'source'` | `'view'`               | What the panel opens on.                                                                                |
| `layout`            | `ExamplePanelLayout`: `'vertical'`, `'horizontal'`  | `'vertical'`           | How a split opens: the code under the result, or beside it where there is room.                         |
| `collapse`          | `number`                                            | `12`                   | Lines of code shown before the code scrolls.                                                            |
| `height`            | `number`                                            | `EXAMPLE_STAGE_HEIGHT` | The result stage's least height in pixels.                                                              |
| `actions`           | `ReactNode`                                         |                        | In the header, before Full screen, and shown with it: controls of the app's own.                        |
| `ref`               | `Ref<HTMLElement>`                                  |                        | The panel's `<section>`.                                                                                |

```ts
type ExamplePanelMode = 'view' | 'split' | 'source';
```

What an example panel shows: the result, the result and its code, or the code.

One of `'view'`, `'split'`, `'source'`.

```ts
type ExamplePanelLayout = 'vertical' | 'horizontal';
```

How a split sits: the code under the result, or beside it.

One of `'vertical'`, `'horizontal'`.

```ts
interface CodeProblem
```

Something wrong with a piece of code, as the app found it: compiling it,
running it, or checking its types. An example panel lists them under the
code and marks their lines.

| Member                | Type                                      | Default | Description                                            |
| --------------------- | ----------------------------------------- | ------- | ------------------------------------------------------ |
| `line`                | `number`                                  |         | The line it is on, from 1, when it is known.           |
| `severity` (required) | `ProblemSeverity`: `'error'`, `'warning'` |         | An error stops the code working; a warning never does. |
| `message` (required)  | `string`                                  |         | What is wrong, in words.                               |

```ts
problemLines(problems: readonly CodeProblem[]): LineProblems
```

The lines the problems are on, each with its worst, for a code block's or
an editor's `problems`. A problem on no line marks none.

| Parameter             | Type                     | Default | Description                                |
| --------------------- | ------------------------ | ------- | ------------------------------------------ |
| `problems` (required) | `readonly CodeProblem[]` |         | What is wrong with the code, in any order. |

Returns `LineProblems`.

```ts
type LineProblems = ReadonlyMap<number, ProblemSeverity>;
```

The lines with a problem, numbered from 1, each with how bad its worst is.
A code block and an editor mark them alike: the number in the problem's
tone, the line tinted.

```ts
type ProblemSeverity = 'error' | 'warning';
```

How bad a line's problem is: an error stops the code working; a warning is worth a look.

One of `'error'`, `'warning'`.

```ts
const EXAMPLE_PANEL_MODES: readonly ExamplePanelMode[];
```

Every mode, in the order the panel offers them.

```ts
const EXAMPLE_PANEL_LAYOUTS: readonly ExamplePanelLayout[];
```

Both layouts: under, then beside.

```ts
const EXAMPLE_STAGE_HEIGHT: 200;
```

The result stage's least height when the app sets none, in pixels: room for a small result.
