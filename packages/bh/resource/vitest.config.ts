import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  test: {
    // Node, with no DOM, as on a server: servers and browsers both take the contract.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: testExclude,
    coverage,
  },
});
