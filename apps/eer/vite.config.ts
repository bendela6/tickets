import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { drizzleApiPlugin } from './vite-plugins/drizzle-api';
import { modelsApiPlugin } from './vite-plugins/models-api';

export default defineConfig({
  plugins: [react(), tailwindcss(), modelsApiPlugin(), drizzleApiPlugin()],
  server: {
    port: Number(process.env.EER_DEV_PORT ?? 4630),
    strictPort: true,
    proxy: {
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
