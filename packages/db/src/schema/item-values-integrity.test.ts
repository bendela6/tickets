// packages/db/src/schema/item-values-integrity.test.ts
// These constraints must be enforced by POSTGRES, not by the app. Each case
// asserts the database itself rejects the write.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('item_values integrity (requires POSTGRES_DATABASE=tickets_dev)', () => {
  let db: Db;
  let sql: ReturnType<typeof createDbClient>['sql'];
  let itemId = 0;
  let textFieldId = 0;
  let optionFieldId = 0;
  let optionA = 0;
  let optionB = 0;
  let userId = 0;

  beforeAll(async () => {
    ({ db, sql } = createDbClient({ max: 1 }));

    const [user] = await db.insert(users).values({ name: 'iv-test', kind: 'agent' }).returning();
    userId = user!.id;
    const [scheme] = await db.insert(schemes).values({ key: 'iv-test', name: 'iv' }).returning();
    const [type] = await db
      .insert(itemTypes)
      .values({ schemeId: scheme!.id, key: 'task', label: 'Task', position: 0 })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ key: 'IVT', name: 'iv', itemPrefix: 'IVT', schemeId: scheme!.id })
      .returning();
    const [set] = await db
      .insert(optionSets)
      .values({ schemeId: scheme!.id, key: 'prio', name: 'Priority' })
      .returning();
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
    const [scheme] = await db.insert(schemes).values({ key: 'iv-test-2', name: 'iv2' }).returning();
    await rejectsWithConstraint(
      db.insert(fields).values({ schemeId: scheme!.id, key: 'bad', label: 'Bad', type: 'option' }),
      /fields_option_set_required/,
    );
  });
});
