import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { environment, linkTypeTargetTypes, linkTypes, schemes, ticketTypes } from '@tickets/db';
import { HttpError } from '../errors';
import { createLinkTypeForType, resolveTargetTypeIds } from './create-link-type';

// Real-DB test (scratch database on the same dev postgres, torn down after),
// mirroring the pattern in apps/api/src/schemes/clone-scheme.test.ts.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_create_link_type_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;

// scheme A: task/bug/epic — the scheme under test
let schemeAId: number;
let taskTypeId: number;
let bugTypeId: number;
let epicTypeId: number;

// scheme B: a second, unrelated scheme whose "task" type shares a key with
// scheme A's task type but must NOT be resolvable as a target from scheme A.
let otherSchemeTaskTypeId: number;

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  scratchSql = postgres(scratchUrl, { max: 1 });
  db = drizzle(scratchSql) as unknown as Db;
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, '../../../../packages/db/drizzle'),
  });

  const [schemeA] = await db.insert(schemes).values({ key: 'scheme-a', name: 'Scheme A' }).returning();
  schemeAId = schemeA!.id;
  const [taskType] = await db
    .insert(ticketTypes)
    .values({ schemeId: schemeAId, key: 'task', label: 'Task', position: 0 })
    .returning();
  const [bugType] = await db
    .insert(ticketTypes)
    .values({ schemeId: schemeAId, key: 'bug', label: 'Bug', position: 1 })
    .returning();
  const [epicType] = await db
    .insert(ticketTypes)
    .values({ schemeId: schemeAId, key: 'epic', label: 'Epic', position: 2 })
    .returning();
  taskTypeId = taskType!.id;
  bugTypeId = bugType!.id;
  epicTypeId = epicType!.id;

  const [schemeB] = await db.insert(schemes).values({ key: 'scheme-b', name: 'Scheme B' }).returning();
  const [otherTask] = await db
    .insert(ticketTypes)
    .values({ schemeId: schemeB!.id, key: 'task', label: 'Task (scheme B)', position: 0 })
    .returning();
  otherSchemeTaskTypeId = otherTask!.id;
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

test('resolveTargetTypeIds maps keys to ids within the owning type\'s scheme', async () => {
  const ids = await resolveTargetTypeIds(db, taskTypeId, ['bug', 'epic']);
  expect(new Set(ids)).toEqual(new Set([bugTypeId, epicTypeId]));
});

test('resolveTargetTypeIds rejects a key that only exists in a different scheme', async () => {
  // "task" is a valid key in scheme B, but the owning type here is scheme A's
  // task — scheme B's rows must not leak into scope.
  await expect(resolveTargetTypeIds(db, bugTypeId, ['task'])).resolves.toEqual([taskTypeId]);
  await expect(
    resolveTargetTypeIds(db, otherSchemeTaskTypeId, ['bug']),
  ).rejects.toThrow(HttpError);
});

test('resolveTargetTypeIds rejects an unknown target key', async () => {
  await expect(resolveTargetTypeIds(db, taskTypeId, ['not-a-real-key'])).rejects.toThrow(HttpError);
});

test('resolveTargetTypeIds rejects an unknown owning type id', async () => {
  await expect(resolveTargetTypeIds(db, 999_999, ['bug'])).rejects.toThrow(HttpError);
});

test('creates a link type owned by the type with link_type_target_types rows', async () => {
  const created = await createLinkTypeForType(db, taskTypeId, {
    key: 'blocks',
    label: 'Blocks',
    inverseLabel: 'Blocked by',
    directional: true,
    targetTypeKeys: ['bug', 'epic'],
  });

  expect(created.ticketTypeId).toBe(taskTypeId);
  expect(created.position).toBe(0);

  const targetRows = await db
    .select()
    .from(linkTypeTargetTypes)
    .where(eq(linkTypeTargetTypes.linkTypeId, created.id));
  expect(new Set(targetRows.map((r) => r.targetTypeId))).toEqual(new Set([bugTypeId, epicTypeId]));
});

test('places a second link type for the same type at the next position', async () => {
  const relatesTo = await createLinkTypeForType(db, taskTypeId, {
    key: 'relates-to',
    label: 'Relates to',
    inverseLabel: 'Relates to',
    directional: false,
    targetTypeKeys: [],
  });
  expect(relatesTo.position).toBe(1); // "blocks" already took position 0

  const taskLinks = await db.select().from(linkTypes).where(eq(linkTypes.ticketTypeId, taskTypeId));
  expect(taskLinks.map((l) => l.key).sort()).toEqual(['blocks', 'relates-to']);

  const targetRows = await db
    .select()
    .from(linkTypeTargetTypes)
    .where(eq(linkTypeTargetTypes.linkTypeId, relatesTo.id));
  expect(targetRows).toEqual([]);
});

test('rolls back the whole transaction when a target key is unknown', async () => {
  await expect(
    createLinkTypeForType(db, bugTypeId, {
      key: 'duplicates',
      label: 'Duplicates',
      inverseLabel: 'Duplicated by',
      directional: true,
      targetTypeKeys: ['task', 'not-a-real-key'],
    }),
  ).rejects.toThrow(HttpError);

  const bugLinks = await db.select().from(linkTypes).where(eq(linkTypes.ticketTypeId, bugTypeId));
  expect(bugLinks.find((l) => l.key === 'duplicates')).toBeUndefined();
});

test('rejects creating a link type against an unknown owning type', async () => {
  await expect(
    createLinkTypeForType(db, 999_999, {
      key: 'whatever',
      label: 'Whatever',
      inverseLabel: 'Whatever',
      directional: false,
      targetTypeKeys: [],
    }),
  ).rejects.toThrow(HttpError);
});

