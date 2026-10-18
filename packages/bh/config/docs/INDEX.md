# @bh/config

[//]: # 'written by pnpm docs:index from each page’s frontmatter; edit the pages, not this file'

Every page in this package, as the docs site groups them. Each link is the page’s
markdown copy: its prose, its examples’ code, and its props tables from the types.

## Tooling

- [Overview](../docs/overview.md): What @bh/config gives a project, and the files that wire it into an app.
- [bh-lint](../docs/bh-lint.md): ESLint with bh's presets: base for any TypeScript, react and node on top of it, and bh's own rule.
- [bh-format](../docs/bh-format.md): Prettier with bh's settings, Tailwind's class order, and the files it leaves alone.
- [bh-madge](../docs/bh-madge.md): Find the import cycles in a package's TypeScript, type-only imports aside.
- [tsconfig presets](../docs/tsconfig.md): The compiler options every bh project shares, and the presets for React, Node and a package tsc builds.
- [Vitest](../docs/vitest.md): The coverage and exclusions every vitest.config.ts shares, and the setup bh's packages test with.
- [tokens:build](../docs/tokens-build.md): Regenerate @bh/ui's stylesheets, token modules and safelist from its token files.
- [Releases](../docs/releases.md): bh-release, a repo's pnpm release: a version for every package, service and stack, with changelogs, from the commits since each was last versioned.
