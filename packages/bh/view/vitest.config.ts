import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  test: {
    // Node, with no DOM: a view is data, which servers check and store as browsers draw it.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: testExclude,
    coverage,
  },
});
