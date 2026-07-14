// packages/db/src/import/import-history.ts
// Imports the legacy ticket_events audit trail into the new append-only
// events log. The old log is lossy by construction (free-text kinds,
// payloads carrying rendered display strings rather than raw ids) — nothing
// can make it retroactively replayable, so it lands as version 0: history
// you can read but not fold.
//
// Per item, in (created_at, id) order: legacy events first (seq 1..n,
// version 0, kind mapped through LEGACY_KIND_MAP), then ONE `item.imported`
// baseline appended LAST (seq n+1, version 1) carrying the item's full value
// snapshot. A rebuild starts at the newest `item.imported` and folds
// forward — everything before it is display-only. See
// .superpowers/sdd/task-11-brief.md.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DbTransaction } from '../client';
import { events, fields, itemValues, users } from '../schema';
import { mapKind } from './kind-map';
import type { Legacy, LegacyEvent } from './read-legacy';

export type ImportHistoryIds = {
  // legacy field id -> new field id (Task 10's ImportResult.fieldIdByLegacyId)
  fieldIdByLegacyId: Map<number, number>;
};

// The two legacy kinds whose payload carries a *legacy* fieldId. The old
// schema was type-owned (46 field rows); the new one is shared (15) — a
// stale legacy id would otherwise silently resolve to an unrelated field.
const FIELD_ID_KINDS = new Set(['status-changed', 'value-changed']);

// One single, verified anomaly in the live legacy data: ticket_event 1293
// (ticket 490, value-changed, "epic" -> "migration-cleanup") carries
// fieldId 11 and fieldKey "epic". Neither resolves: id 11 isn't a fields.id
// in any generation of the legacy fields table this dump captured (it's the
// *ticket_type* id for "epic"), and no field named "epic" exists in the
// current 46-row legacy fields snapshot either — epic membership is tracked
// structurally via items.parent_id today, not a scalar field, so the
// concept this row recorded has no surviving successor field at all. Best-
// effort categorisation target for this one otherwise-unmappable row; see
// task-11-report.md for the full reasoning.
const LEGACY_FIELD_KEY_ALIASES: Record<string, string> = {
  epic: 'labels',
};

function remapPayload(
  ev: LegacyEvent,
  fieldIdByLegacyId: Map<number, number>,
  fieldIdByKey: Map<string, number>,
): Record<string, unknown> {
  if (!FIELD_ID_KINDS.has(ev.kind)) return ev.payload;
  const legacyFieldId = ev.payload.fieldId;
  if (typeof legacyFieldId !== 'number') {
    throw new Error(`ticket_event ${ev.id} (${ev.kind}) has a non-numeric fieldId in its payload`);
  }

  // The direct legacy-id path only covers ids present in the *current*
  // legacy fields table (Task 10's fieldIdByLegacyId, sourced from
  // map-structure's fieldKeyByLegacyId). Some status-changed/value-changed
  // rows predate that table's current generation — the legacy fields table
  // was itself recreated at some point in the old system's life, so the id
  // baked into an old event payload can point at a row that no longer
  // exists anywhere, not even under a different key. Fall back to the
  // payload's own fieldKey, which the legacy writer always stamped
  // alongside fieldId and which — unlike the numeric id — is stable across
  // the rebuild (map-structure.ts preserves keys 1:1); and if even that key
  // is itself retired, fall back once more to the documented alias above.
  let fieldId = fieldIdByLegacyId.get(legacyFieldId);
  if (fieldId === undefined) {
    const fieldKey = ev.payload.fieldKey;
    if (typeof fieldKey === 'string') {
      fieldId = fieldIdByKey.get(fieldKey) ?? fieldIdByKey.get(LEGACY_FIELD_KEY_ALIASES[fieldKey] ?? '');
    }
  }
  if (fieldId === undefined) {
    throw new Error(
      `ticket_event ${ev.id} (${ev.kind}) references unknown field (legacy field id ${legacyFieldId}, fieldKey ${JSON.stringify(ev.payload.fieldKey)})`,
    );
  }

  // fieldKey passes through untouched — it was never legacy-id-scoped.
  return { ...ev.payload, fieldId };
}

// Collapses one item_values row to its raw stored value — the actual column
// value, not a rendered display string (that rendering is exactly what made
// the legacy log lossy). Order matches the iv_one_value CHECK constraint.
function extractValue(row: typeof itemValues.$inferSelect): unknown {
  if (row.valueText !== null) return row.valueText;
  if (row.valueNumber !== null) return row.valueNumber;
  if (row.valueDate !== null) return row.valueDate;
  if (row.valueBool !== null) return row.valueBool;
  if (row.valueJson !== null) return row.valueJson;
  if (row.optionId !== null) return row.optionId;
  if (row.valueUserId !== null) return row.valueUserId;
  return null;
}

export async function importHistory(tx: DbTransaction, legacy: Legacy, ids: ImportHistoryIds): Promise<void> {
  if (!legacy.tickets.length) return;

  // --- the `migration` user: actor of record for every item.imported
  // baseline. In the real data this is one of the 3 legacy users (imported
  // verbatim in step 1 of importLegacy, preserving its legacy id) — looked
  // up rather than assumed so a database that happens not to have one still
  // gets a usable actor instead of a NOT NULL violation. ---
  const [existingMigrationUser] = await tx.select({ id: users.id }).from(users).where(eq(users.name, 'migration'));
  const migrationUserId = existingMigrationUser
    ? existingMigrationUser.id
    : (await tx.insert(users).values({ name: 'migration', kind: 'agent' }).returning({ id: users.id }))[0]!.id;

  // --- field id <-> {key, type}: id -> key/type for the baseline snapshot's
  // value list; key -> id as the fieldKey fallback in remapPayload. ---
  const fieldRows = await tx.select({ id: fields.id, key: fields.key, type: fields.type }).from(fields);
  const fieldByNewId = new Map(fieldRows.map((f) => [f.id, { key: f.key, type: f.type }]));
  const fieldIdByKey = new Map(fieldRows.map((f) => [f.key, f.id]));

  // --- item_values already written by importLegacy (same transaction), for
  // the baseline snapshot. ---
  const valueRows = await tx.select().from(itemValues);
  const valuesByItem = new Map<number, (typeof valueRows)>();
  for (const v of valueRows) {
    const list = valuesByItem.get(v.itemId);
    if (list) list.push(v);
    else valuesByItem.set(v.itemId, [v]);
  }

  // --- legacy events grouped by ticket, preserving read-legacy.ts's
  // `ticket_id, created_at, id` order — the ORDER BY already guarantees
  // (created_at, id) order within each group, so no re-sort here. ---
  const eventsByTicket = new Map<number, LegacyEvent[]>();
  for (const ev of legacy.ticketEvents) {
    const list = eventsByTicket.get(ev.ticketId);
    if (list) list.push(ev);
    else eventsByTicket.set(ev.ticketId, [ev]);
  }

  const importedAt = new Date().toISOString();
  const rows: (typeof events.$inferInsert)[] = [];

  for (const t of legacy.tickets) {
    const legacyEvts = eventsByTicket.get(t.id) ?? [];

    legacyEvts.forEach((ev, i) => {
      const correlationId = randomUUID();
      rows.push({
        aggregateType: 'item',
        aggregateId: t.id,
        seq: i + 1,
        kind: mapKind(ev.kind),
        version: 0,
        payload: remapPayload(ev, ids.fieldIdByLegacyId, fieldIdByKey),
        actorId: ev.actorId,
        at: ev.createdAt, // raw legacy string, full microsecond precision — no Date() round-trip
        commandId: correlationId,
        correlationId,
        causedBy: null,
        depth: 0,
        projectId: t.projectId,
      });
    });

    const itemVals = valuesByItem.get(t.id) ?? [];
    const correlationId = randomUUID();
    rows.push({
      aggregateType: 'item',
      aggregateId: t.id,
      seq: legacyEvts.length + 1,
      kind: 'item.imported',
      version: 1,
      payload: {
        projectId: t.projectId,
        typeId: t.typeId,
        number: t.number,
        parentId: t.parentId,
        values: itemVals.map((v) => {
          const field = fieldByNewId.get(v.fieldId);
          if (!field) throw new Error(`item_value ${v.id} references unknown field id ${v.fieldId}`);
          return { fieldKey: field.key, type: field.type, value: extractValue(v) };
        }),
      },
      actorId: migrationUserId,
      at: importedAt,
      commandId: correlationId,
      correlationId,
      causedBy: null,
      depth: 0,
      projectId: t.projectId,
    });
  }

  if (rows.length) await tx.insert(events).values(rows);
}
