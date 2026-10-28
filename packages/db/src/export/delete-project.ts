// packages/db/src/export/delete-project.ts
// Deletes one or more projects with every row that belongs to them: exactly
// the rows an export of the project holds under `rows` (selectProjectRows in
// export-project.ts), so a backup made with db:export and the delete always
// agree on what "the project" is. The shared structure those rows point at
// (users, the scheme, item types, fields, option sets, options, link types)
// is left alone.
//
// It deletes only what a backup holds, and refuses, deleting nothing, when:
//   - the database is the production one (`tickets`, both the local server's
//     and the live one), unless `allowProduction` is passed;
//   - a link or a parent joins an item of these projects to an item of a
//     project that is not being deleted;
//   - any other row in the database still points at a row it would delete.
//     The foreign keys are read from the catalog, so tables this file doesn't
//     know about (the dropped AI tables in a database not yet migrated past
//     them, say) are checked too;
//   - a row it would delete is not in that project's backup file, or differs
//     from it.
//
// planDeletion only reads, so a dry run can use the read-only session
// (read-only-client.ts). deleteProjects plans and deletes in ONE serializable
// transaction: what it deletes is what it checked, child tables first, each
// delete's row count must equal the plan's, and nothing of the projects may
// be left at the end, or the whole transaction rolls back.
import postgres, { type Sql, type TransactionSql } from 'postgres';
import { connectionUrl } from '../environment';
import {
  PROJECT_TABLES,
  resolveProjects,
  selectProjectRows,
  type ProjectExport,
  type ProjectSummary,
  type ProjectTable,
  type Row,
} from './export-project';
import { EXPORT_TYPES } from './read-only-client';

type Tx = TransactionSql;
type Key = number | string;

// The local server's production database and the live one on the gateway are
// both named this.
const PRODUCTION_DATABASE = 'tickets';

// A writing session that reads rows exactly as an export does (EXPORT_TYPES),
// so they compare equal to the rows in a backup file.
export function createDeleteClient(url: string = connectionUrl): { sql: Sql } {
  return {
    sql: postgres(url, {
      max: 1,
      connection: { application_name: 'tickets-db-delete-project' },
      types: EXPORT_TYPES,
    }),
  };
}

export const PRIMARY_KEY: Record<ProjectTable, string> = {
  'core.projects': 'id',
  'structure.views': 'id',
  'records.items': 'id',
  'records.item_values': 'id',
  'records.comments': 'id',
  'records.comment_reactions': 'id',
  'records.item_links': 'id',
  'history.events': 'id',
  'history.item_activity': 'id',
  'history.commands': 'id',
  'history.outbox': 'event_id',
};

// Children before what they point at. Rows of one table that point at each
// other (an item's parent, a comment's parent, an event's caused_by) go in
// a single statement, where Postgres checks the foreign key at its end.
export const DELETE_ORDER = [
  'history.outbox', // -> events
  'history.item_activity', // -> events, items
  'history.commands',
  'history.events', // -> events
  'records.comment_reactions', // -> comments
  'records.comments', // -> items, comments
  'records.item_links', // -> items
  'records.item_values', // -> items
  'records.items', // -> projects, items
  'structure.views', // -> projects
  'core.projects',
] as const satisfies readonly ProjectTable[];

export type BackupFile = { file: string; export: ProjectExport };

export type BackupCheck = {
  project: string; // item prefix
  file: string | null;
  database: string | null; // the database the backup was taken from
  exportedAt: string | null;
  rows: number; // rows to delete
  matched: number; // of those, in the backup and unchanged
  missing: Partial<Record<ProjectTable, Key[]>>; // not in the backup
  changed: Partial<Record<ProjectTable, Key[]>>; // in it, but different now
  gone: number; // in the backup, no longer in the database
};

export type DeletionPlan = {
  database: string;
  projects: ProjectSummary[];
  // rows per table, per project (by item prefix); a link between two of the
  // projects counts under both
  counts: Record<string, Record<ProjectTable, number>>;
  // distinct rows per table, all projects together: what will be deleted
  totals: Record<ProjectTable, number>;
  keys: Record<ProjectTable, Key[]>;
  backups: BackupCheck[];
  // each one a reason to delete nothing
  problems: string[];
};

export type DeletionResult = { plan: DeletionPlan; deleted: Record<ProjectTable, number> };

export class ProductionDatabaseError extends Error {}

export class DeletionRefusedError extends Error {
  constructor(readonly plan: DeletionPlan) {
    super(
      `Refusing to delete, nothing was deleted:\n${plan.problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
}

export function assertMayDeleteFrom(
  database: string,
  { allowProduction = false }: { allowProduction?: boolean } = {},
): void {
  if (database === PRODUCTION_DATABASE && !allowProduction) {
    throw new ProductionDatabaseError(
      `Refusing to delete from "${database}": that is the PRODUCTION database (the local ` +
        "server's and the live one are both named so). Deleting projects there needs its own, " +
        'explicit flag; check POSTGRES_DATABASE if you meant tickets_dev.',
    );
  }
}

// The column's own SQL type, so a list of keys sent as text[] can be cast to it.
async function columnType(tx: Tx, tableName: string, column: string): Promise<string> {
  const [row] = await tx<{ type: string }[]>`
    SELECT format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a
     WHERE a.attrelid = ${tableName}::regclass AND a.attname = ${column} AND NOT a.attisdropped`;
  if (!row) throw new Error(`${tableName} has no column ${column}`);
  return row.type;
}

// `= ANY(...)` over one array parameter: no bind-parameter cap, and one
// statement however many keys there are.
const anyOf = (tx: Tx, values: Key[], type: string) =>
  tx`ANY(${tx.array(values.map(String))}::${tx.unsafe(`${type}[]`)})`;

async function itemLabels(tx: Tx, itemIds: Key[]): Promise<Map<Key, string>> {
  if (!itemIds.length) return new Map();
  const rows = await tx<{ id: number; label: string }[]>`
    SELECT i.id, p.item_prefix || '-' || i.number AS label
      FROM records.items i JOIN core.projects p ON p.id = i.project_id
     WHERE i.id = ${anyOf(tx, itemIds, 'integer')}`;
  return new Map(rows.map((r) => [r.id, r.label]));
}

const sample = (values: Key[], n = 5) =>
  values.length > n
    ? `${values.slice(0, n).join(', ')} and ${values.length - n} more`
    : values.join(', ');

// Every foreign key in the database that points at one of the project tables.
async function inboundForeignKeys(tx: Tx) {
  return tx<
    {
      name: string;
      referencing: string;
      columns: string[];
      referenced: string;
      referenced_columns: string[];
      column_type: string;
    }[]
  >`
    SELECT c.conname AS name,
           rn.nspname || '.' || r.relname AS referencing,
           ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum, n)
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum ORDER BY k.n) AS columns,
           tn.nspname || '.' || t.relname AS referenced,
           ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum, n)
                   JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum ORDER BY k.n) AS referenced_columns,
           (SELECT format_type(a.atttypid, a.atttypmod) FROM pg_attribute a
             WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) AS column_type
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace rn ON rn.oid = r.relnamespace
      JOIN pg_class t ON t.oid = c.confrelid JOIN pg_namespace tn ON tn.oid = t.relnamespace
     WHERE c.contype = 'f' AND tn.nspname || '.' || t.relname = ANY(${tx.array([...PROJECT_TABLES])}::text[])
     ORDER BY 2, 1`;
}

function checkBackup(
  project: ProjectSummary,
  rows: Record<ProjectTable, Row[]>,
  backups: BackupFile[],
): { check: BackupCheck; problem: string | null } {
  const mine = backups.filter(
    (b) => b.export.project.id === project.id && b.export.project.key === project.key,
  );
  const check: BackupCheck = {
    project: project.itemPrefix,
    file: mine[0]?.file ?? null,
    database: mine[0]?.export.database ?? null,
    exportedAt: mine[0]?.export.exportedAt ?? null,
    rows: PROJECT_TABLES.reduce((n, t) => n + rows[t].length, 0),
    matched: 0,
    missing: {},
    changed: {},
    gone: 0,
  };
  if (mine.length !== 1) {
    return {
      check,
      problem: mine.length
        ? `${project.itemPrefix}: ${mine.length} backup files name it (${mine.map((b) => b.file).join(', ')}); give one`
        : `${project.itemPrefix} (${project.key}, id ${project.id}): no backup file names it`,
    };
  }
  const backup = mine[0]!.export;
  for (const t of PROJECT_TABLES) {
    const pk = PRIMARY_KEY[t];
    const backed = new Map((backup.rows[t] ?? []).map((r) => [String(r[pk]), JSON.stringify(r)]));
    const live = new Set<string>();
    for (const row of rows[t]) {
      const key = String(row[pk]);
      live.add(key);
      const saved = backed.get(key);
      if (saved === undefined) (check.missing[t] ??= []).push(row[pk] as Key);
      else if (saved !== JSON.stringify(row)) (check.changed[t] ??= []).push(row[pk] as Key);
      else check.matched++;
    }
    for (const key of backed.keys()) if (!live.has(key)) check.gone++;
  }
  const missing = Object.entries(check.missing).map(([t, k]) => `${t} ${sample(k)}`);
  const changed = Object.entries(check.changed).map(([t, k]) => `${t} ${sample(k)}`);
  if (!missing.length && !changed.length) return { check, problem: null };
  return {
    check,
    problem:
      `${project.itemPrefix}: the backup ${check.file} doesn't hold every row to delete` +
      (missing.length ? `; not in it: ${missing.join('; ')}` : '') +
      (changed.length ? `; changed since: ${changed.join('; ')}` : '') +
      ' (export it again, and delete with the new file)',
  };
}

// What deleting these projects would delete, and every reason not to. Reads
// only; the production check comes first, before a row is read.
export async function planDeletion(
  tx: Tx,
  selectors: string[],
  { backups, allowProduction = false }: { backups: BackupFile[]; allowProduction?: boolean },
): Promise<DeletionPlan> {
  const [meta] = await tx<{ database: string }[]>`SELECT current_database() AS database`;
  if (!meta) throw new Error('the database returned no current_database()');
  assertMayDeleteFrom(meta.database, { allowProduction });

  const projects = await resolveProjects(tx, selectors);
  const problems: string[] = [];
  const counts: DeletionPlan['counts'] = {};
  const byKey = Object.fromEntries(
    PROJECT_TABLES.map((t) => [t, new Map<string, Row>()]),
  ) as Record<ProjectTable, Map<string, Row>>;
  const backupChecks: BackupCheck[] = [];

  for (const p of projects) {
    const rows = await selectProjectRows(tx, p.id);
    counts[p.itemPrefix] = Object.fromEntries(
      PROJECT_TABLES.map((t) => [t, rows[t].length]),
    ) as Record<ProjectTable, number>;
    for (const t of PROJECT_TABLES)
      for (const r of rows[t]) byKey[t].set(String(r[PRIMARY_KEY[t]]), r);
    const { check, problem } = checkBackup(p, rows, backups);
    backupChecks.push(check);
    if (problem) problems.push(problem);
  }

  const rowsOf = (t: ProjectTable) => [...byKey[t].values()];
  const keys = Object.fromEntries(
    PROJECT_TABLES.map((t) => [t, rowsOf(t).map((r) => r[PRIMARY_KEY[t]] as Key)]),
  ) as Record<ProjectTable, Key[]>;

  // --- links and parents that cross into a project not being deleted ---
  const itemIds = new Set(keys['records.items'].map(String));
  const outside = (id: unknown) => id !== null && id !== undefined && !itemIds.has(String(id));
  const crossingLinks = rowsOf('records.item_links').filter(
    (l) => outside(l.source_item_id) || outside(l.target_item_id),
  );
  const outwardParents = rowsOf('records.items').filter((i) => outside(i.parent_id));
  if (crossingLinks.length || outwardParents.length) {
    const labels = await itemLabels(tx, [
      ...crossingLinks.flatMap((l) => [l.source_item_id as Key, l.target_item_id as Key]),
      ...outwardParents.flatMap((i) => [i.id as Key, i.parent_id as Key]),
    ]);
    const name = (id: unknown) => labels.get(id as Key) ?? `item ${String(id)}`;
    for (const l of crossingLinks)
      problems.push(
        `link ${String(l.id)} joins ${name(l.source_item_id)} to ${name(l.target_item_id)}, an item of a project not being deleted`,
      );
    for (const i of outwardParents)
      problems.push(
        `${name(i.id)}'s parent is ${name(i.parent_id)}, an item of a project not being deleted`,
      );
  }

  // --- anything else that still points at a row to delete ---
  for (const fk of await inboundForeignKeys(tx)) {
    const target = fk.referenced as ProjectTable;
    if (fk.columns.length !== 1) {
      problems.push(
        `${fk.referencing} has a foreign key on several columns (${fk.name}) into ${target}; this script can't check it`,
      );
      continue;
    }
    const [column] = fk.columns as [string];
    const [refColumn] = fk.referenced_columns as [string];
    const values = [
      ...new Set(
        rowsOf(target)
          .map((r) => r[refColumn])
          .filter((v): v is Key => v !== null && v !== undefined)
          .map(String),
      ),
    ];
    if (!values.length) continue;
    const self = (PROJECT_TABLES as readonly string[]).includes(fk.referencing)
      ? (fk.referencing as ProjectTable)
      : null;
    let notDeleted = tx`TRUE`;
    if (self && keys[self].length) {
      const pk = PRIMARY_KEY[self];
      const pkType = await columnType(tx, self, pk);
      notDeleted = tx`NOT (${tx(pk)} = ${anyOf(tx, keys[self], pkType)})`;
    }
    const [hit] = await tx<{ n: number; sample: string[] }[]>`
      SELECT count(*)::int AS n,
             (array_agg(DISTINCT ${tx(column)}::text))[1:5] AS sample
        FROM ${tx(fk.referencing)}
       WHERE ${tx(column)} = ${anyOf(tx, values, fk.column_type)} AND ${notDeleted}`;
    if (hit && hit.n > 0)
      problems.push(
        `${hit.n} row(s) of ${fk.referencing} that stay would point at deleted ${target} rows ` +
          `(${fk.referencing}.${column} = ${hit.sample.join(', ')}${hit.n > hit.sample.length ? ', …' : ''}; ${fk.name})`,
      );
  }

  const totals = Object.fromEntries(PROJECT_TABLES.map((t) => [t, keys[t].length])) as Record<
    ProjectTable,
    number
  >;
  return {
    database: meta.database,
    projects,
    counts,
    totals,
    keys,
    backups: backupChecks,
    problems,
  };
}

// Plans and deletes in one serializable transaction (see the top of the file).
// Throws DeletionRefusedError, deleting nothing, if the plan has any problem.
export async function deleteProjects(
  sql: Sql,
  selectors: string[],
  options: { backups: BackupFile[]; allowProduction?: boolean },
): Promise<DeletionResult> {
  return (await sql.begin('isolation level serializable', async (tx) => {
    const plan = await planDeletion(tx, selectors, options);
    if (plan.problems.length) throw new DeletionRefusedError(plan);

    const deleted = Object.fromEntries(PROJECT_TABLES.map((t) => [t, 0])) as Record<
      ProjectTable,
      number
    >;
    for (const t of DELETE_ORDER) {
      const keys = plan.keys[t];
      if (!keys.length) continue;
      const pk = PRIMARY_KEY[t];
      const type = await columnType(tx, t, pk);
      const result = await tx`DELETE FROM ${tx(t)} WHERE ${tx(pk)} = ${anyOf(tx, keys, type)}`;
      if (result.count !== keys.length)
        throw new Error(
          `${t}: deleted ${result.count} rows, the plan had ${keys.length}; rolled back, nothing was deleted`,
        );
      deleted[t] = result.count;
    }

    for (const p of plan.projects) {
      const left = await selectProjectRows(tx, p.id);
      const remaining = PROJECT_TABLES.filter((t) => left[t].length);
      if (remaining.length)
        throw new Error(
          `${p.itemPrefix} still has rows in ${remaining.join(', ')} after the delete; rolled back, nothing was deleted`,
        );
    }
    return { plan, deleted };
  })) as DeletionResult;
}
