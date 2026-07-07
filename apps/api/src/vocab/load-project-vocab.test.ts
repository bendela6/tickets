import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { environment, fields, projects, schemes, ticketTypes } from '@tickets/db';
import { loadProjectVocab } from './load-project-vocab';

// Real-DB test (scratch database on the same dev postgres, torn down after),
// mirroring the pattern in apps/api/src/schemes/clone-scheme.test.ts and
// apps/api/src/vocab/create-field.test.ts.
//
// Covers the archived-awareness gap from the Plan B review: fieldKeys (the
// *logical* key list consulted by validate-view-config) must drop a key once
// every row backing it is archived, even though fieldByTypeKey/fieldsByType/
// fieldById (consulted when rendering already-stored values) keep the
// archived row around.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_load_project_vocab_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;

let projectKey: string;
let taskTypeId: number;
let bugTypeId: number;
let bugSeverityFieldId: number;
let bugPriorityFieldId: number;

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

  const [scheme] = await db.insert(schemes).values({ key: 'lpv-scheme', name: 'LPV Scheme' }).returning();
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

  // "priority" is a shared key: both task and bug own their own row.
  await db.insert(fields).values({
    ticketTypeId: taskTypeId,
    key: 'priority',
    label: 'Priority',
    type: 'select',
    position: 0,
  });
  const [bugPriority] = await db
    .insert(fields)
    .values({
      ticketTypeId: bugTypeId,
      key: 'priority',
      label: 'Priority',
      type: 'select',
      position: 0,
    })
    .returning();
  bugPriorityFieldId = bugPriority!.id;

  // "severity" exists only on bug — archiving its only row should remove the
  // key entirely from fieldKeys.
  const [bugSeverity] = await db
    .insert(fields)
    .values({
      ticketTypeId: bugTypeId,
      key: 'severity',
      label: 'Severity',
      type: 'select',
      position: 1,
    })
    .returning();
  bugSeverityFieldId = bugSeverity!.id;

  const [project] = await db
    .insert(projects)
    .values({ key: 'lpv', name: 'LPV Project', ticketPrefix: 'LPV', schemeId: scheme!.id })
    .returning();
  projectKey = project!.key;
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

test('fieldKeys includes every key backed by at least one non-archived row', async () => {
  const vocab = await loadProjectVocab(db, { key: projectKey });
  const keys = vocab.fieldKeys.map((f) => f.key).sort();
  expect(keys).toEqual(['priority', 'severity']);
});

test('archiving a key\'s only row drops it from fieldKeys but keeps it in the type-scoped maps', async () => {
  await db.update(fields).set({ archivedAt: sql`now()` }).where(eq(fields.id, bugSeverityFieldId));

  const vocab = await loadProjectVocab(db, { key: projectKey });
  const keys = vocab.fieldKeys.map((f) => f.key);

  // gone from the logical key list a view config's fieldKey is checked against
  expect(keys).not.toContain('severity');
  // "priority" is untouched — bug's row for it is still live
  expect(keys).toContain('priority');

  // but still resolvable per-type, for rendering values already stored
  // against the now-archived field
  const byTypeKey = vocab.fieldByTypeKey.get(`${bugTypeId}:severity`);
  expect(byTypeKey).toBeTruthy();
  expect(byTypeKey?.archivedAt).not.toBeNull();

  const byId = vocab.fieldById.get(bugSeverityFieldId);
  expect(byId).toBeTruthy();

  const inFieldsByType = (vocab.fieldsByType.get(bugTypeId) ?? []).some(
    (f) => f.id === bugSeverityFieldId,
  );
  expect(inFieldsByType).toBe(true);
});

test('a shared key survives in fieldKeys as long as any owning type still has a live row', async () => {
  // archive bug's "priority" row too — task's row for the same key is still live
  await db.update(fields).set({ archivedAt: sql`now()` }).where(eq(fields.id, bugPriorityFieldId));

  const vocab = await loadProjectVocab(db, { key: projectKey });
  const keys = vocab.fieldKeys.map((f) => f.key);
  expect(keys).toContain('priority');

  const taskPriority = vocab.fieldByTypeKey.get(`${taskTypeId}:priority`);
  expect(taskPriority?.archivedAt).toBeNull();
});
