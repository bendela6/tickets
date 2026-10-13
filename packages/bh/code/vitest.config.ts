import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // As in @bh/table: jest-dom's own `vitest` import must resolve to this
    // run's instance, or a second runtime patches the shared chai prototype twice.
    server: { deps: { inline: ['@testing-library/jest-dom'] } },
    // A test that silences console.error for a throwing block gets it back.
    restoreMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: testExclude,
    coverage,
  },
});
