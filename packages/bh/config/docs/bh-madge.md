---
title: bh-madge
summary: Find the import cycles in a package's TypeScript, type-only imports aside.
order: 4
related: [bh-lint, tsconfig presets]
---

[//]: # 'written from bh-madge.doc.yaml by pnpm docs:sync; edit that file, not this one'

# bh-madge

Find the import cycles in a package's TypeScript, type-only imports
aside.

`bh-madge` runs Madge over the paths you give it, with `@bh/config`'s
settings, and fails on any cycle: a module that, through what it imports,
imports itself.

## Running it

```sh
bh-madge src
```

Each bh package has it as `check:circular`, and `pnpm check:circular` at
the root runs them all. It runs from the package's folder, since Madge
reads the `tsconfig.json` there. With no path it stops, and exits 2.

With no cycle it counts the files it read, and exits 0:

```text
✔ No circular dependency found (63 files)
```

With one or more, it names each, a file to the next in the order they
import each other, and exits 1:

```text
✖ Found 2 circular dependencies:
  1) rows/rows.ts > rows/columns.ts
  2) plants/list.ts > plants/filters.ts > plants/sort.ts
```

## What counts

- **The `.ts` and `.tsx` files** under the paths given. `.d.ts` files,
  and anything in a `node_modules`, `dist` or `.legacy` folder, are left
  out.
- **A value import is an edge, a type import is not.** `import type` is
  gone from the JavaScript, so two modules whose types name each other
  still load in either order.
- **`import.meta.glob` is no import to Madge.** The docs site globs its
  pages and examples, and a globbed module that imports back is no cycle.

## Breaking a cycle

Two modules that need each other's values usually share a third thing:
move it to a module of its own, which both import. Where one needs only
the other's types, `import type` takes the edge away, and the lint's
`consistent-type-imports` asks for it anyway
([bh-lint](bh-lint.md#what-base-asks)).

## Rules

- No module of a package imports itself through its values.
- A type import is no edge.
- It runs from the package's folder, where its `tsconfig.json` is.
