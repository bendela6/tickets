import { defineConfig } from 'tsup';

export default defineConfig([
  { entry: ['src/index.ts'], format: ['esm', 'cjs'], dts: true, sourcemap: true, clean: true },
  {
    entry: { sdk: 'src/auto.ts' },
    format: ['iife'],
    globalName: 'Signals',
    sourcemap: false,
    minify: true,
    outExtension: () => ({ js: '.js' }),
  },
]);
