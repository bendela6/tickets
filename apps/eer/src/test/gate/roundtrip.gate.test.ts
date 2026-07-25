// The gate (Task 7 of the drizzle-roundtrip plan): proves apps/eer round-trips
// a drizzle schema with nothing lost.
//
//   describe (schema) -> import -> export -> load generated module
//     Gate A: describeDrizzle(regenerated) deep-equals describeDrizzle(original)
//     Gate B: drizzle-kit's own migration diff between the two is empty
//     Gate C: the generated file passes `tsc --noEmit --strict`
//
// TWO schemas are run through the same four assertions:
//   1. the repo's REAL 22-table drizzle schema (packages/db/src/schema) — a
//      regression gate: this is the schema apps/eer actually has to serve.
//   2. a hand-written "kitchen sink" fixture (test/fixtures/kitchen-sink-schema.ts)
//      exercising constructs the real schema never happens to use — varchar/char
//      lengths, numeric precision+scale, fk onDelete+onUpdate, non-default index
//      methods/opClasses, identity sequence options, etc. A reviewer proved gate 1
//      alone is blind to regressions in every one of those (disabling each
//      emitter in export-drizzle.ts one at a time left gate 1 green) — see
//      task-7-report.md.
//
// Node-only (see vitest.config.ts's environmentMatchGlobs): loadGeneratedModule
// writes to disk and dynamically imports, and the typecheck helper shells out to tsc.
//
// Import the @tickets/db schema BARREL by relative path, never the package
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
import type { ImportReport } from '../../engine/model/import-drizzle';
import { exportDrizzle } from '../../engine/model/export-drizzle';
import type { Model } from '../../engine/model/types';
import * as kitchenSinkSchema from '../fixtures/kitchen-sink-schema';
import { loadGeneratedModule } from '../helpers/load-generated-module';

// Same rationale as load-generated-module.ts: the generated file's bare
// imports (`drizzle-orm`, `drizzle-orm/pg-core`) only resolve — for tsc's
// module resolution as much as Node's/Vite's — from a directory that has
// apps/eer/node_modules as an ancestor. The OS tmp dir does not.
const EER_ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))); // src/test/gate -> apps/eer

// ---- shared round-trip machinery (used by both the real-schema gate and the
// kitchen-sink gate below) ----

// describe -> import -> export -> load generated module -> Gate A + Gate B.
// Returns the import outcome so each caller can assert its own
// schema-specific expectations (entity/enum counts, blocksExport) on top.
async function runRoundtripGate(schemaModule: Record<string, unknown>): Promise<{ model: Model; report: ImportReport }> {
  const before = describeDrizzle(schemaModule, []);
  const { model, report } = importDrizzle(before, null);

  const source = exportDrizzle(model);
  const regenerated = await loadGeneratedModule(source); // temp .ts + import

  // Gate A — our canonical descriptor
  const after = describeDrizzle(regenerated, []);
  expect(after).toEqual(before);

  // Gate B — drizzle-kit's own opinion
  const migration = await generateMigration(await generateDrizzleJson(schemaModule), await generateDrizzleJson(regenerated));
  expect(migration).toEqual([]);

  return { model, report };
}

// export -> write to a temp file under apps/eer/node_modules -> tsc --strict.
async function assertGeneratedFileTypechecks(schemaModule: Record<string, unknown>): Promise<void> {
  const before = describeDrizzle(schemaModule, []);
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
}

// ---- gate 1: the real 30-table @tickets/db schema ----

it('round-trips @tickets/db with nothing lost', async () => {
  const { model, report } = await runRoundtripGate(realSchema as Record<string, unknown>);

  expect(report.blocksExport).toBe(false);
  // 30 tables / 8 enums after Task 11 deleted the 5 legacy public ai_* tables
  // and their 4 enums, and records.attachments arrived for editor uploads. The
  // round trip carries each table's and enum's `schema` through export ->
  // import: terminal.sessions and agent.sessions survive as two distinct
  // entities sharing one bare name. Namespacing then moved every remaining
  // table out of `public` into core/structure/records/history, so nothing
  // round-trips with an empty schema anymore.
  expect(model.entities).toHaveLength(30);
  expect(model.enums).toHaveLength(8);
  expect(model.entities.filter((e) => e.schema === 'terminal')).toHaveLength(2);
  expect(model.entities.filter((e) => e.schema === 'agent')).toHaveLength(4);
  expect(model.entities.filter((e) => e.schema === 'core')).toHaveLength(3);
  expect(model.entities.filter((e) => e.schema === 'structure')).toHaveLength(11);
  expect(model.entities.filter((e) => e.schema === 'records')).toHaveLength(6); // + attachments
  expect(model.entities.filter((e) => e.schema === 'history')).toHaveLength(4);
  expect(model.entities.filter((e) => !e.schema)).toHaveLength(0);
}, 30_000);

it('the generated file typechecks', async () => {
  await assertGeneratedFileTypechecks(realSchema as Record<string, unknown>);
}, 30_000);

// ---- gate 2: the kitchen-sink fixture (see test/fixtures/kitchen-sink-schema.ts) ----

it('round-trips the kitchen-sink fixture with nothing lost', async () => {
  const { model, report } = await runRoundtripGate(kitchenSinkSchema as Record<string, unknown>);

  expect(report.blocksExport).toBe(false);
  // widgets, accounts, memberships, sequences_demo, analytics.events, event_notes
  expect(model.entities).toHaveLength(6);
  expect(model.enums).toHaveLength(2); // status, analytics.event_type
}, 30_000);

it('the kitchen-sink generated file typechecks', async () => {
  await assertGeneratedFileTypechecks(kitchenSinkSchema as Record<string, unknown>);
}, 30_000);
