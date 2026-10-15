import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // A hook runs in a component, so its tests render one, in a DOM.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // As in @bh/ui: jest-dom's own `vitest` import must resolve to this run's
    // instance, or a second runtime patches the shared chai prototype twice.
    server: { deps: { inline: ['@testing-library/jest-dom'] } },
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: testExclude,
    coverage,
  },
});
