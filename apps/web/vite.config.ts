import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One React and one router, whichever package imports them: bh's copies are
  // workspace packages, and two copies make hooks and every Link in @bh/shell
  // fail at run time.
  resolve: { dedupe: ['react', 'react-dom', '@tanstack/react-router'] },
  server: {
    // 4610 by default; during the redesign the dockerized web owns 4610, so the
    // dev server runs on WEB_DEV_PORT=4620 and proxies /api to the docker api.
    port: Number(process.env.WEB_DEV_PORT ?? 4610),
    strictPort: true,
    proxy: {
      '/api': {
        // Defaults to the standard dev API; override with API_PROXY_TARGET to
        // point at an isolated stack (e.g. a second worktree on another port).
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4600',
      },
    },
  },
});
