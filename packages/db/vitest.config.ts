import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Several test files share a live Postgres database and a fixed key
    // (schemes.key = 'software': seed-scheme.test.ts and
    // import/import-legacy.test.ts both create and clean up that row).
    // Running test files in parallel would race two inserts of the same
    // unique key against each other. Keep file execution sequential so each
    // file's beforeAll/afterAll fully owns the database between them.
    fileParallelism: false,
  },
});
