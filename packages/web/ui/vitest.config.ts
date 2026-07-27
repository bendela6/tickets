import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Vitest stubs CSS modules to an empty string by default, which also
    // empties `tokens.css?raw` — and foundation.ts reads the live token values
    // out of exactly that import. Processing CSS keeps the raw text intact.
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
