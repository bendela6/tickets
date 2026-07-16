import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    // Several test files share a live Postgres database and a fixed key
    // (schemes.key = 'software': seed-scheme.test.ts, import/import-legacy.test.ts
    // and import/import-history.test.ts each create and clean up that row).
    // Running test files in parallel would race two inserts of the same
    // unique key against each other. Keep file execution sequential so each
    // file's beforeAll/afterAll fully owns the database between them — every
    // file is now self-sufficient (each sets up and tears down its own data),
    // so file *order* no longer matters, only that they don't overlap.
    fileParallelism: false,
  },
});
