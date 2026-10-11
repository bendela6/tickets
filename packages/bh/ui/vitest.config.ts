import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    setupFiles: ['./src/test/setup.ts'],
    // jest-dom's own `vitest` import must resolve to this run's instance, not to whichever
    // instance pnpm linked next to it: a second vitest runtime patches the shared chai
    // prototype twice and `rejects.toThrow` then catches a function instead of the error.
    server: { deps: { inline: ['@testing-library/jest-dom'] } },
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: testExclude,
    coverage,
  },
});
