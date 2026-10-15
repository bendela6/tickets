---
title: Overview
summary: Show a code fragment and write one, coloured the same way, from one syntax map.
order: 1
related: [CodeBlock, CodeEditor, ExamplePanel, Prose]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

Show a code fragment and write one, coloured the same way, from one
syntax map.

Everything an app shows as code comes from here: `CodeBlock` shows a
fragment, `CodeEditor` writes one, and both colour it through the same
roles, so a script on a page and the same script being edited look the
same. `@bh/markdown`'s code block is this `CodeBlock`. `ExamplePanel`
shows what a piece of code draws beside the code.

## Import

```tsx
import { CodeBlock, CodeEditor } from '@bh/code';
```

An app imports the package's sheet after `@bh/ui/tokens.css`, so the
classes used only inside it are in the app's stylesheet. An app that
takes `@bh/markdown` has it already: markdown's sheet imports it.

```css
@import '@bh/ui/tokens.css';
@import '@bh/code/styles.css';
```

## The parts

1. **[`CodeBlock`](code-block.md)**: a fragment to read, with a strip
   naming its file or language and a copy control, its lines numbered,
   the ones a passage is about marked and those a problem is on in its
   tone.
2. **[`CodeEditor`](code-editor.md)**: a fragment to write, with a
   strip naming it, its line count and where the caret is. It grows with
   its text, and marks a problem's lines as a code block does.
3. **[`ExamplePanel`](example-panel.md)**: what a piece of code
   draws, beside the code, which the app's editor can take; with its
   problems listed, a split and a height that drag, and full screen.
4. **The syntax map**: `SYNTAX_CLASSES` gives each role (keyword, type,
   string, number, comment, name, punctuation) its colour, and
   `SYNTAX_TAGS` says which Lezer tags take which role.
   `SYNTAX_HIGHLIGHTER` is the two as a Lezer highlighter, for an editor
   of your own (CodeMirror's `syntaxHighlighting`), and `highlightLines`
   colours a string as React nodes, one array per line.

## Languages

A code block colours `ts`, `tsx`, `js`, `jsx`, `json`, `yaml` (or `yml`),
`css`, `sh` (or `shell`, `bash`) and `dockerfile`. The editor colours
`ts`, `tsx`, `js`, `jsx`, `yaml` (or `yml`), `shell` (or `sh`, `bash`),
`dockerfile` and `markdown` (or `md`), whose fences' code it colours in
these too. Any other language shows, or edits, plain. `LANGUAGES` and
`EDITOR_LANGUAGES` list them.

## Rules

- Code is never wrapped: a long line scrolls sideways inside its frame,
  since wrapping would change what it says.
- Neither part has a scroll box up and down: each is as tall as its
  lines, and the page scrolls.
- The colours are the page's tones, so code themes with everything else,
  dark included.

## Reference

```ts
type SyntaxRole = 'keyword' | 'type' | 'string' | 'number' | 'comment' | 'name' | 'punctuation';
```

What a run of code is, as far as its colour goes.

One of `'keyword'`, `'type'`, `'string'`, `'number'`, `'comment'`, `'name'`, `'punctuation'`.

```ts
interface Grammar
```

What `highlightCode` needs from a grammar: something that parses a string to a tree.

| Member             | Type                      | Default | Description |
| ------------------ | ------------------------- | ------- | ----------- |
| `parse` (required) | `(input: string) => Tree` |         |             |

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
type FenceLanguage = (info: string) => string | undefined;
```

The language a markdown fence's code is in, from its info string (what
follows the opening fence), as a name `lang` takes; nothing edits it plain.
