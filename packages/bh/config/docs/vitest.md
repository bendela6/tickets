---
title: Vitest
summary: The coverage and exclusions every vitest.config.ts shares, and the
  setup bh's packages test with.
order: 6
related: [tsconfig presets, bh-lint]
---

[//]: # 'written from vitest.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Vitest

The coverage and exclusions every `vitest.config.ts` shares, and the
setup bh's packages test with.

`@bh/config/vitest/coverage` holds the two settings every package shares.
The rest of a `vitest.config.ts` is the project's: here, as bh's React
packages write it.

## A config

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    server: { deps: { inline: ['@testing-library/jest-dom'] } },
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: testExclude,
    coverage,
  },
});
```

- **`coverage`**: V8's, over `src/`, with the tests, declaration files
  and `index.ts` barrels left out; written as text, HTML and lcov to
  `./coverage`.
- **`testExclude`**: `node_modules`, `dist`, `build` and `.turbo`.
  Setting `exclude` replaces Vitest's own list, so it names
  `node_modules` again, and `dist` keeps a test `tsc` built there from
  running twice.
- **`server.deps.inline`**: jest-dom's own `vitest` import then resolves
  to this run's Vitest, not to whichever one pnpm linked beside
  jest-dom. A second Vitest patches the shared assertions twice, and
  `rejects.toThrow` then catches a function instead of the error.

## The setup file

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

jest-dom adds its matchers (`toBeInTheDocument`, `toHaveAttribute`) to
`expect`, and `cleanup` takes away what a test rendered. With
`globals: true`, the project's `tsconfig.json` names both sets of types:

```json
"types": ["vitest/globals", "@testing-library/jest-dom/vitest"]
```

jsdom lacks some of what the overlays use. `@bh/ui`'s own setup adds
`ResizeObserver`, `matchMedia`, `scrollIntoView` and pointer capture
where they are missing; an app whose tests open a popover, a menu or a
dialog adds the same (see `packages/bh/ui/src/test/setup.ts`).

## Coverage

```sh
vitest run --coverage
```

It needs `@vitest/coverage-v8` in the package's dev dependencies, as
`@bh/form` has it for its `test:coverage`. The report goes to
`coverage/`, which bh's `.gitignore` leaves out: it is never committed,
so never part of a [release's copy](../../../../apps/docs/content/getting-started/versions.md#what-a-copy-is).

## A Node project

```ts
import { defineConfig } from 'vitest/config';
import { testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: testExclude,
  },
});
```

## Rules

- A test sits beside the code it tests, as `*.test.ts` or `*.test.tsx`
  under `src/`.
- Coverage measures `src/` alone, with tests and barrels aside.
- A test that renders runs in jsdom, and cleans up after itself.

## Reference

```ts
const coverage: {
  provider: 'v8';
  reporter: string[];
  reportsDirectory: string;
  include: string[];
  exclude: string[];
};
```

Vitest's `test.coverage` as bh measures it: V8, over `src/`, the tests,
declaration files and barrels left out, written as text, HTML and lcov to
`./coverage`.

`vitest run --coverage` needs `@vitest/coverage-v8` in the package.

```ts
const testExclude: string[];
```

Vitest's `test.exclude`: installs and build output, so a test copied into
`dist/` or `build/` never runs twice.

Setting `exclude` replaces Vitest's own list, so this one restates
`node_modules`.
