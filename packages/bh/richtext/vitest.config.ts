import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { coverage, testExclude } from '@bh/config/vitest/coverage';

// Two runs: the core in Node, with no DOM, as on a server, since it has to
// load and convert there; and the editor in jsdom, drawn with React.
export default defineConfig({
  test: {
    coverage,
    projects: [
      {
        test: {
          name: 'core',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...testExclude, 'src/editor/**'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'editor',
          environment: 'jsdom',
          setupFiles: ['./src/editor/test/setup.ts'],
          // As in @bh/code: jest-dom's own `vitest` import must resolve to this
          // run's instance, or a second runtime patches the shared chai prototype twice.
          server: { deps: { inline: ['@testing-library/jest-dom'] } },
          restoreMocks: true,
          include: ['src/editor/**/*.test.{ts,tsx}'],
          exclude: testExclude,
        },
      },
    ],
  },
});
