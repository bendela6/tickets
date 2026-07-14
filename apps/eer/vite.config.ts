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
  },
});
