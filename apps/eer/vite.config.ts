import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { modelsApiPlugin } from './vite-plugins/models-api';

export default defineConfig({
  plugins: [react(), tailwindcss(), modelsApiPlugin()],
  server: {
    port: Number(process.env.EER_DEV_PORT ?? 4630),
    strictPort: true,
  },
});
