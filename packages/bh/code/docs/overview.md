---
title: Overview
summary: Show a code fragment and write one, coloured the same way, from one syntax map.
order: 1
related: [CodeBlock, CodeEditor, Prose]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

Show a code fragment and write one, coloured the same way, from one
syntax map.

Everything an app shows as code comes from here: `CodeBlock` shows a
fragment, `CodeEditor` writes one, and both colour it through the same
roles, so a script on a page and the same script being edited look the
same. `@bh/markdown`'s code block is this `CodeBlock`.

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
   naming its file or language and a copy control, its lines numbered
   and the ones a passage is about marked.
2. **[`CodeEditor`](code-editor.md)**: a fragment to write, with a
   strip naming it, its line count and where the caret is. It grows with
   its text.
3. **The syntax map**: `SYNTAX_CLASSES` gives each role (keyword, type,
   string, number, comment, name, punctuation) its colour, and
   `SYNTAX_TAGS` says which Lezer tags take which role.
   `SYNTAX_HIGHLIGHTER` is the two as a Lezer highlighter, for an editor
   of your own (CodeMirror's `syntaxHighlighting`), and `highlightLines`
   colours a string as React nodes, one array per line.

## Languages

A code block colours `ts`, `tsx`, `js`, `jsx`, `json`, `yaml` (or `yml`),
`css`, `sh` (or `shell`, `bash`) and `dockerfile`. The editor colours
`shell` (or `sh`, `bash`), `dockerfile` and `yaml` (or `yml`). Any other
language shows, or edits, plain. `LANGUAGES` and `EDITOR_LANGUAGES` list
them.

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
