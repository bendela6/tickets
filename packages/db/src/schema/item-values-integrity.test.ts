// packages/db/src/schema/item-values-integrity.test.ts
// These constraints must be enforced by POSTGRES, not by the app. Each case
// asserts the database itself rejects the write.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createDbClient, type Db } from '../client';
import { fields } from './fields';
import { itemTypes } from './item-types';
import { items } from './items';
import { itemValues } from './item-values';
import { optionSets } from './option-sets';
import { options } from './options';
import { projects } from './projects';
import { schemes } from './schemes';
import { users } from './users';

// Unique key per run — sibling to how verify-scheme.ts avoids collisions —
// so a stray failed run never blocks the next one on schemes_key_unique /
// users_name_unique, even without the afterAll cleanup below.
const RUN_ID = Date.now();

describe('item_values integrity (runs against tickets_test — see test/setup-env.ts)', () => {
  let db: Db;
  let sql: ReturnType<typeof createDbClient>['sql'];
  let itemId = 0;
  let textFieldId = 0;
  let optionFieldId = 0;
  let optionA = 0;
  let optionB = 0;
  let userId = 0;
  let schemeId = 0;
  let scheme2Id = 0;
  let projectId = 0;
  let typeId = 0;
  let optionSetId = 0;

  beforeAll(async () => {
    ({ db, sql } = createDbClient({ max: 1 }));

    const [user] = await db.insert(users).values({ name: `iv-test-${RUN_ID}`, kind: 'agent' }).returning();
    userId = user!.id;
    const [scheme] = await db.insert(schemes).values({ key: `iv-test-${RUN_ID}`, name: 'iv' }).returning();
    schemeId = scheme!.id;
    const [type] = await db
      .insert(itemTypes)
      .values({ schemeId: scheme!.id, key: 'task', label: 'Task', position: 0 })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ key: `IVT${RUN_ID}`, name: 'iv', itemPrefix: 'IVT', schemeId: scheme!.id })
      .returning();
    projectId = project!.id;
    typeId = type!.id;
    const [set] = await db
      .insert(optionSets)
      .values({ schemeId: scheme!.id, key: 'prio', name: 'Priority' })
      .returning();
    optionSetId = set!.id;
    const inserted = await db
      .insert(options)
      .values([
        { optionSetId: set!.id, value: 'high', label: 'High', position: 0 },
        { optionSetId: set!.id, value: 'low', label: 'Low', position: 1 },
      ])
      .returning();
    optionA = inserted[0]!.id;
    optionB = inserted[1]!.id;

    const [textField] = await db
      .insert(fields)
      .values({ schemeId: scheme!.id, key: 'title', label: 'Title', type: 'string' })
      .returning();
    textFieldId = textField!.id;
    const [optionField] = await db
      .insert(fields)
      .values({
        schemeId: scheme!.id, key: 'priority', label: 'Priority',
        type: 'option', optionSetId: set!.id,
      })
      .returning();
    optionFieldId = optionField!.id;

    const [item] = await db
      .insert(items)
      .values({ projectId: project!.id, typeId: type!.id, number: 1, createdBy: userId })
      .returning();
    itemId = item!.id;
  });

  afterAll(async () => {
    // Remove exactly what this file created, in FK-safe order (children
    // before the parents they reference), so the suite can be re-run against
    // the same database without a manual reset.
    await db.delete(itemValues).where(eq(itemValues.itemId, itemId));
    await db.delete(items).where(eq(items.id, itemId));
    await db.delete(fields).where(eq(fields.schemeId, schemeId));
    await db.delete(options).where(eq(options.optionSetId, optionSetId));
    await db.delete(optionSets).where(eq(optionSets.schemeId, schemeId));
    await db.delete(itemTypes).where(eq(itemTypes.id, typeId));
    await db.delete(projects).where(eq(projects.id, projectId));
    const schemeIds = [schemeId, scheme2Id].filter((id): id is number => id !== 0);
    await db.delete(schemes).where(inArray(schemes.id, schemeIds));
    await db.delete(users).where(eq(users.id, userId));
    await sql.end();
  });

  // drizzle-orm's postgres-js driver wraps every failed query in a
  // DrizzleQueryError whose own `.message` is just "Failed query: ...— the
  // constraint name never appears there. The real node-postgres error
  // (message, code, constraint_name) is preserved on `.cause`. Assert
  // against the cause so each case proves *which* Postgres constraint
  // fired, not merely that the insert failed for some reason.
  const rejectsWithConstraint = (promise: Promise<unknown>, pattern: RegExp) =>
    expect(promise).rejects.toMatchObject({
      cause: { message: expect.stringMatching(pattern) },
    });

  it('rejects a row with NO value column populated', async () => {
    await rejectsWithConstraint(
      db.insert(itemValues).values({ itemId, fieldId: textFieldId }),
      /iv_one_value/,
    );
  });

  it('rejects a row with TWO value columns populated', async () => {
    await rejectsWithConstraint(
      db.insert(itemValues).values({ itemId, fieldId: textFieldId, valueText: 'x', valueBool: true }),
      /iv_one_value/,
    );
  });

  it('rejects a duplicate scalar value for one (item, field)', async () => {
    await db.insert(itemValues).values({ itemId, fieldId: textFieldId, valueText: 'first' });
    await rejectsWithConstraint(
      db.insert(itemValues).values({ itemId, fieldId: textFieldId, valueText: 'second' }),
      /iv_scalar/,
    );
  });

  it('rejects the same option twice on one (item, field)', async () => {
    await db.insert(itemValues).values({ itemId, fieldId: optionFieldId, optionId: optionA });
    await rejectsWithConstraint(
      db.insert(itemValues).values({ itemId, fieldId: optionFieldId, optionId: optionA }),
      /iv_option/,
    );
  });

  it('ALLOWS two different options on one (item, field) — multi-select', async () => {
    await expect(
      db.insert(itemValues).values({ itemId, fieldId: optionFieldId, optionId: optionB }),
    ).resolves.toBeDefined();
  });

  it('rejects an option field with no option set', async () => {
    const [scheme] = await db.insert(schemes).values({ key: `iv-test-2-${RUN_ID}`, name: 'iv2' }).returning();
    scheme2Id = scheme!.id;
    await rejectsWithConstraint(
      db.insert(fields).values({ schemeId: scheme!.id, key: 'bad', label: 'Bad', type: 'option' }),
      /fields_option_set_required/,
    );
  });
});
