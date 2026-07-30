import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { iconWriter } from './src/plugin/icon-writer';

// This file lives at packages/web/icon-studio, so the repo root is three up.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export default defineConfig({
  root: 'dev',
  plugins: [react(), tailwindcss(), iconWriter({ repoRoot })],
  server: { port: 4660, strictPort: true },
});
