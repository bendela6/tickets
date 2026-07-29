import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'dev',
  plugins: [react(), tailwindcss()],
  server: { port: 4660, strictPort: true },
});
