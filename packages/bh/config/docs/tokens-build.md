---
title: 'tokens:build'
summary: Regenerate @bh/ui's stylesheets, token modules and safelist from its
  token files.
order: 7
related: [Colours, Typography, bh-format]
---

[//]: # 'written from tokens-build.doc.yaml by pnpm docs:sync; edit that file, not this one'

# tokens:build

Regenerate `@bh/ui`'s stylesheets, token modules and safelist from its
token files.

The tokens' source of record is `packages/web/ui/tokens/*.tokens.json`.
Everything made from them is written whole by this command and
committed. An app gets the result with its copy of `@bh/ui`, and never
runs it.

## Running it

```sh
pnpm tokens:build
pnpm --filter @bh/ui tokens:verify
```

`pnpm tokens:build` at bh's root runs `@bh/ui`'s own, which runs two
generators in turn. Run it after editing a token file, and after changing
a `variants()` call in `@bh/ui`.

`tokens:verify` runs the same, then `git diff --exit-code` over the
generated folders: it fails while a generated file differs from what is
committed.

## From the token files

`scripts/generators/build-tokens.ts` runs one generator per family. Each
reads its token file and writes a stylesheet into `styles/generated/`,
and, where code needs the values, a TypeScript module into
`src/style/generated/`, with an `index.ts` that re-exports the modules.

| Family        | Stylesheet                                             | Module                                                        |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `colors`      | each hue's steps, the surfaces and literals, per theme | `TONE_NAMES`, `ROLES`, `HUES`, `TONE_HUE`, `STEPS`, `PALETTE` |
| `typography`  | the `text-*` sizes and the fonts                       | `TEXT_SIZES`, `FONT_WEIGHTS`, `FONT_FAMILIES`                 |
| `border`      | `rounded-*` and the border widths, in pixels           | none                                                          |
| `motion`      | the easings and the animations                         | `DURATIONS`, `EASINGS`, `ANIMATIONS`                          |
| `shadows`     | the shadows, per theme                                 | `SHADOWS`                                                     |
| `breakpoints` | the breakpoints, in rem                                | `BREAKPOINTS` and `CONTAINERS`, in px                         |
| `spacing`     | `--spacing: 1px`                                       | `SPACING`                                                     |

`border` has no token file: it writes the utilities that make
`rounded-6` six pixels, which have no values to read. A stylesheet that
replaces one of Tailwind's namespaces (`--color-*`, `--text-*`,
`--radius-*`) clears it just above its own values, so no sheet wipes
another's and `tokens.css` imports them in any order.

## The safelist

`scripts/extract-safelist.mjs` starts Vite with no browser, loads
`@bh/ui`'s barrel, and asks every `variants()` call for each class it
can give. It writes them into `styles/generated/safelist.css`, sorted,
one line each:

```css
@source inline('active:bg-blue-4');
@source inline('active:bg-cyan-4');
```

A class a component builds from a template, `bg-${tone}-9`, is in no
source file for Tailwind's scanner to find. The safelist names each one,
so Tailwind writes its rule. That is why a change to a `variants()` call
needs the command too: a new tone or size has no rule in the stylesheet
until the safelist names it.

## Where the values show

The [Foundations](../../../web/ui/docs/foundations/colours.md) pages draw their tables from the
generated modules, so a page can't disagree with the stylesheet. `cn()`
reads `TEXT_SIZES`: tailwind-merge can't tell a size like `text-13` from
a colour, and a size it didn't know would drop the colour beside it.

## Rules

- `tokens/*.tokens.json` is the source. `styles/generated/` and
  `src/style/generated/` are output, written whole, never edited.
- The generated files are committed with the change that made them;
  `tokens:verify` fails while they differ.
- Prettier leaves them alone (`.prettierignore`), or `tokens:verify`
  would fail on its layout.
- An app never runs it: the generated files come with its copy of
  `@bh/ui`.
