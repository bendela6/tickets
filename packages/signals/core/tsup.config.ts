import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // tsup 8.5's dts bundler (rollup-plugin-dts) unconditionally injects a
  // `baseUrl` compiler option into the program it builds for declaration
  // bundling, which TypeScript 6 treats as a hard deprecation error (TS5101).
  // Scope the escape hatch to just this dts step via `dts.compilerOptions`
  // (which tsup documents as taking priority over tsconfig.json) instead of
  // setting `ignoreDeprecations` in tsconfig.json, which would silence real
  // deprecation warnings for typecheck/editors across the whole package.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  clean: true,
});
