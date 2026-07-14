import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import { fields, itemTypeFields, itemTypes, optionSets, options, optionTransitions } from '../schema';
import { seedScheme } from './seed-scheme';
import { softwareScheme } from './software-scheme';

describe('seedScheme (requires POSTGRES_DATABASE=tickets_dev)', () => {
  let db: Db;
  let sql: ReturnType<typeof createDbClient>['sql'];
  let seeded: Awaited<ReturnType<typeof seedScheme>>;

  beforeAll(async () => {
    ({ db, sql } = createDbClient({ max: 1 }));
    seeded = await seedScheme(db, softwareScheme);
  });
  afterAll(async () => { await sql.end(); });

  it('creates one shared status option set with lifecycle kinds', async () => {
    const [set] = await db.select().from(optionSets).where(eq(optionSets.key, 'status'));
    const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.every((o) => o.kind !== null)).toBe(true);
    expect(rows.some((o) => o.kind === 'done')).toBe(true);
  });

  it('gives non-workflow options a null kind', async () => {
    const [set] = await db.select().from(optionSets).where(eq(optionSets.key, 'priority'));
    const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
    expect(rows.every((o) => o.kind === null)).toBe(true);
  });

  it('makes status a system option field, not a status type', async () => {
    const [status] = await db.select().from(fields).where(eq(fields.key, 'status'));
    expect(status!.type).toBe('option');
    expect(status!.system).toBe(true);
    expect(status!.optionSetId).not.toBeNull();
  });

  it('shares one field definition across types via placements', async () => {
    const statusId = seeded.fieldIdByKey.get('status')!;
    const placements = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.fieldId, statusId));
    expect(placements.length).toBe(seeded.typeIdByKey.size);
  });

  it('records each type\'s status subset as an allowlist on the placement', async () => {
    const statusId = seeded.fieldIdByKey.get('status')!;
    const epicId = seeded.typeIdByKey.get('epic')!;
    const [placement] = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.itemTypeId, epicId));
    const forStatus = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.fieldId, statusId));
    const epicPlacement = forStatus.find((p) => p.itemTypeId === epicId)!;
    const override = epicPlacement.configOverride as { allowedOptionIds?: number[] };
    expect(Array.isArray(override.allowedOptionIds)).toBe(true);
    expect(override.allowedOptionIds!.length).toBe(5); // epic has 5 statuses
  });

  it('writes the workflow graph into option_transitions', async () => {
    const rows = await db.select().from(optionTransitions);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((t) => t.fromOptionId === null)).toBe(true); // a valid start
  });
});
