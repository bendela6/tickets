# @bh/code

Everything code. `CodeBlock` shows a fragment to read, its lines numbered and
the ones a passage is about marked; `CodeEditor` writes one (a script, a
Dockerfile, a YAML file), growing with its text. Both colour through one
syntax map, `SYNTAX_CLASSES` and `SYNTAX_TAGS`, which `SYNTAX_HIGHLIGHTER`
hands an editor of your own and `highlightLines` turns into React nodes, so a
fragment on a page and the same text being edited look the same.
`@bh/markdown`'s code block is this `CodeBlock`.

## Docs

The guide is in [`docs/`](docs/INDEX.md): the overview, `CodeBlock` and
`CodeEditor`, with the package's rules and its reference. Each page is a
`.doc.yaml` with its `.md` copy beside it; an app reads them in its copy of the
package, `packages/bh/code/docs/`. The docs site (`pnpm docs:dev` in bh) shows
them at `/code/overview`.

## Layer

Built on `@bh/ui`, which draws the strip and its copy control; an app that
takes it takes `ui` and what `ui` needs. `@bh/markdown` sits on it. It
depends on the `@lezer` grammars and on CodeMirror (`@codemirror/view`,
`state`, `commands`, `language`, `lang-yaml` and `legacy-modes`, for shell and
Dockerfiles), with `react` and `tailwindcss` as peers. An app imports
`@bh/code/styles.css` after `@bh/ui/tokens.css` (markdown's sheet imports it).
