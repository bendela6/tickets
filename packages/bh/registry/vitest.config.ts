import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  test: {
    // Node, with no DOM: a registry is data and functions, shared by servers and browsers.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: testExclude,
    coverage,
  },
});
