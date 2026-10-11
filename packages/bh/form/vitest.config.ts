import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // jest-dom's own `vitest` import must resolve to this run's instance, not to whichever
    // instance pnpm linked next to it: a second vitest runtime patches the shared chai
    // prototype twice and `rejects.toThrow` then catches a function instead of the error.
    server: { deps: { inline: ['@testing-library/jest-dom'] } },
    exclude: testExclude,
    coverage,
  },
});
