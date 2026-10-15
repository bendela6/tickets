# @bh/code

Everything code. `CodeBlock` shows a fragment to read, its lines numbered and
the ones a passage is about marked; `CodeEditor` writes one (a script, a
Dockerfile, a YAML file, TSX or markdown), growing with its text. Both colour
through one syntax map, `SYNTAX_CLASSES` and `SYNTAX_TAGS`, which
`SYNTAX_HIGHLIGHTER` hands an editor of your own and `highlightLines` turns
into React nodes, so a fragment on a page and the same text being edited look
the same, and both mark the lines a problem is on alike.
`@bh/markdown`'s code block is this `CodeBlock`. `ExamplePanel` shows what a
piece of code draws beside the code, which the app's editor can take, with
its problems listed, a split and a height that drag, and full screen.

## Docs

The guide is in [`docs/`](docs/INDEX.md): the overview, `CodeBlock`,
`CodeEditor` and `ExamplePanel`, with the package's rules and its reference.
Each page is a `.doc.yaml` with its `.md` copy beside it; an app reads them in
its copy of the package, `packages/bh/code/docs/`. The docs site (`pnpm docs:dev` in bh) shows
them at `/code/overview`.

## Layer

Built on `@bh/ui`, which draws the strip, the controls and the full-screen
dialog, and on `@bh/hooks`, whose handles and measure the example panel's
split and height drag with; an app that takes it takes `ui` and what `ui`
needs, `hooks` among them. `@bh/markdown` sits on it. It depends on the
`@lezer` grammars and on CodeMirror (`@codemirror/view`, `state`,
`commands`, `language`, `lang-yaml`, `lang-javascript`, `lang-markdown` and
`legacy-modes`, for shell and Dockerfiles), with `react` and `tailwindcss` as
peers. An app imports `@bh/code/styles.css` after
`@bh/ui/tokens.css` (markdown's sheet imports it).
