import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { environment, fields, schemes, ticketTypes } from '@tickets/db';
import { createFieldForType } from './create-field';

// Real-DB test (scratch database on the same dev postgres, torn down after),
// mirroring the pattern in apps/api/src/schemes/clone-scheme.test.ts.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_create_field_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;

let taskTypeId: number;
let bugTypeId: number;

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

  const [scheme] = await db.insert(schemes).values({ key: 'scheme-a', name: 'Scheme A' }).returning();
  const [taskType] = await db
    .insert(ticketTypes)
    .values({ schemeId: scheme!.id, key: 'task', label: 'Task', position: 0 })
    .returning();
  const [bugType] = await db
    .insert(ticketTypes)
    .values({ schemeId: scheme!.id, key: 'bug', label: 'Bug', position: 1 })
    .returning();
  taskTypeId = taskType!.id;
  bugTypeId = bugType!.id;
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

test('creates a field owned by the type at position 0 when the type has no fields yet', async () => {
  const created = await createFieldForType(db, taskTypeId, {
    key: 'priority',
    label: 'Priority',
    type: 'select',
  });

  expect(created.ticketTypeId).toBe(taskTypeId);
  expect(created.position).toBe(0);
  expect(created.required).toBe(false);
  expect(created.config).toEqual({});

  const rows = await db.select().from(fields).where(eq(fields.id, created.id));
  expect(rows[0]?.ticketTypeId).toBe(taskTypeId);
});

test('places a second field for the same type at the next position, independent of other types', async () => {
  // an unrelated field on bug should not affect task's position counter
  await createFieldForType(db, bugTypeId, { key: 'severity', label: 'Severity', type: 'select' });

  const first = await createFieldForType(db, taskTypeId, {
    key: 'estimate',
    label: 'Estimate',
    type: 'number',
  });
  const second = await createFieldForType(db, taskTypeId, {
    key: 'due',
    label: 'Due date',
    type: 'date',
    required: true,
    config: { foo: 'bar' },
  });

  expect(second.position).toBe((first.position ?? 0) + 1);
  expect(second.required).toBe(true);
  expect(second.config).toEqual({ foo: 'bar' });

  const taskFields = await db.select().from(fields).where(eq(fields.ticketTypeId, taskTypeId));
  expect(taskFields.map((f) => f.key).sort()).toEqual(['due', 'estimate', 'priority']);

  const bugFields = await db.select().from(fields).where(eq(fields.ticketTypeId, bugTypeId));
  expect(bugFields.map((f) => f.key)).toEqual(['severity']);
  expect(bugFields[0]?.position).toBe(0);
});

test('accepts the "status" field type (added to the picklist for status-as-a-field)', async () => {
  const created = await createFieldForType(db, bugTypeId, {
    key: 'workflow-status',
    label: 'Workflow status',
    type: 'status',
  });
  expect(created.type).toBe('status');
});
