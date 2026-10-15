import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  test: {
    // Node, with no DOM: a source runs on a server.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: testExclude,
    coverage,
  },
});
