// packages/db/src/export/run-delete.ts
// Deletes projects with every row they own (delete-project.ts), once a backup
// of each is in hand.
//
//   pnpm --filter @tickets/db db:delete-project --backup <file> [--backup <file>...] [--yes] <project>...
//
// <project> is a project key (items-core) or item prefix (TASK). Each project
// needs its backup: the JSON file db:export wrote for it, holding every row
// that is about to be deleted, unchanged. Paths are relative to where pnpm
// was run.
//
// Without --yes it only shows what it would delete, through a read-only
// session, and deletes nothing. With --yes it checks everything again and
// deletes, in one transaction.
//
// The database is the usual POSTGRES_* (environment.ts). The production
// database (`tickets`, which is also what environment.ts falls back to) is
// refused before a connection is opened; only
// --delete-from-the-production-database lets it through.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { environment } from '../environment';
import {
  assertMayDeleteFrom,
  createDeleteClient,
  deleteProjects,
  DeletionRefusedError,
  planDeletion,
  type BackupFile,
  type DeletionPlan,
} from './delete-project';
import { PROJECT_TABLES, type ProjectExport, type ProjectTable } from './export-project';
import { createReadOnlyClient, readOnlySnapshot } from './read-only-client';

const argv = process.argv.slice(2);
const { values: options, positionals: selectors } = parseArgs({
  args: argv[0] === '--' ? argv.slice(1) : argv,
  options: {
    backup: { type: 'string', multiple: true, default: [] },
    yes: { type: 'boolean', default: false },
    'delete-from-the-production-database': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

if (!selectors.length || !options.backup.length) {
  console.error(
    'usage: db:delete-project --backup <export.json> [--backup <file>...] [--yes] <project key or item prefix>...',
  );
  process.exit(2);
}

const allowProduction = options['delete-from-the-production-database'];
const { host, port, user, database } = environment.postgres;
console.log(`database: ${database}  (${user}@${host}:${port})`);
try {
  assertMayDeleteFrom(database, { allowProduction });
} catch (e) {
  console.error((e as Error).message);
  console.error(
    'Nothing was read or deleted. (The flag is --delete-from-the-production-database.)',
  );
  process.exit(1);
}
if (allowProduction)
  console.log('!!! --delete-from-the-production-database: the production guard is OFF');

const base = process.env.INIT_CWD ?? process.cwd();
const backups: BackupFile[] = options.backup.map((path) => {
  const file = resolve(base, path);
  const exp = JSON.parse(readFileSync(file, 'utf8')) as ProjectExport;
  if (exp.format !== 'tickets.project-export') {
    console.error(`${file} is not a db:export file`);
    process.exit(1);
  }
  return { file, export: exp };
});

function show(plan: DeletionPlan) {
  const prefixes = plan.projects.map((p) => p.itemPrefix);
  console.log(`current_database(): ${plan.database}`);
  console.log(
    `projects: ${plan.projects.map((p) => `${p.itemPrefix} (${p.key}, id ${p.id})`).join(', ')}`,
  );
  const w = Math.max(6, ...prefixes.map((p) => p.length + 1));
  const cell = (v: string | number) => String(v).padStart(w);
  console.log(`\n  ${'table'.padEnd(26)}${prefixes.map(cell).join('')}${cell('rows')}`);
  const line = (t: ProjectTable) =>
    `  ${t.padEnd(26)}${prefixes.map((p) => cell(plan.counts[p]![t])).join('')}${cell(plan.totals[t])}`;
  for (const t of PROJECT_TABLES) console.log(line(t));
  const total = PROJECT_TABLES.reduce((n, t) => n + plan.totals[t], 0);
  console.log(`  ${'all'.padEnd(26)}${prefixes.map(() => cell('')).join('')}${cell(total)}`);
  console.log(
    '  left alone, shared: users, schemes, item types, fields, option sets, options, link types',
  );
  console.log('\nbackups:');
  for (const b of plan.backups) {
    const where = b.file ? `${b.file} (from ${b.database}, ${b.exportedAt})` : 'none';
    console.log(
      `  ${b.project.padEnd(6)} ${where}\n         holds ${b.matched} of the ${b.rows} rows to delete, unchanged` +
        (b.gone ? `; ${b.gone} of its rows are no longer in the database` : ''),
    );
  }
  if (plan.problems.length) {
    console.log('\nREFUSED, nothing deleted:');
    for (const p of plan.problems) console.log(`  - ${p}`);
  }
}

if (!options.yes) {
  const { sql } = createReadOnlyClient();
  try {
    const plan = await readOnlySnapshot(sql, (tx) =>
      planDeletion(tx, selectors, { backups, allowProduction }),
    );
    show(plan);
    if (plan.problems.length) process.exitCode = 1;
    else
      console.log(
        `\nDry run: nothing deleted. Run again with --yes to delete these rows from ${plan.database}.`,
      );
  } finally {
    await sql.end();
  }
} else {
  const { sql } = createDeleteClient();
  try {
    const { plan, deleted } = await deleteProjects(sql, selectors, { backups, allowProduction });
    show(plan);
    console.log(`\nDeleted from ${plan.database}, committed:`);
    for (const t of PROJECT_TABLES)
      console.log(`  ${t.padEnd(26)}${String(deleted[t]).padStart(6)}`);
  } catch (e) {
    if (e instanceof DeletionRefusedError) {
      show(e.plan);
      process.exitCode = 1;
    } else {
      throw e;
    }
  } finally {
    await sql.end();
  }
}
