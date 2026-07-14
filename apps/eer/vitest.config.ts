import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['src/node/**', 'node'],
      // The export-drizzle gate test loads generated source off disk via
      // drizzle-kit/api and dynamic import() — needs real Node, not jsdom.
      ['src/engine/model/export-drizzle/**', 'node'],
      // The real-schema round-trip gate loads generated source off disk and
      // shells out to tsc — needs real Node, not jsdom.
      ['src/test/gate/**', 'node'],
    ],
  },
});
