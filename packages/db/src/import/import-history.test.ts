import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, sql as raw } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import {
  comments, commentReactions, commands, events, fields, itemActivity, itemLinks,
  itemTypeChildTypes, itemTypeFields, itemTypes, itemValues, items, linkTypeTargetTypes,
  linkTypes, optionSets, optionTransitions, options, outbox, projects, schemes, users, views,
} from '../schema';
import { createLegacyClient } from './legacy-client';
import { importLegacy, type ImportResult } from './import-legacy';
import { readLegacy, type Legacy } from './read-legacy';

describe('imported history (requires a freshly migrated tickets_test)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let legacy: Legacy;
  let result: ImportResult;

  // This file has no data dependency on import-legacy.test.ts (or any other
  // file) — it runs its own full import, the same way import-legacy.test.ts
  // does, so it's a self-sufficient world with its own beforeAll/afterAll.
  beforeAll(async () => {
    const target = createDbClient({ max: 1 });
    const legacyClient = createLegacyClient();
    db = target.db;
    close = async () => {
      await target.sql.end();
      await legacyClient.sql.end();
    };
    legacy = await readLegacy(legacyClient.sql);
    result = await importLegacy(db, legacy);
  }, 120_000);

  afterAll(async () => {
    // If beforeAll itself threw (e.g. importLegacy rejected), the whole
    // transaction rolled back — nothing to clean up — but `result`/`legacy`
    // may be unset, so skip straight to closing the connections.
    if (!result || !legacy) {
      await close();
      return;
    }

    // Delete exactly what this file's import created, children before
    // parents, so the whole-suite run stays idempotent on an immediate
    // second `pnpm test` with no DB reset. Mirrors import-legacy.test.ts's
    // afterAll — this file runs the same import, independently.
    await db.delete(events);
    await db.delete(itemLinks).where(inArray(itemLinks.id, legacy.ticketLinks.map((l) => l.id)));
    await db.delete(commentReactions).where(inArray(commentReactions.id, legacy.commentReactions.map((r) => r.id)));
    await db.delete(comments).where(inArray(comments.id, legacy.comments.map((c) => c.id)));
    await db.delete(itemValues).where(inArray(itemValues.id, legacy.ticketValues.map((v) => v.id)));
    await db.delete(items).where(inArray(items.id, legacy.tickets.map((t) => t.id)));
    await db.delete(views).where(inArray(views.id, legacy.views.map((v) => v.id)));

    const typeIds = legacy.ticketTypes.map((t) => t.id);
    await db.delete(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds));
    await db.delete(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, typeIds));

    const linkTypeIds = legacy.linkTypes.map((lt) => lt.id);
    await db.delete(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkTypeIds));
    await db.delete(linkTypes).where(inArray(linkTypes.id, linkTypeIds));

    await db.delete(optionTransitions).where(inArray(optionTransitions.fieldId, [...result.fieldIdByLegacyId.values()]));
    await db.delete(itemTypes).where(inArray(itemTypes.id, typeIds));
    await db.delete(projects).where(inArray(projects.id, legacy.projects.map((p) => p.id)));

    await db.delete(fields).where(eq(fields.schemeId, result.schemeId));
    const setRows = await db.select({ id: optionSets.id }).from(optionSets).where(eq(optionSets.schemeId, result.schemeId));
    const setIds = setRows.map((s) => s.id);
    if (setIds.length) await db.delete(options).where(inArray(options.optionSetId, setIds));
    await db.delete(optionSets).where(eq(optionSets.schemeId, result.schemeId));
    await db.delete(schemes).where(eq(schemes.id, result.schemeId));

    await db.delete(users).where(
      inArray(users.id, [...legacy.users.map((u) => u.id), ...result.userIdByAgentName.values()]),
    );

    await close();
  });

  it('imports all 1523 legacy events plus one baseline per item', async () => {
    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1523 + 635);
  });

  it('marks legacy events version 0 and maps every kind', async () => {
    const legacyRows = await db.select().from(events).where(eq(events.version, 0));
    expect(legacyRows).toHaveLength(1523);
    const kinds = new Set(legacyRows.map((e) => e.kind));
    expect([...kinds].sort()).toEqual([
      'item.archived', 'item.comment_added', 'item.created', 'item.field_changed',
      'item.link_added', 'item.link_removed', 'item.reparented', 'item.unarchived',
    ]);
  });

  it('puts the item.imported baseline LAST in every stream', async () => {
    const [row] = await db.execute<{ bad: number }>(raw`
      SELECT count(*)::int AS bad FROM events e
      WHERE e.kind = 'item.imported'
        AND EXISTS (
          SELECT 1 FROM events later
          WHERE later.aggregate_type = 'item' AND later.aggregate_id = e.aggregate_id
            AND later.seq > e.seq)
    `);
    expect(row!.bad).toBe(0);
  });

  it('gives every item exactly one baseline', async () => {
    const rows = await db.select().from(events).where(eq(events.kind, 'item.imported'));
    expect(rows).toHaveLength(635);
    expect(rows.every((r) => r.version === 1)).toBe(true);
  });

  // "Zero orphans" means every fieldId that IS present in a field_changed
  // payload resolves to a real fields row — an omitted fieldId is fine and
  // expected (see the next two tests): import-history.ts never fabricates a
  // field mapping when neither the legacy id nor the fieldKey resolves.
  it('remaps fieldId in legacy payloads to the NEW field ids where a mapping exists, and never to a wrong one', async () => {
    const changed = await db
      .select()
      .from(events)
      .where(and(eq(events.kind, 'item.field_changed'), eq(events.version, 0)));
    expect(changed.length).toBe(48); // 45 status-changed + 3 value-changed
    const [row] = await db.execute<{ orphans: number }>(raw`
      SELECT count(*)::int AS orphans FROM events e
      WHERE e.kind = 'item.field_changed' AND e.version = 0
        AND e.payload ? 'fieldId'
        AND NOT EXISTS (SELECT 1 FROM fields f WHERE f.id = (e.payload->>'fieldId')::int)
    `);
    expect(row!.orphans).toBe(0);
  });

  // Resolution order (import-history.ts's remapPayload): (1) the direct
  // legacy fieldId map, (2) fall back to the payload's own fieldKey against
  // the new fields' keys, (3) never fabricate — omit fieldId. This is the
  // main path, not an edge case: in the real data ALL 45 status-changed
  // events carry a legacy fieldId absent from the legacy fields table
  // entirely, and only resolve via step 2.
  it('resolves all 45 status-changed events via the fieldKey fallback to the correct new status field id', async () => {
    const [status] = await db.select({ id: fields.id }).from(fields).where(eq(fields.key, 'status'));
    expect(status).toBeDefined();

    const changed = await db
      .select()
      .from(events)
      .where(and(eq(events.kind, 'item.field_changed'), eq(events.version, 0)));
    const statusRows = changed.filter((r) => (r.payload as Record<string, unknown>).fieldKey === 'status');

    expect(statusRows).toHaveLength(45);
    expect(statusRows.every((r) => (r.payload as Record<string, unknown>).fieldId === status!.id)).toBe(true);
  });

  // The one legacy field_changed row (ticket_event 1293, item 490,
  // "epic" -> "migration-cleanup") that resolves through neither the legacy
  // id map nor the fieldKey fallback: there is no field named "epic" in any
  // generation of the legacy fields table, and no surviving successor field
  // (epic membership is tracked structurally via items.parent_id today, not
  // a scalar field). import-history.ts must NOT guess a field for it — the
  // payload keeps fieldKey "epic" and simply omits fieldId.
  it('honestly omits fieldId for ticket_event 1293 ("epic") instead of fabricating a field mapping', async () => {
    const rows = await db
      .select()
      .from(events)
      .where(and(eq(events.aggregateId, 490), eq(events.kind, 'item.field_changed'), eq(events.version, 0)));
    const epicRow = rows.find((r) => (r.payload as Record<string, unknown>).fieldKey === 'epic');

    expect(epicRow).toBeDefined();
    expect(epicRow!.payload).toEqual({ to: 'migration-cleanup', from: null, fieldKey: 'epic' });
    expect(Object.prototype.hasOwnProperty.call(epicRow!.payload as object, 'fieldId')).toBe(false);
  });

  it('numbers seq from 1 with no gaps per stream', async () => {
    const [row] = await db.execute<{ bad: number }>(raw`
      SELECT count(*)::int AS bad FROM (
        SELECT aggregate_id, count(*) AS n, max(seq) AS hi, min(seq) AS lo
        FROM events WHERE aggregate_type = 'item' GROUP BY aggregate_id
      ) s WHERE s.lo <> 1 OR s.hi <> s.n
    `);
    expect(row!.bad).toBe(0);
  });

  it('leaves outbox, commands and item_activity empty', async () => {
    expect(await db.select().from(outbox)).toHaveLength(0);
    expect(await db.select().from(commands)).toHaveLength(0);
    expect(await db.select().from(itemActivity)).toHaveLength(0);
  });
});
