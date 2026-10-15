# @bh/shell

The app frame every app mounts inside: the sidebar with its nav rows, groups
and icon rail, the phone-width top bar and drawer, the search dialog, the
theme, and the page layout (`@bh/shell/layout`), with a reading page's
outline of its sections and pager to the pages either side. The apps carried
copies of the same frame, which had already drifted; this package is the one
copy. The app hands in what is its own (its nav, brand, footer and storage
keys), and the frame keeps no data and no words of any app.

## Docs

The Shell guide is in [`docs/`](docs/INDEX.md): AppShell, navigation data,
the sidebar's parts, the theme, pages, the search dialog, and a page's
outline and pager, with the package's rules and its reference. Each page is a
`.doc.yaml` with its `.md` copy beside it; an app reads them in its copy of
the package, `packages/bh/shell/docs/`. The docs site (`pnpm docs:dev` in bh)
shows them at `/shell/app-shell`, with the frame live at phone and tablet
widths.

## Layer

Built on `@bh/ui`, with no primitives of its own. Peers: `react`,
`react-dom`, `@tanstack/react-router`, `lucide-react` and `tailwindcss`. An
app imports `@bh/shell/styles.css` after `@bh/ui/tokens.css`.
