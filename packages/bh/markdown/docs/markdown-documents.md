---
title: Markdown documents
summary: Write blocks inside markdown, as fences and directives, for documents
  kept outside the docs site.
order: 3
related: [Writing a page, Rendering a document, The block registry]
---

[//]: # 'written from markdown-documents.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Markdown documents

Write blocks inside markdown, as fences and directives, for documents
kept outside the docs site: a help article an app stores, a report a
model writes.

## Blocks in markdown

A document is markdown, with its frontmatter between two `---` lines at
the top. A block is written one of two ways:

- **A fence** whose language is a registered name: ` ```callout `. A
  fence of any other language stays a code block, whatever it holds.
- **A directive**: `:::callout` on a line, its body, then `:::`. A
  directive is always a block, so a misspelt name draws the error card
  rather than vanishing. Four colons wrap three, so one can hold
  another.

What goes between the lines is the block's body, as its renderer reads
it: YAML for a data block, text kept as written for a text block, and
markdown, parsed again with the same blocks, for a markdown one.

Attributes go on the opening line, in braces: `key=value`, a quoted
value with spaces, or a bare name for a flag, as in
` ```code{lang=ts file=src/app.ts lines=3-7} `. A word before the name
is the block's language, as GitHub and editors read it: ` ```yaml callout `
is a callout, shown elsewhere as YAML. It becomes the block's `lang`
unless the braces set one.

An inline mark sits inside a sentence or a heading:
`:badge[stable]{tone=success}`, the label in brackets. A mark no inline
block is named for stays as written.

Edit the document: it is drawn with the site's blocks as you type, and
the strip under it shows what `validateDocument` finds. Misspell the
callout's name and the fence turns back into code, with a warning on
its line.

**A document**

````markdown
## Before the van comes

Pack the books first: they are the heaviest. :badge[two days]{tone=warning}

```yaml callout
type: tip
title: Label every box
content: Write the room on two sides, so it reads whichever way it is stacked.
```

```keyboard
- keys: [Ctrl+P]
  does: Prints the box labels.
```

:::callout
type: note
title: Keep the receipts
content: The deposit comes back only with them.
:::

```ts
const boxes = 24;
```
````

## Checking a document

`parseDocument` reads a document against a registry: its frontmatter,
its tree, every block in a flat list, its headings, and the YAML that
didn't parse, on its line. `validateDocument` reads it again and sorts
what it finds:

- **Errors** render wrong: a block no renderer is named for, data its
  schema refuses (on the block's opening line, with the field's path),
  YAML that doesn't parse.
- **Warnings** are probably typos: a fence language that is neither a
  block nor a language it knows, a word before a block name that isn't
  a language, a line that looks like a directive but wasn't read as one,
  an inline mark with no renderer. The directive and mark checks skip
  code, so a page showing that syntax in a fence or in backticks
  raises nothing.

A document's attributes are text, taken as written: only a
[YAML page](writing-a-page.md) checks them against what a block
declares.

## Drawing it

`MarkdownDoc` parses a document and draws it, parsing again only when
the source or the registry changes. [Rendering a document](rendering.md)
has the elements it draws with. Text the app didn't write, such as a
tool's output, goes to `MarkdownText` instead, which reads no blocks at
all.

## Rules

- A fence is a block only when its language is a registered name; any
  other fence stays markdown, with what it holds.
- A directive is always a block, so an unknown name reaches the error
  card instead of vanishing.
- A fence closes on a run of backticks at least as long as it opened
  with, and a directive on as many colons, so a longer one holds a
  shorter one. A block left open runs to the end.
- A fence or directive inside a list item or a blockquote stays
  markdown. Validation warns about the directive.
- A word before a block's name is its `lang`, unless its braces set one.
  Validation warns about an unknown word in either place.
- Attributes are text, taken as written, and a document checks none of
  them.

## Reference

```ts
parseDocument(source: string, registry: RendererLookup): ParsedDoc
```

Parses a page: its frontmatter, its markdown and blocks as one tree, a flat
index of every block (parents before the blocks nested in them), its
headings, and any YAML body that failed to parse.

| Parameter             | Type             | Default | Description |
| --------------------- | ---------------- | ------- | ----------- |
| `source` (required)   | `string`         |         |             |
| `registry` (required) | `RendererLookup` |         |             |

Returns `ParsedDoc`.

```ts
interface ParsedDoc extends Doc
```

A parsed page, and what reading it found wrong.

| Member                   | Type                      | Default | Description                                                                                  |
| ------------------------ | ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `issues` (required)      | `ParseIssue[]`            |         | Every problem, each on its line; none for a page that reads cleanly.                         |
| `frontmatter` (required) | `Record<string, unknown>` |         | What the page says about itself: a document's `---` block, or a YAML page's keys but `body`. |
| `nodes` (required)       | `Node[]`                  |         | The page's own nodes, in order: markdown, and the blocks between it.                         |
| `headings` (required)    | `Heading[]`               |         | The headings in the page's own nodes, not those inside its blocks.                           |
| `blocks` (required)      | `BlockNode[]`             |         | Every block, nested ones too, each parent before the blocks inside it.                       |

```ts
interface ParseIssue
```

A problem found while parsing, against the source line it came from.

| Member               | Type     | Default | Description                                                                |
| -------------------- | -------- | ------- | -------------------------------------------------------------------------- |
| `block` (required)   | `string` |         | What it is about: a block's name, or `page`, `prose`, `frontmatter`, `h2`. |
| `line` (required)    | `number` |         | The source line it is on, from 1.                                          |
| `path` (required)    | `string` |         | The schema path, dotted; empty when nothing parsed.                        |
| `message` (required) | `string` |         | What is wrong, in a sentence.                                              |

```ts
readFrontmatter(source: string): Record<string, unknown>
```

A page's frontmatter alone, without parsing the page: what a nav or an
index needs from every page up front.

| Parameter           | Type     | Default | Description |
| ------------------- | -------- | ------- | ----------- |
| `source` (required) | `string` |         |             |

Returns `Record<string, unknown>`.

```ts
validateDocument(source: string, registry: Registry): ValidationResult
```

Checks a page against the registry. Errors are what renders wrong: an
unknown block, a body that fails its schema, YAML that does not parse.
Warnings are what is probably a typo: a fence language nothing knows, a
directive the scanner did not take, an inline mark with no renderer.

| Parameter             | Type       | Default | Description |
| --------------------- | ---------- | ------- | ----------- |
| `source` (required)   | `string`   |         |             |
| `registry` (required) | `Registry` |         |             |

Returns `ValidationResult`.

```ts
interface ValidationResult
```

What `validateDocument` found: errors, and warnings.

| Member                | Type                  | Default | Description                                                    |
| --------------------- | --------------------- | ------- | -------------------------------------------------------------- |
| `errors` (required)   | `ValidationError[]`   |         | What renders wrong; none for a document that draws as written. |
| `warnings` (required) | `ValidationWarning[]` |         | What is probably a typo.                                       |

```ts
type ValidationError = ParseIssue;
```

What renders wrong: an unknown block, a body that fails its schema, YAML that doesn't parse.

| Member               | Type     | Default | Description                                                                |
| -------------------- | -------- | ------- | -------------------------------------------------------------------------- |
| `block` (required)   | `string` |         | What it is about: a block's name, or `page`, `prose`, `frontmatter`, `h2`. |
| `line` (required)    | `number` |         | The source line it is on, from 1.                                          |
| `path` (required)    | `string` |         | The schema path, dotted; empty when nothing parsed.                        |
| `message` (required) | `string` |         | What is wrong, in a sentence.                                              |

```ts
interface ValidationWarning
```

What is probably a typo, on its line: it renders, just not as meant.

| Member               | Type     | Default | Description                       |
| -------------------- | -------- | ------- | --------------------------------- |
| `line` (required)    | `number` |         | The source line it is on, from 1. |
| `message` (required) | `string` |         | What looks wrong, in a sentence.  |

```ts
scanBlocks(source: string, names: ReadonlySet<string>): Segment[]
```

Splits a source into markdown runs and blocks. A fence is a block only when
its language is a registered name; any other fence stays markdown, with
whatever it contains. A directive is always a block, so an unregistered
name reaches the renderer's fallback rather than vanishing.

A fence may name its language before the block, as GitHub and editors read
it: ```yaml callout is a `callout` block, highlighted there as YAML. The
language becomes the block's `lang` attribute, unless its `{…}` sets one.

It knows nothing of markdown's containers: a fence or directive indented in
a list item or quoted in a blockquote stays markdown. Validation warns about
the directive case.

| Parameter           | Type                  | Default | Description |
| ------------------- | --------------------- | ------- | ----------- |
| `source` (required) | `string`              |         |             |
| `names` (required)  | `ReadonlySet<string>` |         |             |

Returns `Segment[]`.

```ts
type Segment = MarkdownSegment | BlockSegment;
```

What `scanBlocks` splits a source into: runs of markdown, and the blocks between them.

```ts
interface BlockSegment
```

A fence or directive, before its body is parsed.

| Member              | Type                                               | Default | Description                                                              |
| ------------------- | -------------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| `kind` (required)   | `'block'`                                          |         |                                                                          |
| `syntax` (required) | `'fence' \| 'directive'`: `'fence'`, `'directive'` |         | Written as a fence (```name) or a directive (:::name).                   |
| `name` (required)   | `string`                                           |         | The block's name: its renderer's.                                        |
| `attrs` (required)  | `Attrs`                                            |         | Its `{…}` attributes, and `lang` for a language written before the name. |
| `body` (required)   | `string`                                           |         | What is between its opening and closing lines, unparsed.                 |
| `line` (required)   | `number`                                           |         | The line it opens on, from 1.                                            |

```ts
interface MarkdownSegment
```

A run of plain markdown between blocks.

| Member            | Type         | Default | Description                    |
| ----------------- | ------------ | ------- | ------------------------------ |
| `kind` (required) | `'markdown'` |         |                                |
| `text` (required) | `string`     |         | The markdown, as written.      |
| `line` (required) | `number`     |         | The line it starts on, from 1. |

```ts
parseAttrs(input: string): Attrs
```

Reads `{type=warning title="Before you migrate" compact}` into an object.

| Parameter          | Type     | Default | Description |
| ------------------ | -------- | ------- | ----------- |
| `input` (required) | `string` |         |             |

Returns `Attrs`.

```ts
type Attrs = Record<string, string | true>;
```

A block's `{…}` attributes: `key=value`, `key="quoted value"`, or a bare flag.
