// packages/db/src/import/verify-import.ts
// Proves the import is correct by diffing the LOGICAL STATE of every item,
// old database vs new — not counts. An importer can write exactly the right
// number of rows and still point half of them at the wrong field, or the
// wrong option. See .superpowers/sdd/task-12-brief.md.
import { sql as raw } from 'drizzle-orm';
import type { Sql } from 'postgres';
import type { Db } from '../client';

export type VerifyReport = {
  ok: boolean;
  counts: { table: string; legacy: number; imported: number; ok: boolean }[];
  itemDiffs: { itemId: number; field: string; legacy: string | null; imported: string | null }[];
};

// One item's values, keyed by FIELD KEY, rendered to a comparable string.
// Multi-value fields (several rows for one (item, field)) render as a
// sorted, comma-joined string so row ordering can never cause a false diff.
type ItemState = Map<string, string | null>;

// Every scalar column ::text-cast in SQL on BOTH sides, so the comparison
// never touches the JS driver's lossy Date parsing (see legacy-client.ts's
// note on timestamptz truncation) or JSON.stringify key-order assumptions —
// postgres itself renders the canonical text for numeric/date/bool/jsonb,
// identically regardless of which side of the import produced the row.
type RawValueRow = {
  item_id: number;
  field_key: string;
  value_text: string | null;
  value_number: string | null;
  value_date: string | null;
  value_bool: string | null;
  value_json: string | null;
};

// Legacy: a status value lived in ticket_values.status_id -> statuses.key;
// everything else option-shaped lived in ticket_values.option_id ->
// field_options.value. statuses.key must render to the SAME string as the
// new side's options.value below — that equality is the point, not
// incidental (see renderImported).
type LegacyValueRow = RawValueRow & { option_value: string | null; status_key: string | null };

function renderLegacy(r: LegacyValueRow): string | null {
  if (r.status_key !== null) return r.status_key;
  if (r.option_value !== null) return r.option_value;
  return renderScalar(r);
}

// New: item_values.option_id -> options.value covers status AND every other
// option-shaped value (single schema, no separate status column). The
// assignee exception: item_values.value_user_id -> users.name. Legacy
// renders the option's value ("claude-sonnet-5"); this renders the user's
// name — they were created with the same string (import-legacy.ts step 1),
// so they must compare equal. If they don't, the agent users were named
// wrong — do not special-case assignee out of this comparison to hide that.
type ImportedValueRow = RawValueRow & { option_value: string | null; user_name: string | null };

function renderImported(r: ImportedValueRow): string | null {
  if (r.option_value !== null) return r.option_value;
  if (r.user_name !== null) return r.user_name;
  return renderScalar(r);
}

function renderScalar(r: RawValueRow): string | null {
  if (r.value_text !== null) return r.value_text;
  if (r.value_number !== null) return r.value_number;
  if (r.value_date !== null) return r.value_date;
  if (r.value_bool !== null) return r.value_bool;
  if (r.value_json !== null) return r.value_json;
  return null;
}

function groupByItem(rows: { item_id: number; field_key: string; rendered: string | null }[]): Map<number, ItemState> {
  const byItem = new Map<number, Map<string, string[]>>();
  for (const r of rows) {
    let byField = byItem.get(r.item_id);
    if (!byField) { byField = new Map(); byItem.set(r.item_id, byField); }
    let values = byField.get(r.field_key);
    if (!values) { values = []; byField.set(r.field_key, values); }
    if (r.rendered !== null) values.push(r.rendered);
  }
  const states = new Map<number, ItemState>();
  for (const [itemId, byField] of byItem) {
    const state: ItemState = new Map();
    for (const [fieldKey, values] of byField) {
      state.set(fieldKey, values.length ? values.slice().sort().join(',') : null);
    }
    states.set(itemId, state);
  }
  return states;
}

async function readLegacyItemStates(legacySql: Sql): Promise<Map<number, ItemState>> {
  const rows = await legacySql.unsafe<LegacyValueRow[]>(`
    SELECT
      tv.ticket_id AS item_id,
      f.key AS field_key,
      tv.value_text,
      tv.value_number::text AS value_number,
      tv.value_date::text AS value_date,
      tv.value_bool::text AS value_bool,
      tv.value_json::text AS value_json,
      fo.value AS option_value,
      s.key AS status_key
    FROM ticket_values tv
    JOIN fields f ON f.id = tv.field_id
    LEFT JOIN field_options fo ON fo.id = tv.option_id
    LEFT JOIN statuses s ON s.id = tv.status_id
  `);
  return groupByItem(
    rows.map((r) => ({ item_id: r.item_id, field_key: r.field_key, rendered: renderLegacy(r) })),
  );
}

async function readImportedItemStates(db: Db): Promise<Map<number, ItemState>> {
  const rows = await db.execute<ImportedValueRow>(raw`
    SELECT
      iv.item_id AS item_id,
      f.key AS field_key,
      iv.value_text,
      iv.value_number::text AS value_number,
      iv.value_date::text AS value_date,
      iv.value_bool::text AS value_bool,
      iv.value_json::text AS value_json,
      o.value AS option_value,
      u.name AS user_name
    FROM item_values iv
    JOIN fields f ON f.id = iv.field_id
    LEFT JOIN options o ON o.id = iv.option_id
    LEFT JOIN users u ON u.id = iv.value_user_id
  `);
  return groupByItem(
    [...rows].map((r) => ({ item_id: r.item_id, field_key: r.field_key, rendered: renderImported(r) })),
  );
}

function diffItemStates(
  itemIds: number[],
  legacyStates: Map<number, ItemState>,
  importedStates: Map<number, ItemState>,
): VerifyReport['itemDiffs'] {
  const diffs: VerifyReport['itemDiffs'] = [];
  const emptyState: ItemState = new Map();
  for (const itemId of itemIds) {
    const legacyState = legacyStates.get(itemId) ?? emptyState;
    const importedState = importedStates.get(itemId) ?? emptyState;
    const fieldKeys = [...new Set([...legacyState.keys(), ...importedState.keys()])].sort();
    for (const field of fieldKeys) {
      const legacyValue = legacyState.get(field) ?? null;
      const importedValue = importedState.get(field) ?? null;
      if (legacyValue !== importedValue) {
        diffs.push({ itemId, field, legacy: legacyValue, imported: importedValue });
      }
    }
  }
  return diffs;
}

async function countLegacy(legacySql: Sql, table: string): Promise<number> {
  const rows = await legacySql.unsafe<{ count: number }[]>(`SELECT count(*)::int AS count FROM ${table}`);
  return rows[0]!.count;
}

async function countImported(db: Db, table: string): Promise<number> {
  const rows = await db.execute<{ count: number }>(raw`SELECT count(*)::int AS count FROM ${raw.identifier(table)}`);
  return Number(rows[0]!.count);
}

async function buildCounts(db: Db, legacySql: Sql): Promise<VerifyReport['counts']> {
  const mk = (table: string, legacy: number, imported: number) => ({ table, legacy, imported, ok: legacy === imported });

  const [
    legacyProjects, importedProjects,
    legacyItems, importedItems,
    legacyValues, importedValues,
    legacyComments, importedComments,
    legacyReactions, importedReactions,
    legacyLinks, importedLinks,
    legacyEvents, importedEvents,
  ] = await Promise.all([
    countLegacy(legacySql, 'projects'), countImported(db, 'projects'),
    countLegacy(legacySql, 'tickets'), countImported(db, 'items'),
    countLegacy(legacySql, 'ticket_values'), countImported(db, 'item_values'),
    countLegacy(legacySql, 'comments'), countImported(db, 'comments'),
    countLegacy(legacySql, 'comment_reactions'), countImported(db, 'comment_reactions'),
    countLegacy(legacySql, 'ticket_links'), countImported(db, 'item_links'),
    countLegacy(legacySql, 'ticket_events'), countImported(db, 'events'),
  ]);

  return [
    mk('projects', legacyProjects, importedProjects),
    mk('items', legacyItems, importedItems),
    mk('item_values', legacyValues, importedValues),
    mk('comments', legacyComments, importedComments),
    mk('comment_reactions', legacyReactions, importedReactions),
    mk('item_links', legacyLinks, importedLinks),
    // events: legacy's audit trail (version 0, imported as-is) PLUS one
    // item.imported baseline per item (version 1, appended last) — see
    // import-history.ts. The "legacy" column is the expected total, not a
    // literal ticket_events row count.
    mk('events', legacyEvents + legacyItems, importedEvents),
  ];
}

export async function verifyImport(db: Db, legacySql: Sql): Promise<VerifyReport> {
  const counts = await buildCounts(db, legacySql);

  const [legacyStates, importedStates] = await Promise.all([
    readLegacyItemStates(legacySql),
    readImportedItemStates(db),
  ]);

  const legacyIdRows = await legacySql.unsafe<{ id: number }[]>('SELECT id FROM tickets');
  const importedIdRows = await db.execute<{ id: number }>(raw`SELECT id FROM items`);
  const allItemIds = [...new Set([...legacyIdRows.map((r) => r.id), ...[...importedIdRows].map((r) => r.id)])].sort(
    (a, b) => a - b,
  );

  const itemDiffs = diffItemStates(allItemIds, legacyStates, importedStates);

  const ok = itemDiffs.length === 0 && counts.every((c) => c.ok);

  return { ok, counts, itemDiffs };
}
