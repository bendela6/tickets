# @bh/markdown

The markdown engine. A document is markdown with frontmatter and **typed
blocks** (a fence whose language is a registered name, or a `:::name`
directive), or a page written in YAML, a list of prose, headings and block
items, as the docs site's pages are. A **registry** of renderers says what
each block's body is, how to check it and how to draw it. The package parses
either form into one tree, checks it, draws it with the host's own elements,
writes a YAML page's markdown copy, edits a page keeping its comments, and
writes the block reference a model reads before it writes a document
(`toPrompt`).

The engine draws plain HTML, or the host's own elements. Beside it are the
blocks drawn with `@bh/ui` (`markdownBlocks`: callout, code, keyboard, badge,
transcript, api, erd and lifecycle), the error card a host hands `DocView`,
the highlighter that colours code, and `Prose` for text the app didn't
write, so an app showing documents and the docs site share one engine and
one look. It came from docs-renderer's
`@docs/core`; its schemas are any Standard Schema, so valibot's work as they
are.

## Docs

The Markdown guide is in [`docs/`](docs/INDEX.md): writing a page, markdown
documents, rendering, the block registry, live examples, the page editor and
`toPrompt`, with the package's rules and its reference. Each page is a
`.doc.yaml` with its `.md` copy beside it; an app reads them in its copy of
the package, `packages/bh/markdown/docs/`. The docs site (`pnpm docs:dev` in bh)
shows them at `/markdown/overview`, and a page for every block at
`/markdown/blocks/<name>`.

## Layer

Built on `@bh/ui`, which draws the blocks and Prose; an app that takes it
takes `ui` and what `ui` needs. It depends on `yaml`, mdast's markdown and
GFM parsers, `@standard-schema/spec`, the `@lezer` grammars and `valibot`,
with `react` and `tailwindcss` as peers. An app imports
`@bh/markdown/styles.css` after `@bh/ui/tokens.css`.
