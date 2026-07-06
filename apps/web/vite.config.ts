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
        target: 'http://127.0.0.1:4600',
      },
    },
  },
});
