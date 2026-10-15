# @bh/hooks

The React hooks bh's packages and the apps share: the ones each package, and
app after app, wrote again for itself. A hook holds state and behaviour and
draws nothing: no component, no markup and no stylesheet. The component that
calls it draws, with the styles of whichever package it is in.

Its hooks are listed on its [overview](docs/overview.md). Each moved in from
the package that wrote it, with its tests and its page.

## Docs

The Hooks guide is in [`docs/`](docs/INDEX.md). Each page is a `.doc.yaml`
with its `.md` copy beside it; an app reads them in its copy of the package,
`packages/bh/hooks/docs/`. The docs site (`pnpm docs:dev` in bh) shows them
at `/hooks/overview`.

## Layer

It is below every other bh package: `@bh/ui`, `@bh/table`, `@bh/code`,
`@bh/shell` and `@bh/markdown` import it, and it imports none of them. Its code imports React alone, a peer,
and its files are `.ts`, where no JSX can be written; a test
(`hooks-only.test.ts`) reads them to keep it so, and the lint holds it to no
other `@bh/*` import.
