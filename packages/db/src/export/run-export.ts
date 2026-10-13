// packages/db/src/export/run-export.ts
// Exports projects as JSON files, one per project, then reads each file back
// and checks it against what was exported.
//
//   pnpm --filter @tickets/db db:export --out <dir> [--name '{date}-{key}.json'] <project>...
//
// <project> is a project key (items-core) or item prefix (TASK). In --name,
// {key} is the project's item prefix and {date} the snapshot's date.
//
// The database is the usual POSTGRES_* (environment.ts), which defaults to the
// production `tickets` database. Unlike db:import, that is allowed here: the
// exporter only reads, through a read-only session (read-only-client.ts).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { environment } from '../environment';
import {
  exportProjects,
  PROJECT_TABLES,
  REFERENCED_TABLES,
  type ProjectExport,
} from './export-project';
import { createReadOnlyClient } from './read-only-client';
import { parsePgTimestamp, summarizeExport } from './summarize-export';

const argv = process.argv.slice(2);
const { values: options, positionals: selectors } = parseArgs({
  args: argv[0] === '--' ? argv.slice(1) : argv,
  options: {
    out: { type: 'string' },
    name: { type: 'string', default: '{date}-{key}.json' },
  },
  allowPositionals: true,
});

if (!options.out || !selectors.length) {
  console.error(
    "usage: db:export --out <dir> [--name '{date}-{key}.json'] <project key or item prefix>...",
  );
  process.exit(2);
}

const { host, port, user, database } = environment.postgres;
console.log(`reading ${user}@${host}:${port}/${database} (read-only session)`);

const { sql } = createReadOnlyClient();
let exports: ProjectExport[];
try {
  exports = await exportProjects(sql, selectors);
} finally {
  await sql.end();
}

const outDir = resolve(options.out);
mkdirSync(outDir, { recursive: true });

let failed = false;
for (const exp of exports) {
  const file = join(
    outDir,
    options.name
      .replaceAll('{key}', exp.project.itemPrefix)
      .replaceAll('{date}', exp.exportedAt.slice(0, 10)),
  );
  const text = `${JSON.stringify(exp, null, 2)}\n`;
  writeFileSync(file, text);

  // Read it back: the file must parse to exactly what was exported, and
  // every table's rows must number what its count says.
  const back = JSON.parse(readFileSync(file, 'utf8')) as ProjectExport;
  const sameJson = JSON.stringify(back) === JSON.stringify(exp);
  const badCounts = PROJECT_TABLES.filter(
    (t) => back.rows[t].length !== exp.counts[t] || back.counts[t] !== exp.counts[t],
  );
  const ok = sameJson && !badCounts.length;
  failed ||= !ok;

  console.log(
    `\n${exp.project.itemPrefix} (${exp.project.key}) -> ${file}  [${Buffer.byteLength(text)} bytes, read back ${ok ? 'OK' : 'FAILED'}]`,
  );
  for (const t of PROJECT_TABLES) console.log(`  ${t.padEnd(26)} ${back.rows[t].length}`);
  console.log(
    `  referenced: ${REFERENCED_TABLES.map((t) => `${t.split('.')[1]} ${back.referenced[t].length}`).join(', ')}`,
  );
  console.log(`  outside items: ${back.outsideItems.length}`);
  if (!sameJson) console.log('  the file does not parse back to what was exported');
  if (badCounts.length) console.log(`  counts disagree: ${badCounts.join(', ')}`);

  // as of the snapshot, so the same file always summarizes the same way
  const s = summarizeExport(back, { now: parsePgTimestamp(back.exportedAt) });
  console.log(
    `  items ${s.items}: archived ${s.archived}; of the rest open ${s.open} ` +
      `(todo ${s.byKind.todo}, active ${s.byKind.active}, blocked ${s.byKind.blocked}, no status ${s.noStatus}), ` +
      `closed ${s.closed} (done ${s.byKind.done}, dropped ${s.byKind.dropped}); ` +
      `changed since ${s.changedSince.slice(0, 10)}: ${s.changedRecently} (open ${s.openChangedRecently}); last change ${s.lastChange}`,
  );
}

if (failed) process.exitCode = 1;
