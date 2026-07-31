import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Open at `localhost:4670`, never `127.0.0.1:4670`: Vite binds IPv6 only by
  // default and Windows resolves `localhost` to `::1` first, so the IP form is
  // refused. strictPort, so a stale server is a hard failure rather than a
  // silent move to another port the docs would then be wrong about.
  server: { port: 4670, strictPort: true },
});
