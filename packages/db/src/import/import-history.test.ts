import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, sql as raw } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import { commands, events, fields, itemActivity, optionSets, options, outbox, schemes, users } from '../schema';

describe('imported history (run after import-legacy.test.ts)', () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const c = createDbClient({ max: 1 });
    db = c.db;
    close = () => c.sql.end();
  });
  afterAll(async () => {
    // import-legacy.test.ts's afterAll deliberately leaves fields, options,
    // option_sets, schemes, users and events alone — this file is the last
    // reader of all of them (its own tests above, plus import-legacy.test.ts's
    // orphan check depends on fields still existing when *this* file runs).
    // Finish the cleanup here, children before parents, so the whole-suite
    // run stays idempotent on an immediate second `pnpm test` with no DB
    // reset. If nothing was ever imported (e.g. import-legacy.test.ts's
    // beforeAll rejected), these deletes are harmless no-ops.
    await db.delete(events);

    const [scheme] = await db.select({ id: schemes.id }).from(schemes).where(eq(schemes.key, 'software'));
    if (scheme) {
      // fields.option_set_id -> option_sets.id, so fields must go first.
      await db.delete(fields).where(eq(fields.schemeId, scheme.id));
      const setRows = await db.select({ id: optionSets.id }).from(optionSets).where(eq(optionSets.schemeId, scheme.id));
      const setIds = setRows.map((s) => s.id);
      if (setIds.length) await db.delete(options).where(inArray(options.optionSetId, setIds));
      await db.delete(optionSets).where(eq(optionSets.schemeId, scheme.id));
      await db.delete(schemes).where(eq(schemes.id, scheme.id));
    }

    // Other test files that write `users` (e.g. item-values-integrity.test.ts)
    // clean up their own rows within their own afterAll, and fileParallelism
    // is off (one file fully finishes before the next starts) — so by the
    // time this afterAll runs, every remaining row is this import's.
    await db.delete(users);

    await close();
  });

  it('imports all 1523 legacy events plus one baseline per item', async () => {
    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1523 + 635);
  });

  it('marks legacy events version 0 and maps every kind', async () => {
    const legacy = await db.select().from(events).where(eq(events.version, 0));
    expect(legacy).toHaveLength(1523);
    const kinds = new Set(legacy.map((e) => e.kind));
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

  it('remaps fieldId in legacy payloads to the NEW field ids', async () => {
    const changed = await db
      .select()
      .from(events)
      .where(and(eq(events.kind, 'item.field_changed'), eq(events.version, 0)));
    expect(changed.length).toBe(48); // 45 status-changed + 3 value-changed
    const [row] = await db.execute<{ orphans: number }>(raw`
      SELECT count(*)::int AS orphans FROM events e
      WHERE e.kind = 'item.field_changed' AND e.version = 0
        AND NOT EXISTS (SELECT 1 FROM fields f WHERE f.id = (e.payload->>'fieldId')::int)
    `);
    expect(row!.orphans).toBe(0);
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
