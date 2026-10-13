import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // As in vite.config.ts: one React and one router, whichever package imports
  // them. bh's copies are workspace packages with routers of their own, and
  // @bh/shell's hooks find no router in a second copy.
  resolve: { dedupe: ['react', 'react-dom', '@tanstack/react-router'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
