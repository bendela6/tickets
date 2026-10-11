# @bh/config

The tooling every package and app shares: the ESLint presets (`base`, `react`,
`node`) with bh's own rules, the Prettier settings, the tsconfig presets, the
Madge settings and Vitest's coverage defaults, and the `bh-lint`, `bh-format`
and `bh-madge` commands that run them. It has no runtime code: an app takes it
so its lint, format and type checks match bh's.

## Docs

The Tooling guide is in [`docs/`](docs/INDEX.md): each command and preset,
what an app writes to wire it in, `tokens:build`, and how bh is released. Each
page is a `.doc.yaml` with its `.md` copy beside it; an app reads them in its
copy of the package, `packages/bh/config/docs/`. The docs site (`pnpm docs:dev`
in bh) shows them at `/tooling/overview`.

## Tests

`pnpm --filter @bh/config test` runs `node --test` over `tests/`: the presets
load and report what they should, and the Madge settings find a cycle.
