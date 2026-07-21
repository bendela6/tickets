import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        // Proxy WebSocket upgrades too (the AI session socket lives under /api).
        // Without this the upgrade is proxied as a plain GET and never opens.
        ws: true,
      },
      '/signals-api': {
        // The signals collector's routes are unprefixed (/issues, not
        // /signals-api/issues) — rewrite strips our proxy prefix before
        // forwarding.
        target: process.env.SIGNALS_PROXY_TARGET ?? 'http://127.0.0.1:4640',
        rewrite: (path) => path.replace(/^\/signals-api/, ''),
      },
    },
  },
});
