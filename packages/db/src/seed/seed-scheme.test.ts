import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Db } from '../client';
import { environment } from '../environment';
import * as schema from '../schema';
import { fieldOptions, fields, linkTypeTargetTypes, linkTypes, ticketTypeFields, ticketTypes } from '../schema';
import { seedScheme } from './seed-scheme';
import { SOFTWARE_SCHEME } from './software-scheme';

// Real-DB test: spins up a scratch database on the same dev postgres
// (host/port/user/password from `environment`, database name generated per
// run), runs the real drizzle migrations against it, seeds SOFTWARE_SCHEME,
// then asserts on the resulting rows. Torn down in afterAll regardless of
// pass/fail. No existing DB-backed vitest harness exists in this repo to
// copy (`build-transitions.test.ts` is a pure unit test), so this harness
// mirrors the scratch-db-per-run pattern used by the plan's manual
// verification scripts (create db -> migrate -> seed -> assert -> drop).
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_seed_scheme_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  scratchSql = postgres(scratchUrl, { max: 1 });
  db = drizzle(scratchSql, { schema }) as Db;
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../drizzle') });

  await seedScheme(db, SOFTWARE_SCHEME);
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

test('every type owns a distinct priority field row', async () => {
  const prio = await db.select().from(fields).where(eq(fields.key, 'priority'));
  expect(prio.length).toBe(5); // one per type
  expect(new Set(prio.map((f) => f.ticketTypeId)).size).toBe(5);
});

test('options are duplicated per type-field', async () => {
  const prio = await db.select().from(fields).where(eq(fields.key, 'priority'));
  for (const f of prio) {
    const opts = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, f.id));
    expect(opts.map((o) => o.value)).toEqual(['urgent', 'high', 'medium', 'low', 'trivial']);
  }
});

test('no ticket_type_fields rows are written', async () => {
  expect((await db.select().from(ticketTypeFields)).length).toBe(0);
});

test('link types are owned per type with targets present', async () => {
  const taskType = (await db.select().from(ticketTypes).where(eq(ticketTypes.key, 'task')))[0]!;
  const taskLinks = await db.select().from(linkTypes).where(eq(linkTypes.ticketTypeId, taskType.id));
  expect(taskLinks.map((l) => l.key).sort()).toEqual(['blocks', 'caused-by', 'duplicates', 'relates-to']);
  const blocks = taskLinks.find((l) => l.key === 'blocks')!;
  const targets = await db.select().from(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, blocks.id));
  expect(targets.length).toBe(5); // default: all types
});
