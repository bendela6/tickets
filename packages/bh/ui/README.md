# @bh/ui

**Instrument**, the apps' design system: one set of tokens and the components
that spend them. A token is a CSS custom property generated from
`tokens/*.tokens.json`; a component is a React component styled with Tailwind
utilities over those tokens and nothing else. Beside the controls, layout,
navigation, overlays and feedback, it holds the skins for bh's engines: the
`@bh/form` registry (`baseInputs`, `FieldWrapper`), the `@bh/table` render
set (`tableRender<T>()` and its columns), and the renderers and layouts a
`@bh/template` template names (`baseRenderers`, `baseTemplateLayouts`).
`@bh/markdown` draws its blocks and Prose with this package. The stylesheet
is its own export, `@bh/ui/tokens.css`.

It is one package because the tokens have to be one artefact: a colour ramp,
a spacing unit and a radius scale are worth having only if every screen
resolves them the same way, from one generated stylesheet. It began in the
`tickets` repo, moved to `items-core` on 2026-09-06 and was extracted here on
2026-09-28.

## Docs

The pages are beside what they document: each component's `.doc.yaml` and
examples sit in its folder under `src/library/`, and the foundations (colours,
tones, type, spacing, radius, elevation, motion, layout, dark mode) are in
[`docs/foundations/`](docs/foundations). [`docs/INDEX.md`](docs/INDEX.md)
lists them all. Each page has its `.md` copy beside it; an app reads them
in its copy of the package, `packages/bh/ui/`. The docs site (`pnpm docs:dev` in bh)
shows them under `/components/` and `/foundations/`, with the examples live.

## Tokens

`tokens/*.tokens.json` is the source. `pnpm tokens:build` writes
`styles/generated/` and `src/style/generated/` from it, with the safelist;
never edit those by hand. `pnpm --filter @bh/ui tokens:verify` rebuilds and
fails if anything moved. The Tooling guide's `tokens:build` page has the rest.

## Layer

Built on `@bh/form`, `@bh/table`, `@bh/template` and `@bh/resource`, whose
filter tree and field metadata a filter form's rules draw; an app that takes
`ui` takes those too. It depends on `radix-ui`, `clsx`, `tailwind-merge` and `valibot`, with
`react` and `tailwindcss` as peers. `@bh/shell` and `@bh/markdown` are built
on it.
