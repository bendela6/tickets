// packages/db/src/export/summarize-export.ts
// What is still open in an exported project, and what moved lately — read
// from the export alone, never the database.
//
// Open: the item's status option's kind is not done or dropped (so todo,
// active and blocked are open). Archived items are counted apart and are
// neither open nor closed. An item with no status, or a status option with no
// kind, is counted in `noStatus` and as open.
//
// Last real change, per item: the latest of
//   - items.created_at, items.updated_at (the optimistic-lock token: the
//     legacy import kept the old system's value, and every edit since moves
//     it), items.archived_at,
//   - its comments' and links' created_at,
//   - its events of version 1 or more, except `item.imported`.
// Left out on purpose: version-0 events (the legacy import's display-only
// copy of the old history) and `item.imported` (the import's one baseline
// snapshot per item, stamped with the moment the import ran — it records the
// move, not a change to the item).
import type { ProjectExport, Row } from './export-project';

export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';

export type ExportSummary = {
  project: string; // item prefix, e.g. TIX
  items: number;
  archived: number;
  // not archived:
  open: number;
  closed: number;
  noStatus: number;
  byKind: Record<StatusKind, number>;
  // every item, archived included:
  changedSince: string; // ISO; now - days
  changedRecently: number;
  openChangedRecently: number;
  lastChange: string | null; // ISO, the project's newest real change
};

const OPEN_KINDS = new Set<StatusKind>(['todo', 'active', 'blocked']);

// Postgres renders timestamptz as "2026-07-04 20:22:42.524214+00"; make it
// something Date parses everywhere ("2026-07-04T20:22:42.524+00:00").
export function parsePgTimestamp(value: string): number {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(
    value,
  );
  if (!m) throw new Error(`not a timestamp: ${value}`);
  const [, date, time, frac = '', zone = 'Z'] = m;
  const ms = frac ? frac.slice(0, 4).padEnd(4, '0') : '';
  const tz =
    zone === 'Z'
      ? 'Z'
      : /^[+-]\d{2}$/.test(zone)
        ? `${zone}:00`
        : zone.length === 5
          ? `${zone.slice(0, 3)}:${zone.slice(3)}`
          : zone;
  const t = Date.parse(`${date}T${time}${ms}${tz}`);
  if (Number.isNaN(t)) throw new Error(`not a timestamp: ${value}`);
  return t;
}

export function lastRealChangeByItem(exp: ProjectExport): Map<number, number> {
  const last = new Map<number, number>();
  const bump = (itemId: unknown, at: unknown) => {
    if (typeof itemId !== 'number' || typeof at !== 'string') return;
    const t = parsePgTimestamp(at);
    if (t > (last.get(itemId) ?? -Infinity)) last.set(itemId, t);
  };
  for (const i of exp.rows['records.items']) {
    bump(i.id, i.created_at);
    bump(i.id, i.updated_at);
    bump(i.id, i.archived_at);
  }
  const own = new Set(exp.rows['records.items'].map((i) => i.id));
  for (const c of exp.rows['records.comments']) bump(c.item_id, c.created_at);
  for (const l of exp.rows['records.item_links']) {
    if (own.has(l.source_item_id)) bump(l.source_item_id, l.created_at);
    if (own.has(l.target_item_id)) bump(l.target_item_id, l.created_at);
  }
  for (const e of exp.rows['history.events']) {
    if (e.aggregate_type !== 'item' || (e.version as number) < 1 || e.kind === 'item.imported')
      continue;
    if (own.has(e.aggregate_id)) bump(e.aggregate_id, e.at);
  }
  return last;
}

function statusKindByItem(exp: ProjectExport): Map<number, StatusKind | null> {
  const statusField = exp.referenced['structure.fields'].find((f) => f.key === 'status');
  const kindByOption = new Map<unknown, StatusKind | null>(
    exp.referenced['structure.options'].map((o: Row) => [
      o.id,
      (o.kind as StatusKind | null) ?? null,
    ]),
  );
  const out = new Map<number, StatusKind | null>();
  if (!statusField) return out;
  for (const v of exp.rows['records.item_values']) {
    if (v.field_id !== statusField.id || v.option_id === null) continue;
    out.set(v.item_id as number, kindByOption.get(v.option_id) ?? null);
  }
  return out;
}

export function summarizeExport(
  exp: ProjectExport,
  { now = Date.now(), days = 90 }: { now?: number; days?: number } = {},
): ExportSummary {
  const since = now - days * 24 * 60 * 60 * 1000;
  const kinds = statusKindByItem(exp);
  const last = lastRealChangeByItem(exp);
  const byKind: Record<StatusKind, number> = {
    todo: 0,
    active: 0,
    blocked: 0,
    done: 0,
    dropped: 0,
  };
  let archived = 0,
    open = 0,
    closed = 0,
    noStatus = 0,
    changedRecently = 0,
    openChangedRecently = 0;
  let newest = -Infinity;

  for (const item of exp.rows['records.items']) {
    const id = item.id as number;
    const changed = last.get(id) ?? -Infinity;
    newest = Math.max(newest, changed);
    const recent = changed >= since;
    if (recent) changedRecently++;
    if (item.archived_at !== null) {
      archived++;
      continue;
    }
    const kind = kinds.get(id) ?? null;
    if (kind) byKind[kind]++;
    else noStatus++;
    const isOpen = kind === null || OPEN_KINDS.has(kind);
    if (isOpen) {
      open++;
      if (recent) openChangedRecently++;
    } else {
      closed++;
    }
  }

  return {
    project: exp.project.itemPrefix,
    items: exp.rows['records.items'].length,
    archived,
    open,
    closed,
    noStatus,
    byKind,
    changedSince: new Date(since).toISOString(),
    changedRecently,
    openChangedRecently,
    lastChange: Number.isFinite(newest) ? new Date(newest).toISOString() : null,
  };
}
