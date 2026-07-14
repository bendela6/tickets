import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray, sql as raw } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import {
  comments, commentReactions, fields, itemLinks, itemTypeChildTypes, itemTypeFields, itemTypes,
  itemValues, items, linkTypeTargetTypes, linkTypes, optionSets, optionTransitions, options,
  projects, schemes, users, views,
} from '../schema';
import { createLegacyClient } from './legacy-client';
import { importLegacy, type ImportResult } from './import-legacy';
import { readLegacy, type Legacy } from './read-legacy';

describe('importLegacy (requires a freshly migrated tickets_dev)', () => {
  let db: Db;
  let close: () => Promise<void>;
  let legacy: Legacy;
  let result: ImportResult;

  beforeAll(async () => {
    const target = createDbClient({ max: 1 });
    const legacyClient = createLegacyClient();
    db = target.db;
    close = async () => { await target.sql.end(); await legacyClient.sql.end(); };
    legacy = await readLegacy(legacyClient.sql);
    result = await importLegacy(db, legacy);
  }, 120_000);

  afterAll(async () => {
    // Delete exactly what importLegacy created, children before parents, so
    // the whole-suite run stays idempotent: a second `pnpm test` with no
    // database reset must find the same clean, freshly-migrated tickets_dev
    // this test started with (and so must every other file that inserts a
    // fixed 'software'/scheme-scoped key, e.g. seed-scheme.test.ts).
    //
    // If beforeAll itself threw (e.g. importLegacy rejected), the whole
    // transaction rolled back — nothing to clean up — but `result`/`legacy`
    // may be unset, so skip straight to closing the connections.
    if (!result || !legacy) {
      await close();
      return;
    }
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
    await db.delete(fields).where(eq(fields.schemeId, result.schemeId));

    const setRows = await db.select({ id: optionSets.id }).from(optionSets).where(eq(optionSets.schemeId, result.schemeId));
    const setIds = setRows.map((s) => s.id);
    if (setIds.length) await db.delete(options).where(inArray(options.optionSetId, setIds));
    await db.delete(optionSets).where(eq(optionSets.schemeId, result.schemeId));

    await db.delete(projects).where(inArray(projects.id, legacy.projects.map((p) => p.id)));
    await db.delete(schemes).where(eq(schemes.id, result.schemeId));

    const userIds = [...legacy.users.map((u) => u.id), ...result.userIdByAgentName.values()];
    await db.delete(users).where(inArray(users.id, userIds));

    await close();
  });

  it('imports every item, preserving ids', async () => {
    const rows = await db.select().from(items);
    expect(rows).toHaveLength(635);
    expect(rows.some((i) => i.id === 1)).toBe(true);
  });

  it('imports every value', async () => {
    const rows = await db.select().from(itemValues);
    expect(rows).toHaveLength(2948);
  });

  it('puts assignee values in value_user_id, not option_id', async () => {
    const [assignee] = await db.select().from(fields).where(eq(fields.key, 'assignee'));
    const rows = await db.select().from(itemValues).where(eq(itemValues.fieldId, assignee!.id));
    expect(rows).toHaveLength(347);
    expect(rows.every((r) => r.valueUserId !== null && r.optionId === null)).toBe(true);
  });

  it('creates the 4 agent users and leaves the original 3 alone', async () => {
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(7);
    expect(rows.filter((u) => u.name === 'claude')).toHaveLength(1);
    expect(rows.some((u) => u.name === 'claude-sonnet-5' && u.kind === 'agent')).toBe(true);
  });

  it('stores status as an option value with a lifecycle kind', async () => {
    const [status] = await db.select().from(fields).where(eq(fields.key, 'status'));
    const rows = await db.select().from(itemValues).where(eq(itemValues.fieldId, status!.id));
    expect(rows).toHaveLength(635);
    expect(rows.every((r) => r.optionId !== null)).toBe(true);
    const opts = await db.select().from(options);
    const byId = new Map(opts.map((o) => [o.id, o]));
    expect(rows.every((r) => byId.get(r.optionId!)!.kind !== null)).toBe(true);
  });

  it('resets sequences so new inserts do not collide with preserved ids', async () => {
    const rows = await db.execute<{ next: number }>(
      raw`SELECT nextval(pg_get_serial_sequence('items', 'id')) AS next`,
    );
    expect(Number(rows[0]!.next)).toBeGreaterThan(635);
  });
});
