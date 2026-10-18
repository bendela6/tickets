---
title: Overview
summary: What @bh/config gives a project, and the files that wire it into an app.
order: 1
related: [bh-lint, tsconfig presets, Adding bh to an app]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

What `@bh/config` gives a project, and the files that wire it into an app.

It holds the rules bh's own code is written to: an ESLint preset for each
kind of project, Prettier's settings, TypeScript's compiler options,
Vitest's coverage, commands that run the tools from its own dependencies,
and the release command. An app that takes it is checked as bh is.

## What it holds

| Import                         | What                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| `@bh/config/eslint/base`       | ESLint for any TypeScript: the typed rules, and bh's own              |
| `@bh/config/eslint/react`      | `base`, with React's and the hooks' rules and the browser's globals   |
| `@bh/config/eslint/node`       | `base`, with Node's globals, and `process.env` read in one file       |
| `@bh/config/prettier`          | Prettier's settings, with Tailwind's class sorter                     |
| `@bh/config/tsconfig/base`     | The compiler options every project shares                             |
| `@bh/config/tsconfig/react`    | `base`, with JSX and the DOM                                          |
| `@bh/config/tsconfig/node`     | `base`, with Node's types and no DOM                                  |
| `@bh/config/tsconfig/package`  | `base`, with declarations and source maps, for a package `tsc` builds |
| `@bh/config/madge`             | Madge's settings, which `bh-madge` reads                              |
| `@bh/config/vitest/coverage`   | `coverage` and `testExclude`, for a `vitest.config.ts`                |
| `@bh/config/release/changelog` | The `CHANGELOG.md` reader and writer [Releases](releases.md) uses     |

And these commands:

| Command           | Runs                                                |
| ----------------- | --------------------------------------------------- |
| `bh-lint`         | ESLint, with the arguments you give it              |
| `bh-format`       | Prettier, with the arguments you give it            |
| `bh-madge`        | Madge over the paths you give it, for import cycles |
| `bh-release`      | A repo's `pnpm release`: [Releases](releases.md)    |
| `bh-hooks`        | A repo's `prepare`: installs the commit-msg hook    |
| `bh-commit-check` | That hook: refuses a bad header or a ticket id      |

Each runs its tool from `@bh/config`'s own dependencies. A project lists
`@bh/config`, and no ESLint, Prettier or Madge of its own, so every
project runs one version of each.

## Wiring it into an app

The app takes `config`, as every app does: it is in the packages the
gateway's bh page lists for it
([Adding bh to an app](../../../../apps/docs/content/getting-started/adding-bh.md)), and its copy in
`packages/bh/config` is a workspace package like the others. The root
depends on it, names its Prettier settings, and has the commands that run
over the whole repo:

```json
{
  "scripts": {
    "format": "bh-format --write .",
    "format:check": "bh-format --check .",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "prepare": "bh-hooks",
    "release": "bh-release"
  },
  "devDependencies": {
    "@bh/config": "workspace:*"
  },
  "prettier": "@bh/config/prettier"
}
```

The root's `eslint.config.js` spreads a preset, and leaves the copies
alone: they are linted in bh, where they are written.

```js
import base from '@bh/config/eslint/base';

export default [{ ignores: ['packages/bh/**'] }, ...base];
```

Each project lists it too, since pnpm puts a package's commands only on
the path of the projects that depend on it. Its scripts name its own
folders, and its `tsconfig.json` extends a preset:

```json
{
  "scripts": {
    "lint": "bh-lint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@bh/config": "workspace:*"
  }
}
```

```json
{
  "extends": "@bh/config/tsconfig/react",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

Each tool has its page: [bh-lint](bh-lint.md) for the presets and a
project's own `eslint.config.js`, [bh-format](bh-format.md),
[bh-madge](bh-madge.md), [tsconfig presets](tsconfig.md) and
[Vitest](vitest.md).

## The commands in bh

bh's root runs each over every package that has the script:

| Command               | Runs                                                            |
| --------------------- | --------------------------------------------------------------- |
| `pnpm lint`           | each package's `lint`: `bh-lint` over its folders               |
| `pnpm format`         | `bh-format --write .`; `pnpm format:check` changes nothing      |
| `pnpm typecheck`      | each package's `tsc --noEmit`                                   |
| `pnpm check:circular` | each package's `bh-madge src`                                   |
| `pnpm test`           | each package's tests                                            |
| `pnpm release`        | versions what changed, with changelogs: [Releases](releases.md) |
| `pnpm tokens:build`   | `@bh/ui`'s [token generator](tokens-build.md)                   |

## Rules

- A project runs ESLint, Prettier and Madge as `bh-lint`, `bh-format` and
  `bh-madge`, and lists `@bh/config`, not the tools.
- The copies in `packages/bh` are linted and formatted in bh; an app's
  config leaves them out.
- A config file is not linted: `base` ignores `eslint.config.js` and
  every `*.config.{js,mjs,cjs,ts}`.
