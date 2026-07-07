import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import {
  environment,
  fieldOptions,
  fields,
  linkTypeTargetTypes,
  linkTypes,
  schemes,
  ticketTypes,
} from '@tickets/db';
import { cloneScheme, remapClonedRows } from './clone-scheme';

test('remaps a foreign key column via the id map', () => {
  const idMap = new Map([
    [10, 100],
    [11, 101],
  ]);
  const rows = [
    { id: 10, ticketTypeId: 10, key: 'a' },
    { id: 11, ticketTypeId: 11, key: 'b' },
  ];
  const out = remapClonedRows(rows, 'ticketTypeId', idMap);
  expect(out).toEqual([
    { ticketTypeId: 100, key: 'a' },
    { ticketTypeId: 101, key: 'b' },
  ]);
});

// Real-DB test: spins up a scratch database on the same dev postgres
// (host/port/user/password from `environment`, database name generated per
// run), runs the real drizzle migrations against it, hand-inserts a small
// source scheme with per-type fields/links (mirroring the shape seedScheme
// now writes: fields/linkTypes owned by ticketTypeId, not schemeId), clones
// it, then asserts on the resulting rows. Torn down in afterAll regardless
// of pass/fail. Mirrors the scratch-db-per-run pattern from
// packages/db/src/seed/seed-scheme.test.ts (seedScheme/SOFTWARE_SCHEME
// aren't part of @tickets/db's public exports, so fixtures are built
// directly here instead of reusing that seed helper).
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_clone_scheme_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;

// ids on the SOURCE scheme, set up once in beforeAll
let srcSchemeId: number;
let srcFieldCount: number;
let srcLinkCount: number;

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  scratchSql = postgres(scratchUrl, { max: 1 });
  db = drizzle(scratchSql) as unknown as Db;
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../../../packages/db/drizzle') });

  const [scheme] = await db.insert(schemes).values({ key: 'src-scheme', name: 'Source Scheme' }).returning();
  srcSchemeId = scheme!.id;

  const [taskType] = await db
    .insert(ticketTypes)
    .values({ schemeId: srcSchemeId, key: 'task', label: 'Task', position: 0 })
    .returning();
  const [bugType] = await db
    .insert(ticketTypes)
    .values({ schemeId: srcSchemeId, key: 'bug', label: 'Bug', position: 1 })
    .returning();

  // per-type fields: task gets 2, bug gets 1 — total 3
  const [taskPriority] = await db
    .insert(fields)
    .values({
      ticketTypeId: taskType!.id,
      key: 'priority',
      label: 'Priority',
      type: 'select',
      required: true,
      position: 0,
    })
    .returning();
  await db.insert(fields).values({
    ticketTypeId: taskType!.id,
    key: 'estimate',
    label: 'Estimate',
    type: 'text',
    required: false,
    position: 1,
  });
  await db.insert(fields).values({
    ticketTypeId: bugType!.id,
    key: 'priority',
    label: 'Priority',
    type: 'select',
    required: true,
    position: 0,
  });
  srcFieldCount = 3;

  await db.insert(fieldOptions).values([
    { fieldId: taskPriority!.id, value: 'high', label: 'High', position: 0 },
    { fieldId: taskPriority!.id, value: 'low', label: 'Low', position: 1 },
  ]);

  // per-type link types: task owns "blocks" targeting both types
  const [blocks] = await db
    .insert(linkTypes)
    .values({
      ticketTypeId: taskType!.id,
      key: 'blocks',
      label: 'Blocks',
      inverseLabel: 'Blocked by',
      directional: true,
      position: 0,
    })
    .returning();
  srcLinkCount = 1;

  await db.insert(linkTypeTargetTypes).values([
    { linkTypeId: blocks!.id, targetTypeId: taskType!.id },
    { linkTypeId: blocks!.id, targetTypeId: bugType!.id },
  ]);
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

test('clones per-type fields with ticketTypeId remapped to the cloned types', async () => {
  const { schemeId: dstId } = await cloneScheme(db, srcSchemeId, { key: 'dst-scheme', name: 'Dst Scheme' });

  const clonedTypes = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, dstId));
  expect(clonedTypes.length).toBe(2);

  const clonedFields = await db
    .select()
    .from(fields)
    .where(inArray(fields.ticketTypeId, clonedTypes.map((t) => t.id)));
  expect(clonedFields.length).toBe(srcFieldCount); // same per-type field count

  // every cloned field points at a cloned type
  const clonedTypeIds = new Set(clonedTypes.map((t) => t.id));
  expect(clonedFields.every((f) => clonedTypeIds.has(f.ticketTypeId!))).toBe(true);

  // required/position carried over: the cloned task type's "priority" field is required, position 0
  const clonedTask = clonedTypes.find((t) => t.key === 'task')!;
  const clonedTaskPriority = clonedFields.find((f) => f.ticketTypeId === clonedTask.id && f.key === 'priority')!;
  expect(clonedTaskPriority.required).toBe(true);
  expect(clonedTaskPriority.position).toBe(0);
  const clonedTaskEstimate = clonedFields.find((f) => f.ticketTypeId === clonedTask.id && f.key === 'estimate')!;
  expect(clonedTaskEstimate.required).toBe(false);
  expect(clonedTaskEstimate.position).toBe(1);

  // options cloned and remapped to the cloned field
  const clonedOptions = await db.select().from(fieldOptions).where(eq(fieldOptions.fieldId, clonedTaskPriority.id));
  expect(clonedOptions.map((o) => o.value).sort()).toEqual(['high', 'low']);
});

test('clones per-type link types and remaps both target-type FKs', async () => {
  const { schemeId: dstId } = await cloneScheme(db, srcSchemeId, { key: 'dst-scheme-2', name: 'Dst Scheme 2' });

  const clonedTypes = await db.select().from(ticketTypes).where(eq(ticketTypes.schemeId, dstId));
  const clonedTypeIds = new Set(clonedTypes.map((t) => t.id));
  const clonedTask = clonedTypes.find((t) => t.key === 'task')!;

  const clonedLinks = await db
    .select()
    .from(linkTypes)
    .where(inArray(linkTypes.ticketTypeId, clonedTypes.map((t) => t.id)));
  expect(clonedLinks.length).toBe(srcLinkCount);
  expect(clonedLinks.every((l) => clonedTypeIds.has(l.ticketTypeId!))).toBe(true);

  const clonedBlocks = clonedLinks.find((l) => l.key === 'blocks')!;
  expect(clonedBlocks.ticketTypeId).toBe(clonedTask.id);

  const clonedTargets = await db
    .select()
    .from(linkTypeTargetTypes)
    .where(eq(linkTypeTargetTypes.linkTypeId, clonedBlocks.id));
  expect(clonedTargets.length).toBe(2);
  // both target rows point at cloned types (source scheme's types), not the originals
  expect(clonedTargets.every((r) => clonedTypeIds.has(r.targetTypeId))).toBe(true);
  expect(new Set(clonedTargets.map((r) => r.targetTypeId))).toEqual(clonedTypeIds);
});
