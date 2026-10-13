// packages/db/src/export/export-project.ts
// Reads one or more projects out of a tickets database as plain JSON-able
// rows: every row that belongs to the project, plus the shared rows those
// point at, so the file can be read (and checked) without the database.
//
// Rows are the database's own: `SELECT *`, snake_case column names, every
// column, untransformed (see read-only-client.ts for how each type comes
// back). Two groups, kept apart on purpose:
//
//   rows        what belongs to the project: the project row, its views, its
//               items with their values, comments, reactions and links, and
//               the history written about them (events, item_activity,
//               commands, outbox). Deleting the project means deleting these.
//   referenced  shared structure those rows point at (users, the scheme, the
//               item types, fields, option sets and options, link types),
//               copied only so a reader can make sense of the ids.
//
// plus `outsideItems`: a short card for each item of ANOTHER project that one
// of this project's links or parents points at.
//
// Never writes: everything runs in one read-only REPEATABLE READ snapshot
// (readOnlySnapshot), so several projects exported together agree with each
// other, and the session itself is read-only (createReadOnlyClient).
import type { Sql, TransactionSql } from 'postgres';
import { readOnlySnapshot } from './read-only-client';

export type Row = Record<string, unknown>;

export const PROJECT_TABLES = [
  'core.projects',
  'structure.views',
  'records.items',
  'records.item_values',
  'records.comments',
  'records.comment_reactions',
  'records.item_links',
  'history.events',
  'history.item_activity',
  'history.commands',
  'history.outbox',
] as const;

export const REFERENCED_TABLES = [
  'core.users',
  'structure.schemes',
  'structure.item_types',
  'structure.item_type_fields',
  'structure.item_type_child_types',
  'structure.fields',
  'structure.option_sets',
  'structure.options',
  'structure.link_types',
] as const;

export type ProjectTable = (typeof PROJECT_TABLES)[number];
export type ReferencedTable = (typeof REFERENCED_TABLES)[number];

// An item of another project that this project points at (a link's other
// end, or a parent), with just enough to name it.
export type OutsideItem = {
  id: number;
  project_id: number;
  project_key: string;
  item_prefix: string;
  number: number;
  type_id: number;
  archived_at: string | null;
  title: string | null;
};

export type ProjectSummary = { id: number; key: string; name: string; itemPrefix: string };

export type ProjectExport = {
  format: 'tickets.project-export';
  formatVersion: 1;
  // the snapshot's own now(), as the database renders it
  exportedAt: string;
  database: string;
  project: ProjectSummary;
  counts: Record<ProjectTable, number>;
  rows: Record<ProjectTable, Row[]>;
  referenced: Record<ReferencedTable, Row[]>;
  outsideItems: OutsideItem[];
};

export class UnknownProjectError extends Error {}

type Tx = TransactionSql;

// postgres.js hands back a RowList (an Array subclass carrying query
// metadata); copy into plain arrays of plain objects for the JSON.
const plain = (rows: readonly Row[]): Row[] => Array.from(rows, (r) => ({ ...r }));

const ids = (values: Iterable<unknown>): number[] =>
  [...new Set([...values].filter((v): v is number => typeof v === 'number'))].sort((a, b) => a - b);

async function whereIn(
  tx: Tx,
  table: string,
  column: string,
  values: number[],
  orderBy: string[],
): Promise<Row[]> {
  if (!values.length) return [];
  return plain(
    await tx<
      Row[]
    >`SELECT * FROM ${tx(table)} WHERE ${tx(column)} IN ${tx(values)} ORDER BY ${tx.unsafe(
      orderBy.map((c) => `"${c}"`).join(', '),
    )}`,
  );
}

// Matches a project by its key ('items-core') or its item prefix ('TASK'),
// either case. Every selector must match; each project is returned once.
export async function resolveProjects(
  sql: Sql | Tx,
  selectors: string[],
): Promise<ProjectSummary[]> {
  const all = await sql<{ id: number; key: string; name: string; item_prefix: string }[]>`
    SELECT id, key, name, item_prefix FROM core.projects ORDER BY id`;
  const chosen = new Map<number, ProjectSummary>();
  for (const selector of selectors) {
    const wanted = selector.toLowerCase();
    const match = all.find(
      (p) => p.key.toLowerCase() === wanted || p.item_prefix.toLowerCase() === wanted,
    );
    if (!match) {
      const known = all.map((p) => `${p.item_prefix} (${p.key})`).join(', ');
      throw new UnknownProjectError(
        `No project has the key or item prefix "${selector}". Projects: ${known || 'none'}.`,
      );
    }
    chosen.set(match.id, {
      id: match.id,
      key: match.key,
      name: match.name,
      itemPrefix: match.item_prefix,
    });
  }
  return [...chosen.values()];
}

// User ids that event payloads carry for user-type fields, so a reader can
// name them: item.created's `values` record, item.imported's `values` list
// and item.field_changed's from/to. Version-0 (legacy) payloads hold
// rendered display text, not ids, and are left alone.
function userIdsInPayloads(events: Row[], userFieldKeys: Set<string>): number[] {
  const found: unknown[] = [];
  const take = (v: unknown) => (Array.isArray(v) ? found.push(...v) : found.push(v));
  for (const e of events) {
    if (e.version === 0) continue;
    const p = e.payload as Record<string, unknown> | null;
    if (!p || typeof p !== 'object') continue;
    if (typeof p.fieldKey === 'string' && userFieldKeys.has(p.fieldKey)) {
      take(p.from);
      take(p.to);
    }
    if (Array.isArray(p.values)) {
      for (const v of p.values as { fieldKey?: unknown; value?: unknown }[]) {
        if (typeof v?.fieldKey === 'string' && userFieldKeys.has(v.fieldKey)) take(v.value);
      }
    } else if (p.values && typeof p.values === 'object') {
      for (const [k, v] of Object.entries(p.values as Record<string, unknown>)) {
        if (userFieldKeys.has(k)) take(v);
      }
    }
  }
  return ids(found);
}

// Every row that belongs to one project, table by table: what an export holds
// under `rows`, and exactly what deleting the project deletes
// (delete-project.ts), so the backup and the delete can never disagree.
export async function selectProjectRows(
  tx: Tx,
  projectId: number,
): Promise<Record<ProjectTable, Row[]>> {
  const pid = projectId;
  // Fresh fragments per use: a postgres.js fragment is a lazily-run query
  // object, so each enclosing statement gets its own.
  const itemsOf = () => tx`SELECT id FROM records.items WHERE project_id = ${pid}`;
  const aggregates = () => tx`(
       (aggregate_type = 'item' AND aggregate_id IN (${itemsOf()}))
    OR (aggregate_type = 'project' AND aggregate_id = ${pid})
    OR (aggregate_type = 'view' AND aggregate_id IN (SELECT id FROM structure.views WHERE project_id = ${pid})))`;
  const eventsOf = () =>
    tx`SELECT id FROM history.events WHERE project_id = ${pid} OR ${aggregates()}`;

  return {
    'core.projects': plain(await tx<Row[]>`SELECT * FROM core.projects WHERE id = ${pid}`),
    'structure.views': plain(
      await tx<Row[]>`SELECT * FROM structure.views WHERE project_id = ${pid} ORDER BY id`,
    ),
    'records.items': plain(
      await tx<Row[]>`SELECT * FROM records.items WHERE project_id = ${pid} ORDER BY id`,
    ),
    'records.item_values': plain(
      await tx<
        Row[]
      >`SELECT * FROM records.item_values WHERE item_id IN (${itemsOf()}) ORDER BY id`,
    ),
    'records.comments': plain(
      await tx<Row[]>`SELECT * FROM records.comments WHERE item_id IN (${itemsOf()}) ORDER BY id`,
    ),
    'records.comment_reactions': plain(
      await tx<Row[]>`SELECT * FROM records.comment_reactions
        WHERE comment_id IN (SELECT id FROM records.comments WHERE item_id IN (${itemsOf()})) ORDER BY id`,
    ),
    // A link between two projects belongs to both, so it is in both exports.
    'records.item_links': plain(
      await tx<Row[]>`SELECT * FROM records.item_links
        WHERE source_item_id IN (${itemsOf()}) OR target_item_id IN (${itemsOf()}) ORDER BY id`,
    ),
    'history.events': plain(
      await tx<
        Row[]
      >`SELECT * FROM history.events WHERE project_id = ${pid} OR ${aggregates()} ORDER BY id`,
    ),
    'history.item_activity': plain(
      await tx<Row[]>`SELECT * FROM history.item_activity
        WHERE project_id = ${pid} OR item_id IN (${itemsOf()}) ORDER BY id`,
    ),
    'history.commands': plain(
      await tx<Row[]>`SELECT * FROM history.commands WHERE ${aggregates()} ORDER BY at, id`,
    ),
    'history.outbox': plain(
      await tx<
        Row[]
      >`SELECT * FROM history.outbox WHERE event_id IN (${eventsOf()}) ORDER BY event_id`,
    ),
  };
}

async function exportOne(
  tx: Tx,
  project: ProjectSummary,
  exportedAt: string,
  database: string,
): Promise<ProjectExport> {
  const rows = await selectProjectRows(tx, project.id);
  const items = rows['records.items'];
  const values = rows['records.item_values'];
  const links = rows['records.item_links'];
  const ownItemIds = new Set(items.map((i) => i.id as number));

  // --- items of other projects this one points at ---
  const outsideIds = ids([
    ...links.flatMap((l) => [l.source_item_id, l.target_item_id]),
    ...items.map((i) => i.parent_id),
  ]).filter((id) => !ownItemIds.has(id));
  const outsideItems: OutsideItem[] = outsideIds.length
    ? (plain(
        await tx<Row[]>`
          SELECT i.id, i.project_id, p.key AS project_key, p.item_prefix, i.number, i.type_id, i.archived_at,
                 (SELECT v.value_text FROM records.item_values v JOIN structure.fields f ON f.id = v.field_id
                   WHERE v.item_id = i.id AND f.key = 'title' ORDER BY v.id LIMIT 1) AS title
            FROM records.items i JOIN core.projects p ON p.id = i.project_id
           WHERE i.id IN ${tx(outsideIds)} ORDER BY i.id`,
      ) as OutsideItem[])
    : [];

  // --- the structure all of that points at ---
  const projectRow = rows['core.projects'][0];
  const linkTypes = await whereIn(
    tx,
    'structure.link_types',
    'id',
    ids(links.map((l) => l.link_type_id)),
    ['id'],
  );
  const typeIds = ids([
    ...items.map((i) => i.type_id),
    ...outsideItems.map((i) => i.type_id),
    ...linkTypes.map((lt) => lt.item_type_id),
  ]);
  const itemTypeFields = await whereIn(tx, 'structure.item_type_fields', 'item_type_id', typeIds, [
    'item_type_id',
    'position',
    'field_id',
  ]);
  const fields = await whereIn(
    tx,
    'structure.fields',
    'id',
    ids([...itemTypeFields.map((p) => p.field_id), ...values.map((v) => v.field_id)]),
    ['id'],
  );
  const optionSets = await whereIn(
    tx,
    'structure.option_sets',
    'id',
    ids(fields.map((f) => f.option_set_id)),
    ['id'],
  );
  const optionSetIds = optionSets.map((s) => s.id as number);
  const optionsInSets = await whereIn(tx, 'structure.options', 'option_set_id', optionSetIds, [
    'option_set_id',
    'position',
    'id',
  ]);
  // An option a value points at always sits in its field's set; fetched by id
  // too in case one doesn't, so no value is left unexplained.
  const strayOptionIds = ids(values.map((v) => v.option_id)).filter(
    (id) => !optionsInSets.some((o) => o.id === id),
  );
  const options = [
    ...optionsInSets,
    ...(await whereIn(tx, 'structure.options', 'id', strayOptionIds, ['id'])),
  ];

  const userFieldKeys = new Set(
    fields.filter((f) => f.type === 'user').map((f) => f.key as string),
  );
  const userIds = ids([
    ...items.map((i) => i.created_by),
    ...values.map((v) => v.value_user_id),
    ...rows['records.comments'].map((c) => c.author_id),
    ...rows['records.comment_reactions'].map((r) => r.user_id),
    ...rows['history.events'].map((e) => e.actor_id),
    ...rows['history.item_activity'].map((a) => a.actor_id),
    ...rows['history.commands'].map((c) => c.actor_id),
    ...userIdsInPayloads(rows['history.events'], userFieldKeys),
  ]);

  const referenced: Record<ReferencedTable, Row[]> = {
    'core.users': await whereIn(tx, 'core.users', 'id', userIds, ['id']),
    'structure.schemes': await whereIn(
      tx,
      'structure.schemes',
      'id',
      ids([projectRow?.scheme_id]),
      ['id'],
    ),
    'structure.item_types': await whereIn(tx, 'structure.item_types', 'id', typeIds, ['id']),
    'structure.item_type_fields': itemTypeFields,
    'structure.item_type_child_types': await whereIn(
      tx,
      'structure.item_type_child_types',
      'parent_type_id',
      typeIds,
      ['parent_type_id', 'child_type_id'],
    ),
    'structure.fields': fields,
    'structure.option_sets': optionSets,
    'structure.options': options,
    'structure.link_types': linkTypes,
  };

  const counts = Object.fromEntries(PROJECT_TABLES.map((t) => [t, rows[t].length])) as Record<
    ProjectTable,
    number
  >;

  return {
    format: 'tickets.project-export',
    formatVersion: 1,
    exportedAt,
    database,
    project,
    counts,
    rows,
    referenced,
    outsideItems,
  };
}

// Every selector is a project key or item prefix (see resolveProjects). All
// projects are read in ONE read-only snapshot.
export async function exportProjects(sql: Sql, selectors: string[]): Promise<ProjectExport[]> {
  return readOnlySnapshot(sql, async (tx) => {
    const [meta] = await tx<
      { now: string; database: string }[]
    >`SELECT now() AS now, current_database() AS database`;
    if (!meta) throw new Error('the database returned no now()');
    const projects = await resolveProjects(tx, selectors);
    const out: ProjectExport[] = [];
    for (const p of projects) out.push(await exportOne(tx, p, meta.now, meta.database));
    return out;
  });
}
