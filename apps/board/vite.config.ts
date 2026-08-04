import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The board's data lives on disk under ~/.claude, which a browser cannot read, so
// the client is a pure consumer of the local API in src/server. In dev, Vite proxies
// /api to it; in a build, the same server serves dist/ as static files.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.BOARD_WEB_PORT ?? 4681),
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BOARD_PORT ?? 4680}`,
      },
    },
  },
  build: { outDir: 'dist' },
});
