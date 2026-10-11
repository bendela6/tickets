/**
 * Vitest's `test.coverage` as bh measures it: V8, over `src/`, the tests,
 * declaration files and barrels left out, written as text, HTML and lcov to
 * `./coverage`.
 *
 * `vitest run --coverage` needs `@vitest/coverage-v8` in the package.
 */
export const coverage = {
  provider: 'v8' as const,
  reporter: ['text', 'html', 'lcov'],
  reportsDirectory: './coverage',
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/**/index.ts', 'src/**/__tests__/**'],
};

/**
 * Vitest's `test.exclude`: installs and build output, so a test copied into
 * `dist/` or `build/` never runs twice.
 *
 * Setting `exclude` replaces Vitest's own list, so this one restates
 * `node_modules`.
 */
export const testExclude = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.turbo/**'];
