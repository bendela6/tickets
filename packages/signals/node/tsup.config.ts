import { defineConfig } from 'tsup';

// NOTE: a second config object for `src/cli.ts` (ESM-only, with the
// `#!/usr/bin/env node` banner) is added in Task 9 once that entry exists.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
});
