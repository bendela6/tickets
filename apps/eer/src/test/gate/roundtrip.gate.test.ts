// The gate (Task 7 of the drizzle-roundtrip plan): proves apps/eer round-trips
// the repo's REAL 18-table drizzle schema with nothing lost.
//
//   describe (real schema) -> import -> export -> load generated module
//     Gate A: describeDrizzle(regenerated) deep-equals describeDrizzle(original)
//     Gate B: drizzle-kit's own migration diff between the two is empty
//     Gate C: the generated file passes `tsc --noEmit --strict`
//
// Node-only (see vitest.config.ts's environmentMatchGlobs): loadGeneratedModule
// writes to disk and dynamically imports, and the second test shells out to tsc.
//
// Import the schema BARREL by relative path, never the `@tickets/db` package
// root (`src/index.ts`) — that pulls in client.ts/environment.ts, which touch
// a live DB connection and process.env and are unsafe to import in a test.
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { expect, it } from 'vitest';

import * as realSchema from '../../../../../packages/db/src/schema/index';
import { describeDrizzle } from '../../node/describe-drizzle';
import { importDrizzle } from '../../engine/model/import-drizzle';
import { exportDrizzle } from '../../engine/model/export-drizzle';
import { loadGeneratedModule } from '../helpers/load-generated-module';

// Same rationale as load-generated-module.ts: the generated file's bare
// imports (`drizzle-orm`, `drizzle-orm/pg-core`) only resolve — for tsc's
// module resolution as much as Node's/Vite's — from a directory that has
// apps/eer/node_modules as an ancestor. The OS tmp dir does not.
const EER_ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))); // src/test/gate -> apps/eer

it('round-trips @tickets/db with nothing lost', async () => {
  const before = describeDrizzle(realSchema as Record<string, unknown>, []);
  const { model, report } = importDrizzle(before, null);

  expect(report.blocksExport).toBe(false);
  expect(model.entities).toHaveLength(18);
  expect(model.enums).toHaveLength(3);

  const source = exportDrizzle(model);
  const regenerated = await loadGeneratedModule(source); // temp .ts + import

  // Gate A — our canonical descriptor
  const after = describeDrizzle(regenerated, []);
  expect(after).toEqual(before);

  // Gate B — drizzle-kit's own opinion
  const migration = await generateMigration(
    await generateDrizzleJson(realSchema as Record<string, unknown>),
    await generateDrizzleJson(regenerated),
  );
  expect(migration).toEqual([]);
}, 30_000);

it('the generated file typechecks', async () => {
  const before = describeDrizzle(realSchema as Record<string, unknown>, []);
  const { model } = importDrizzle(before, null);
  const source = exportDrizzle(model);

  const dir = await mkdtemp(join(EER_ROOT, 'node_modules', '.eer-tsc-'));
  const file = join(dir, 'schema.generated.ts');
  try {
    await writeFile(file, source, 'utf8');

    const { status, stdout, stderr } = spawnSync(
      'npx',
      [
        'tsc',
        '--noEmit',
        '--strict',
        '--module',
        'esnext',
        '--moduleResolution',
        'bundler',
        '--skipLibCheck',
        '--ignoreConfig', // apps/eer/tsconfig.json sits above this temp file; a bare file arg would otherwise warn (TS5112) and be treated as an error below
        file,
      ],
      { encoding: 'utf8', shell: true, cwd: EER_ROOT },
    );

    expect(stdout).toBe(''); // tsc prints errors to stdout
    expect(status).toBe(0);
    if (status !== 0) throw new Error(stderr); // surface a spawn-level failure distinctly from a type error
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30_000);
