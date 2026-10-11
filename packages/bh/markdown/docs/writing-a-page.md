---
title: Writing a page
summary: Write a docs page in YAML, its frontmatter then a body of prose,
  headings and blocks, and keep its markdown copy beside it.
order: 2
related: [Live examples, The page editor, Markdown documents]
---

[//]: # 'written from writing-a-page.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Writing a page

Write a docs page in YAML, its frontmatter then a body of prose,
headings and blocks, and keep its markdown copy beside it.

## The file

A page is `<name>.doc.yaml`. Where it lives gives its address and its
place in the nav. The packages sit in `packages/web/`, and `config` in
`packages/shared/`:

| File                                                       | Address                      |
| ---------------------------------------------------------- | ---------------------------- |
| `ui/src/library/<group>/components/<name>/<name>.doc.yaml` | `/components/<group>/<name>` |
| `ui/docs/foundations/<name>.doc.yaml`                      | `/foundations/<name>`        |
| `form/docs/<name>.doc.yaml`                                | `/forms/<name>`              |
| `table/docs/<name>.doc.yaml`                               | `/tables/<name>`             |
| `shell/docs/<name>.doc.yaml`                               | `/shell/<name>`              |
| `markdown/docs/<name>.doc.yaml`                            | `/markdown/<name>`           |
| `config/docs/<name>.doc.yaml`                              | `/tooling/<name>`            |
| `apps/docs/content/getting-started/<name>.doc.yaml`        | `/getting-started/<name>`    |

A file anywhere else is no page. Beside a page are its examples, one
file each in `examples/`, and its markdown copy, `<name>.md`. A page
travels with its package: an app that takes the package gets the page,
its examples and the copy.

```yaml
title: Button
summary: 'Starts an action: save, open a dialog, run a job.'
order: 1
related: [CopyButton, Menu]
body:
  - |
    Starts an action: save, open a dialog, run a job.
  - h2: Import
  - code: import { Button } from '@bh/ui';
    lang: tsx
  - h2: Examples
  - demo: examples/loading.tsx
  - h2: Props
  - props: Button
```

## Frontmatter

Everything at the top level but `body` is the page's frontmatter. The
site takes four keys and no others, so a misspelt one is an error:

- **`title`**, required: the nav, the header, and Related on other pages.
- **`summary`**, required: one sentence, for search, `docs/INDEX.md` and
  Related. A summary with `: ` in it is quoted.
- **`order`**: the page's place in its nav group. Pages with none follow,
  by title.
- **`related`**: the titles of the pages listed under Related. A title
  with no page yet shows as text.

## The body

`body` is a list, and each item is one of three things.

- **Prose** is a string, always written with `|` and its markdown
  indented under it. A one-line value with `: ` in it, or one starting
  with a backtick, isn't valid YAML, so the `|` is required, not just
  tidy. Prose is plain markdown with GitHub's tables, and it is never
  scanned for blocks: a fence in it is a plain code block.
- **A heading** is `- h2: Props` or `- h3: …`, one line. Written as
  `- ## Props`, YAML would read a comment and the item would be empty.
  The rail on the right lists the `h2`s.
- **A block** is a mapping. Its first key names the block, and that
  key's value is its body. Any other key beside it is an attribute.

The opening prose is the page's lede: the header shows its first
paragraph, and the summary stands in when there is none.

How a block's body is written depends on what its renderer says it is:

- **Text**, kept verbatim: `- code: |` with the text under it, or on the
  same line when it is one.
- **Data**, checked against the block's schema: `- callout:` with its
  YAML under it, a mapping or, for `keyboard`, a list.
- **One attribute given by value**, for a block whose body the page
  doesn't write: `- props: Button`, `- demo: examples/loading.tsx`,
  `- ref: parsePage`.
- **Markdown**: `- name: |` with markdown under it, or a list of prose
  and blocks, as `body` is.

Attributes are checked against what the block declares. A key it
doesn't take, a value outside its list, or text where it takes a number
or `true`/`false` is a problem on its line. An attribute holds one value,
so a block that needs a mapping takes it in its data. Each block's page
under [The blocks](registry.md#the-blocks) lists its attributes
and its data as a type.

Edit these items: the result is drawn with the site's blocks as you
type, and a problem shows on its line.

**Page items**

```yaml
- |
  Water a fern **twice a week**, more in summer.
- h3: Light
- |
  Bright, but out of the sun:

  - a north window
  - a shady balcony
- callout:
    type: tip
    title: Mist it
    content: A fern likes damp air, so mist its leaves on dry days.
- keyboard:
    - keys: [Ctrl+S]
      does: Saves the care notes.
```

## Nesting

Most nesting needs none: a list, a table or a code sample inside prose
is plain markdown. A callout's `content` is markdown read with the page's
blocks, so a block inside it is written as a markdown document writes one,
a fence named for it (see
[Markdown documents](markdown-documents.md)). A block whose body
is markdown takes a list of items, as `body` does.

## Links

A page links another by its path on the site, with a heading's id after
`#`: `[the props](/components/primitives/button#props)`. A heading on
the same page is `[Props](#props)`. A heading's id is its text slugged:
lower case, each run of anything but `a` to `z` and digits a dash, with
none at either end, so "Async options" is `#async-options`. The copy
writes each link as the other page's `.md`, so it works on GitHub and
in an app's copy.

## The markdown copy

`pnpm docs:sync` writes `<name>.md` beside each page, formatted by the
repo's Prettier: its frontmatter, a note naming the page it comes from,
the title as `# Title`, then each item in order. Prose and headings are
written as they are; each block is written as its renderer says. A
`code` block is a fence, a callout a GitHub alert, an example its file's
code under its title, a `props` or `ref` block its table from the types.

Commit the copy with the page. It is what GitHub, an editor's preview,
Page as .md and a Claude session in an app read, so a page's change
reaches them only through it. A changed prop's JSDoc or a changed
example needs a sync too, since the copy shows both. The same command
writes `apps/docs/page.schema.json`; `pnpm docs:index` writes each
package's `docs/INDEX.md`, the list of its pages.

## What docs:check checks

`pnpm docs:check` runs every check below on every page, each problem on
the page's line (an example's on its file's line too):

1. **It reads cleanly**: the YAML, the frontmatter, each item's shape,
   each attribute, each block's data against its schema.
2. **References resolve**: every `props`, `ref` and `variants` names
   something a bh package exports, and `variants` crosses props it can.
3. **Code works**: every `code` block in `ts` or `tsx` type-checks
   against the packages, with unused imports allowed. Every example
   compiles, runs, exports one component, renders, passes axe, and
   keeps to neutral sample data (the words in `DOMAIN_WORDS`, in
   `apps/docs/src/check/checks.ts`, are refused). A guide's examples are
   type-checked here too, since no package's own check reads `docs/`.
4. **Links lead somewhere**: a path no page is served at, a heading the
   page doesn't have, or a relative link (a file) fails.
5. **Generated files are current**: each `.md` copy, `page.schema.json`
   and each `docs/INDEX.md` must equal what the commands would write.
6. **The editor can save it**: saved with no edits the page and its copy
   come back byte for byte, and each block comes back unchanged through
   its form.
7. **Its name is safe**: no page is named `claude` or `agents`. Where a
   file's case is ignored, its copy would read as `CLAUDE.md` or
   `AGENTS.md`, and a Claude session there would take it as its
   instructions.

It also fails while a component folder in `@bh/ui` has no page.

## In an editor

`.vscode/settings.json` maps `**/*.doc.yaml` to `page.schema.json`, so
VS Code with Red Hat's YAML extension offers each block's name and
attributes as you type, and underlines a wrong one. The schema is
built from the site's blocks by `pageSchema`.

## In code

`parsePage` reads a page against a registry, checking the frontmatter
with a schema you pass. It gives the tree `DocView` draws, the items in
order, the headings, every block, and every problem on its line.
`pageMarkdown` writes the copy, and `pageLinks` lists every link with
its line, for the host to check, since only the host knows its pages. A
host with pages of its own reads them the way the site does:

```ts
import { createRegistry, markdownBlocks, pageLinks, pageMarkdown, parsePage } from '@bh/markdown';
import * as v from 'valibot';

const registry = createRegistry(markdownBlocks);
const meta = v.strictObject({ title: v.string(), summary: v.string() });

/** A page's markdown copy, or the problems that stop it, each on its line. */
export function copyOf(source: string, paths: ReadonlySet<string>): string {
  const page = parsePage(source, registry, { frontmatter: meta });
  const nowhere = pageLinks(page).filter((link) => {
    return link.href.startsWith('/') && !paths.has(link.href.split('#')[0] ?? '');
  });
  const problems = [
    ...page.issues.map((issue) => `line ${issue.line}: ${issue.message}`),
    ...nowhere.map((link) => `line ${link.line}: no page at ${link.href}`),
  ];
  if (problems.length > 0) {
    throw new Error(problems.join('\n'));
  }
  return pageMarkdown(page, registry, { title: String(page.frontmatter.title) });
}
```

## Rules

- Prose is a string written with `|`; a block is a mapping whose first
  key names it. Anything else is a problem on its line.
- Prose is never scanned for blocks: blocks are items, so a page writes
  each one one way.
- A heading item is `h2` or `h3`; any other name is read as a block's.
- A YAML page allows a block only the attributes its renderer declares,
  and none when it declares none.
- A block named by its main attribute (`- props: Button`) takes no body.
- The copy is written, never edited: `docs:check` fails on a `.md` that
  differs from what `pnpm docs:sync` writes.
- A heading's id is its text slugged, the same in the parse's list and
  on the element. Two headings with the same text share an id.

## Reference

```ts
parsePage(source: string, registry: RendererLookup, options?: PageOptions): ParsedPage
```

Parses a page written in YAML into the tree DocView draws, checking it as
it goes: the YAML itself, the shape of each item, each block's attributes
against what its renderer declares, each data block against its schema, and
the frontmatter against `options.frontmatter`.

| Parameter             | Type               | Default | Description                                                     |
| --------------------- | ------------------ | ------- | --------------------------------------------------------------- |
| `source` (required)   | `string`           |         |                                                                 |
| `registry` (required) | `RendererLookup`   |         |                                                                 |
| `options`             | `PageOptions`      | `{}`    |                                                                 |
| `options.frontmatter` | `StandardSchemaV1` |         | Checks the frontmatter: everything at the top level but `body`. |

Returns `ParsedPage`.

```ts
interface PageOptions
```

What `parsePage` checks beside the blocks.

| Member        | Type               | Default | Description                                                     |
| ------------- | ------------------ | ------- | --------------------------------------------------------------- |
| `frontmatter` | `StandardSchemaV1` |         | Checks the frontmatter: everything at the top level but `body`. |

```ts
interface ParsedPage extends ParsedDoc
```

A YAML page, parsed: the tree `DocView` draws, its items in order, and its problems.

| Member                       | Type                      | Default | Description                                                                                  |
| ---------------------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `items` (required)           | `PageItem[]`              |         | The body's items, top level only; a nested block is its parent's.                            |
| `frontmatterYaml` (required) | `string`                  |         | The frontmatter as written: the page's YAML without `body`.                                  |
| `issues` (required)          | `ParseIssue[]`            |         | Every problem, each on its line; none for a page that reads cleanly.                         |
| `frontmatter` (required)     | `Record<string, unknown>` |         | What the page says about itself: a document's `---` block, or a YAML page's keys but `body`. |
| `nodes` (required)           | `Node[]`                  |         | The page's own nodes, in order: markdown, and the blocks between it.                         |
| `headings` (required)        | `Heading[]`               |         | The headings in the page's own nodes, not those inside its blocks.                           |
| `blocks` (required)          | `BlockNode[]`             |         | Every block, nested ones too, each parent before the blocks inside it.                       |

```ts
type PageItem = …
```

One of a page's own items, as written, for a writer that walks them in
order. `index` is its place in `body`, which an edit names it by;
`nodes` are what it draws, for a host that draws the items one by one.

```ts
readPageFrontmatter(source: string): Record<string, unknown>
```

A YAML page's frontmatter alone, without reading its body: what a nav or an
index needs from every page up front. A page that doesn't parse has none.

| Parameter           | Type     | Default | Description |
| ------------------- | -------- | ------- | ----------- |
| `source` (required) | `string` |         |             |

Returns `Record<string, unknown>`.

```ts
const HEADING_ITEMS: Readonly<Record<string, number>>;
```

The headings a page writes as items: `- h2: Props`. Written as `- ## Props`, YAML reads a comment.

```ts
pageMarkdown(page: ParsedPage, registry: Registry, options?: PageMarkdownOptions): string
```

A parsed YAML page as plain markdown, frontmatter first.

| Parameter             | Type                                    | Default | Description                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page` (required)     | `ParsedPage`                            |         |                                                                                                                                                                                                                                 |
| `registry` (required) | `Registry`                              |         |                                                                                                                                                                                                                                 |
| `options`             | `PageMarkdownOptions`                   | `{}`    |                                                                                                                                                                                                                                 |
| `options.title`       | `string`                                |         | The page's title, written as its `# Title`.                                                                                                                                                                                     |
| `options.note`        | `string`                                |         | A line no viewer shows, written under the frontmatter: where the copy comes from.                                                                                                                                               |
| `options.link`        | `(href: string) => string \| undefined` |         | Where a link leads in the copy: given each destination as the page writes it, outside code, the one to write instead; undefined keeps it. A site writes its own paths as files here, so the copy's links work where it is read. |

Returns `string`.

```ts
interface PageMarkdownOptions
```

What `pageMarkdown` writes beside the page's own items.

| Member  | Type                                    | Default | Description                                                                                                                                                                                                                     |
| ------- | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` | `string`                                |         | The page's title, written as its `# Title`.                                                                                                                                                                                     |
| `note`  | `string`                                |         | A line no viewer shows, written under the frontmatter: where the copy comes from.                                                                                                                                               |
| `link`  | `(href: string) => string \| undefined` |         | Where a link leads in the copy: given each destination as the page writes it, outside code, the one to write instead; undefined keeps it. A site writes its own paths as files here, so the copy's links work where it is read. |

```ts
pageLinks(page: ParsedPage): PageLink[]
```

Every link a page writes: in its prose and headings, each on its own line,
and in its blocks, on the block's line. Images aren't links.

| Parameter         | Type         | Default | Description |
| ----------------- | ------------ | ------- | ----------- |
| `page` (required) | `ParsedPage` |         |             |

Returns `PageLink[]`.

```ts
interface PageLink
```

A link as a page writes it, on the page's line.

| Member            | Type     | Default | Description                                                                               |
| ----------------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `href` (required) | `string` |         | Its destination as written: `/components/primitives/button#props`, `#usage`, `https://…`. |
| `text` (required) | `string` |         | What it reads as; empty for a definition (`[name]: /path`).                               |
| `line` (required) | `number` |         |                                                                                           |

```ts
pageSchema(registry: Registry, options?: PageSchemaOptions): Record<string, unknown>
```

The JSON Schema a YAML page is written against, for an editor.

| Parameter             | Type                                                    | Default | Description                                                                                                                 |
| --------------------- | ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `registry` (required) | `Registry`                                              |         |                                                                                                                             |
| `options`             | `PageSchemaOptions`                                     | `{}`    |                                                                                                                             |
| `options.frontmatter` | `{ properties?: object; required?: readonly string[] }` |         | JSON Schema for the frontmatter, as an object schema: its `properties` and `required` become the page's own, beside `body`. |
| `options.jsonSchema`  | `(schema: StandardSchemaV1) => object`                  |         | Turns a data block's schema into JSON Schema; omitted, it takes any mapping.                                                |

Returns `Record<string, unknown>`.

```ts
interface PageSchemaOptions
```

What `pageSchema` takes from the host: the frontmatter's schema, and a JSON Schema converter.

| Member        | Type                                                    | Default | Description                                                                                                                 |
| ------------- | ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `frontmatter` | `{ properties?: object; required?: readonly string[] }` |         | JSON Schema for the frontmatter, as an object schema: its `properties` and `required` become the page's own, beside `body`. |
| `jsonSchema`  | `(schema: StandardSchemaV1) => object`                  |         | Turns a data block's schema into JSON Schema; omitted, it takes any mapping.                                                |
