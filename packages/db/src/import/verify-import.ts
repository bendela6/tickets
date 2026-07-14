// packages/db/src/import/verify-import.ts
// Proves the import is correct by diffing the LOGICAL STATE of every item,
// old database vs new — not counts. An importer can write exactly the right
// number of rows and still point half of them at the wrong field, the wrong
// option, the wrong parent, the wrong type, or the wrong link target. See
// .superpowers/sdd/task-12-brief.md.
import { sql as raw } from 'drizzle-orm';
import type { Sql } from 'postgres';
import type { Db } from '../client';

export type RowDiff<TId extends string> = { [K in TId]: number } & {
  field: string;
  legacy: string | null;
  imported: string | null;
};

export type VerifyReport = {
  ok: boolean;
  counts: { table: string; legacy: number; imported: number; ok: boolean }[];
  // item_values, diffed by field KEY (the pre-existing check).
  itemDiffs: { itemId: number; field: string; legacy: string | null; imported: string | null }[];
  // items.{project_id, type_id, parent_id, number, archived_at} — the
  // skeleton every value/comment/link hangs off of. type_id is compared via
  // the item type's KEY, not the raw id, on the same "never trust ids to
  // line up across two separately-populated databases" principle as the
  // existing item_values diff (see renderImported below).
  skeletonDiffs: RowDiff<'itemId'>[];
  // comments: body, author, parent — row-by-row by comment id.
  commentDiffs: RowDiff<'commentId'>[];
  // item_links: link type (by KEY), source, target — row-by-row by link id.
  linkDiffs: RowDiff<'linkId'>[];
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

export function renderLegacy(r: LegacyValueRow): string | null {
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

export function renderImported(r: ImportedValueRow): string | null {
  if (r.option_value !== null) return r.option_value;
  if (r.user_name !== null) return r.user_name;
  return renderScalar(r);
}

// Exported for unit testing (see verify-import.test.ts): the real imported
// data has 0 rows in value_number/value_date/value_bool/value_json, so these
// branches never execute against tickets_dev, and the legacy schema has
// target_date/labels placements that WILL exercise them at cutover.
export function renderScalar(r: RawValueRow): string | null {
  if (r.value_text !== null) return r.value_text;
  if (r.value_number !== null) return r.value_number;
  if (r.value_date !== null) return r.value_date;
  if (r.value_bool !== null) return r.value_bool;
  if (r.value_json !== null) return r.value_json;
  return null;
}

// Exported for unit testing: the real imported data has no multi-value
// (item, field) groups, so the sort-and-join branch never executes against
// tickets_dev.
export function groupByItem(rows: { item_id: number; field_key: string; rendered: string | null }[]): Map<number, ItemState> {
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

// --- item skeleton: parent_id, type_id (via key), project_id, number,
// archived_at. type_key is compared rather than the raw type_id — same
// "never trust ids to line up, compare through a stable business key"
// principle the existing item_values diff already applies to fields and
// options. parent_id/project_id are plain ids: importLegacy explicitly
// preserves the legacy id on every id-bearing row it writes (projects,
// items, users all included), so a raw id compare is the correct check
// there — a real reparenting bug shows up as parent_id pointing at the
// WRONG (but still legacy-preserved) id, which this still catches. ---
type SkeletonRow = {
  id: number;
  project_id: number;
  type_key: string;
  parent_id: number | null;
  number: number;
  archived_at: string | null;
};

const SKELETON_FIELDS = ['project_id', 'type_key', 'parent_id', 'number', 'archived_at'] as const;

function normalize(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

async function readLegacySkeletons(legacySql: Sql): Promise<Map<number, SkeletonRow>> {
  const rows = await legacySql.unsafe<SkeletonRow[]>(`
    SELECT t.id, t.project_id, tt.key AS type_key, t.parent_id, t.number, t.archived_at::text AS archived_at
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.type_id
  `);
  return new Map(rows.map((r) => [r.id, r]));
}

async function readImportedSkeletons(db: Db): Promise<Map<number, SkeletonRow>> {
  const rows = await db.execute<SkeletonRow>(raw`
    SELECT i.id, i.project_id, it.key AS type_key, i.parent_id, i.number, i.archived_at::text AS archived_at
    FROM items i
    JOIN item_types it ON it.id = i.type_id
  `);
  return new Map([...rows].map((r) => [r.id, r]));
}

function diffSkeletons(
  itemIds: number[],
  legacyMap: Map<number, SkeletonRow>,
  importedMap: Map<number, SkeletonRow>,
): VerifyReport['skeletonDiffs'] {
  const diffs: VerifyReport['skeletonDiffs'] = [];
  for (const itemId of itemIds) {
    const l = legacyMap.get(itemId);
    const im = importedMap.get(itemId);
    for (const field of SKELETON_FIELDS) {
      const legacyValue = normalize(l?.[field]);
      const importedValue = normalize(im?.[field]);
      if (legacyValue !== importedValue) {
        diffs.push({ itemId, field, legacy: legacyValue, imported: importedValue });
      }
    }
  }
  return diffs;
}

// --- comments: body, author_id, parent_id. author_id/parent_id are raw-id
// compared for the same "ids are legacy-preserved" reason as the skeleton's
// project_id/parent_id above. ---
type CommentRow = { id: number; item_id: number; author_id: number; parent_id: number | null; body: string };

const COMMENT_FIELDS = ['item_id', 'author_id', 'parent_id', 'body'] as const;

async function readLegacyComments(legacySql: Sql): Promise<Map<number, CommentRow>> {
  const rows = await legacySql.unsafe<CommentRow[]>(`
    SELECT id, ticket_id AS item_id, author_id, parent_id, body FROM comments
  `);
  return new Map(rows.map((r) => [r.id, r]));
}

async function readImportedComments(db: Db): Promise<Map<number, CommentRow>> {
  const rows = await db.execute<CommentRow>(raw`
    SELECT id, item_id, author_id, parent_id, body FROM comments
  `);
  return new Map([...rows].map((r) => [r.id, r]));
}

function diffComments(
  commentIds: number[],
  legacyMap: Map<number, CommentRow>,
  importedMap: Map<number, CommentRow>,
): VerifyReport['commentDiffs'] {
  const diffs: VerifyReport['commentDiffs'] = [];
  for (const commentId of commentIds) {
    const l = legacyMap.get(commentId);
    const im = importedMap.get(commentId);
    for (const field of COMMENT_FIELDS) {
      const legacyValue = normalize(l?.[field]);
      const importedValue = normalize(im?.[field]);
      if (legacyValue !== importedValue) {
        diffs.push({ commentId, field, legacy: legacyValue, imported: importedValue });
      }
    }
  }
  return diffs;
}

// --- item_links: link_type (via key), source, target. Same key-vs-id
// principle as the skeleton's type_key. ---
type LinkRow = { id: number; link_type_key: string; source_item_id: number; target_item_id: number };

const LINK_FIELDS = ['link_type_key', 'source_item_id', 'target_item_id'] as const;

async function readLegacyLinks(legacySql: Sql): Promise<Map<number, LinkRow>> {
  const rows = await legacySql.unsafe<LinkRow[]>(`
    SELECT tl.id, lt.key AS link_type_key, tl.source_ticket_id AS source_item_id, tl.target_ticket_id AS target_item_id
    FROM ticket_links tl
    JOIN link_types lt ON lt.id = tl.link_type_id
  `);
  return new Map(rows.map((r) => [r.id, r]));
}

async function readImportedLinks(db: Db): Promise<Map<number, LinkRow>> {
  const rows = await db.execute<LinkRow>(raw`
    SELECT il.id, lt.key AS link_type_key, il.source_item_id, il.target_item_id
    FROM item_links il
    JOIN link_types lt ON lt.id = il.link_type_id
  `);
  return new Map([...rows].map((r) => [r.id, r]));
}

function diffLinks(
  linkIds: number[],
  legacyMap: Map<number, LinkRow>,
  importedMap: Map<number, LinkRow>,
): VerifyReport['linkDiffs'] {
  const diffs: VerifyReport['linkDiffs'] = [];
  for (const linkId of linkIds) {
    const l = legacyMap.get(linkId);
    const im = importedMap.get(linkId);
    for (const field of LINK_FIELDS) {
      const legacyValue = normalize(l?.[field]);
      const importedValue = normalize(im?.[field]);
      if (legacyValue !== importedValue) {
        diffs.push({ linkId, field, legacy: legacyValue, imported: importedValue });
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
    legacyViews, importedViews,
  ] = await Promise.all([
    countLegacy(legacySql, 'projects'), countImported(db, 'projects'),
    countLegacy(legacySql, 'tickets'), countImported(db, 'items'),
    countLegacy(legacySql, 'ticket_values'), countImported(db, 'item_values'),
    countLegacy(legacySql, 'comments'), countImported(db, 'comments'),
    countLegacy(legacySql, 'comment_reactions'), countImported(db, 'comment_reactions'),
    countLegacy(legacySql, 'ticket_links'), countImported(db, 'item_links'),
    countLegacy(legacySql, 'ticket_events'), countImported(db, 'events'),
    countLegacy(legacySql, 'views'), countImported(db, 'views'),
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
    mk('views', legacyViews, importedViews),
  ];
}

export async function verifyImport(db: Db, legacySql: Sql): Promise<VerifyReport> {
  const counts = await buildCounts(db, legacySql);

  const [legacyStates, importedStates, legacySkeletons, importedSkeletons, legacyComments, importedComments, legacyLinks, importedLinks] =
    await Promise.all([
      readLegacyItemStates(legacySql),
      readImportedItemStates(db),
      readLegacySkeletons(legacySql),
      readImportedSkeletons(db),
      readLegacyComments(legacySql),
      readImportedComments(db),
      readLegacyLinks(legacySql),
      readImportedLinks(db),
    ]);

  const legacyIdRows = await legacySql.unsafe<{ id: number }[]>('SELECT id FROM tickets');
  const importedIdRows = await db.execute<{ id: number }>(raw`SELECT id FROM items`);
  const allItemIds = [...new Set([...legacyIdRows.map((r) => r.id), ...[...importedIdRows].map((r) => r.id)])].sort(
    (a, b) => a - b,
  );

  const itemDiffs = diffItemStates(allItemIds, legacyStates, importedStates);
  const skeletonDiffs = diffSkeletons(allItemIds, legacySkeletons, importedSkeletons);

  const allCommentIds = [...new Set([...legacyComments.keys(), ...importedComments.keys()])].sort((a, b) => a - b);
  const commentDiffs = diffComments(allCommentIds, legacyComments, importedComments);

  const allLinkIds = [...new Set([...legacyLinks.keys(), ...importedLinks.keys()])].sort((a, b) => a - b);
  const linkDiffs = diffLinks(allLinkIds, legacyLinks, importedLinks);

  const ok =
    itemDiffs.length === 0 &&
    skeletonDiffs.length === 0 &&
    commentDiffs.length === 0 &&
    linkDiffs.length === 0 &&
    counts.every((c) => c.ok);

  return { ok, counts, itemDiffs, skeletonDiffs, commentDiffs, linkDiffs };
}
