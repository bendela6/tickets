import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import { fields, itemTypeFields, itemTypes, optionSets, options, optionTransitions } from '../schema';
import { deleteSeededScheme, seedScheme } from './seed-scheme';
import { softwareScheme } from './software-scheme';

// The full (value -> kind) mapping the shared status option set must carry.
// Pinned as a whole so a swap or omission fails, not just "some option is done".
const EXPECTED_STATUS_KINDS: Record<string, string> = {
  triage: 'todo',
  backlog: 'todo',
  todo: 'todo',
  'in-progress': 'active',
  'in-review': 'active',
  merged: 'active',
  deployed: 'active',
  blocked: 'blocked',
  done: 'done',
  fixed: 'done',
  cancelled: 'dropped',
  'wont-fix': 'dropped',
};

describe('seedScheme (requires POSTGRES_DATABASE=tickets_dev)', () => {
  let db: Db;
  let sql: ReturnType<typeof createDbClient>['sql'];
  let seeded: Awaited<ReturnType<typeof seedScheme>>;

  beforeAll(async () => {
    ({ db, sql } = createDbClient({ max: 1 }));
    seeded = await seedScheme(db, softwareScheme);
  });
  afterAll(async () => {
    // Fixed scheme key ('software') — clean up exactly what we created so the
    // suite can re-seed the same key on the next run without a DB reset.
    await deleteSeededScheme(db, seeded);
    await sql.end();
  });

  it('creates one shared status option set with lifecycle kinds', async () => {
    const [set] = await db.select().from(optionSets).where(eq(optionSets.key, 'status'));
    const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.every((o) => o.kind !== null)).toBe(true);
    expect(rows.some((o) => o.kind === 'done')).toBe(true);
  });

  it('pins the exact status value -> kind mapping (a swap or omission must fail)', async () => {
    const [set] = await db.select().from(optionSets).where(eq(optionSets.key, 'status'));
    const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
    const actual = Object.fromEntries(rows.map((o) => [o.value, o.kind]));
    expect(actual).toEqual(EXPECTED_STATUS_KINDS);
  });

  it('gives non-workflow options a null kind, on every set and every row', async () => {
    const nonWorkflowSetKeys = ['priority', 'kind', 'estimate', 'severity', 'environment'];
    for (const key of nonWorkflowSetKeys) {
      const [set] = await db.select().from(optionSets).where(eq(optionSets.key, key));
      const rows = await db.select().from(options).where(eq(options.optionSetId, set!.id));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((o) => o.kind === null)).toBe(true);
    }
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

  it('resolves every type\'s allowlist ids back to the exact option values softwareScheme declares', async () => {
    const statusId = seeded.fieldIdByKey.get('status')!;
    const placements = await db
      .select()
      .from(itemTypeFields)
      .where(eq(itemTypeFields.fieldId, statusId));

    const allOptionIds = placements.flatMap(
      (p) => (p.configOverride as { allowedOptionIds?: number[] } | null)?.allowedOptionIds ?? [],
    );
    const optionRows = await db.select().from(options).where(inArray(options.id, allOptionIds));
    const valueById = new Map(optionRows.map((o) => [o.id, o.value]));

    const typeIdToKey = new Map([...seeded.typeIdByKey.entries()].map(([k, v]) => [v, k]));

    for (const type of softwareScheme.types) {
      const statusPlacement = type.placements.find((p) => p.fieldKey === 'status')!;
      const expectedValues = [...statusPlacement.allowedOptionValues!].sort();

      const typeId = seeded.typeIdByKey.get(type.key)!;
      const placement = placements.find((p) => p.itemTypeId === typeId)!;
      const override = placement.configOverride as { allowedOptionIds: number[] };
      const actualValues = override.allowedOptionIds
        .map((id) => {
          const value = valueById.get(id);
          expect(value, `option id ${id} on type ${typeIdToKey.get(typeId)} must resolve to a real option`).toBeDefined();
          return value!;
        })
        .sort();

      expect(actualValues).toEqual(expectedValues);
    }
  });

  it('writes the workflow graph into option_transitions', async () => {
    const rows = await db.select().from(optionTransitions);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((t) => t.fromOptionId === null)).toBe(true); // a valid start
  });
});
