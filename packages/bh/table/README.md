# @bh/table

The table engine. A table is an array of rows and a list of columns; `<Table>`
sorts them, sizes and resizes the columns, selects rows, moves a focused cell
with the keyboard, folds rows into collapsible groups, pins columns to an edge
and windows a long list so only the rows on screen are drawn. `useTable` holds
the state every table needs (sort, widths, collapsed groups, focus,
selection) in one hook, spread straight onto `<Table>`.

It draws nothing itself: every header, row, cell, band and empty or failed
state comes from a **render set** of named slots handed in as `render`. That is
why it is its own package: the behaviour is tested against a bare stub skin
(`makeStubRender`), apart from any styling. `@bh/ui`'s skin is
`tableRender<T>()`, with its column renderers (`TextColumn`, `NumberColumn`,
`DateColumn` and the rest).

## Docs

The Tables guide is in [`docs/`](docs/INDEX.md): twelve pages, from columns
and `useTable` to writing a skin, with the package's rules and its reference.
Each page is a `.doc.yaml` with its `.md` copy beside it; an app reads them
in its copy of the package, `packages/bh/table/docs/`. The docs site (`pnpm docs:dev`
in bh) shows them at `/tables/overview`, with the examples live.

## Layer

Depends on `@tanstack/react-virtual`, with React as a peer. Of bh's packages,
only `@bh/ui` depends on it.
