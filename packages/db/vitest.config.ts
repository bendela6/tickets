import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

// import-history.test.ts inspects data that only import-legacy.test.ts
// writes (it has no beforeAll of its own that imports anything — see its
// header comment "run after import-legacy.test.ts"). vitest's default
// sequencer reorders files using cached per-file durations from the
// previous run, so plain declaration/glob order is NOT a reliable way to
// guarantee that relationship — pin it explicitly.
class ImportOrderSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files);
    const legacyIdx = sorted.findIndex((f) => f.moduleId.endsWith('import-legacy.test.ts'));
    const historyIdx = sorted.findIndex((f) => f.moduleId.endsWith('import-history.test.ts'));
    if (legacyIdx !== -1 && historyIdx !== -1 && legacyIdx > historyIdx) {
      const [legacy] = sorted.splice(legacyIdx, 1);
      sorted.splice(historyIdx, 0, legacy!);
    }
    return sorted;
  }
}

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
    sequence: { sequencer: ImportOrderSequencer },
  },
});
