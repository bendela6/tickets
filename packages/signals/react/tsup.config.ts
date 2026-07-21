import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm', 'cjs'],
  // tsup 8.5's dts bundler injects a `baseUrl` compiler option that TypeScript 6
  // treats as a hard deprecation error (TS5101). Scope the escape hatch to just
  // the dts step via `dts.compilerOptions` (higher priority than tsconfig.json)
  // instead of `ignoreDeprecations` in tsconfig.json, which would silence real
  // deprecation warnings for typecheck/editors across the whole package.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  clean: true,
  external: ['react'],
});
