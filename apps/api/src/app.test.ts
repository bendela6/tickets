import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { and, eq } from 'drizzle-orm';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import {
  ensureSoftwareScheme,
  ensureUser,
  environment,
  fields,
  linkTypeTargetTypes,
  linkTypes,
  seedProject,
  ticketValues,
} from '@tickets/db';
import { buildApp } from './app';

// Real end-to-end test: builds the actual Fastify app (buildApp) against a
// scratch Postgres database — same scratch-db-per-run pattern as
// apps/api/src/schemes/clone-scheme.test.ts (and the vocab/create-*.test.ts
// files) — seeds it with the real seed helpers (ensureSoftwareScheme +
// seedProject, exactly what `pnpm db:seed` runs), then drives the app with
// `app.inject()` instead of unit-testing the route handlers directly. This is
// the one place that exercises the write → read → link path through the
// actual HTTP layer end to end.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_app_inject_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;

let actorId: number;
let typeIdByKey: Record<string, number>;

const projectKey = 'itg';

type TicketJson = { id: number; number: number; typeId: number };
type BoardJson = {
  fields: { id: number; key: string }[];
  tickets: { id: number; values: Record<string, unknown> }[];
};

async function createTicket(
  typeKey: string,
  values: Record<string, unknown>,
  parentId?: number,
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectKey}/tickets`,
    payload: { actorId, typeKey, parentId, values },
  });
  if (response.statusCode !== 201) {
    throw new Error(`ticket create failed (${response.statusCode}): ${response.body}`);
  }
  return response.json() as TicketJson;
}

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  scratchSql = postgres(scratchUrl, { max: 1 });
  db = drizzle(scratchSql) as unknown as Db;
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, '../../../packages/db/drizzle'),
  });

  const seeded = await ensureSoftwareScheme(db);
  typeIdByKey = seeded.typeIdByKey;
  await seedProject(db, {
    key: projectKey,
    name: 'Integration',
    ticketPrefix: 'ITG',
    schemeId: seeded.schemeId,
  });
  actorId = await ensureUser(db, { name: 'integration-test-actor', kind: 'human' });

  app = buildApp({ db });
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('write path: one ticket per type', () => {
  test('creates an epic/task/bug/subtask/spike, each 201', async () => {
    for (const typeKey of ['epic', 'task', 'bug', 'subtask', 'spike']) {
      const response = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectKey}/tickets`,
        payload: { actorId, typeKey, values: { title: `${typeKey} ticket` } },
      });
      expect(response.statusCode, `${typeKey}: ${response.body}`).toBe(201);
      const body = response.json() as TicketJson;
      expect(body.typeId).toBe(typeIdByKey[typeKey]);
    }
  });
});

describe('per-type field resolution', () => {
  test('priority + assignee set on a Task resolve to the Task-owned field rows, not Epic\'s', async () => {
    const ticket = await createTicket('task', {
      title: 'Task with priority',
      priority: 'high',
      assignee: 'claude-sonnet-5',
    });

    const taskTypeId = typeIdByKey.task!;
    const epicTypeId = typeIdByKey.epic!;

    const [taskPriorityField] = await db
      .select()
      .from(fields)
      .where(and(eq(fields.ticketTypeId, taskTypeId), eq(fields.key, 'priority')));
    const [taskAssigneeField] = await db
      .select()
      .from(fields)
      .where(and(eq(fields.ticketTypeId, taskTypeId), eq(fields.key, 'assignee')));
    const [epicPriorityField] = await db
      .select()
      .from(fields)
      .where(and(eq(fields.ticketTypeId, epicTypeId), eq(fields.key, 'priority')));

    expect(taskPriorityField).toBeTruthy();
    expect(taskAssigneeField).toBeTruthy();
    expect(epicPriorityField).toBeTruthy();
    // Task and Epic each materialize their own copy of the "priority" field —
    // distinct rows, distinct ids.
    expect(taskPriorityField!.id).not.toBe(epicPriorityField!.id);

    const valueRows = await db.select().from(ticketValues).where(eq(ticketValues.ticketId, ticket.id));
    const priorityValue = valueRows.find((row) => row.fieldId === taskPriorityField!.id);
    const assigneeValue = valueRows.find((row) => row.fieldId === taskAssigneeField!.id);

    expect(priorityValue, JSON.stringify(valueRows)).toBeTruthy();
    expect(assigneeValue, JSON.stringify(valueRows)).toBeTruthy();
    // and no value row was written against Epic's (different) priority field id
    expect(valueRows.every((row) => row.fieldId !== epicPriorityField!.id)).toBe(true);
  });
});

describe('link guardrails', () => {
  test('allowed target 201s, disallowed target 422s, un-owned key 400s', async () => {
    const taskId = (await createTicket('task', { title: 'Link source task' })).id;
    const subtaskId = (await createTicket('subtask', { title: 'Link target subtask' })).id;
    const epicId = (await createTicket('epic', { title: 'Link target epic' })).id;
    const bugId = (await createTicket('bug', { title: 'Link target bug' })).id;

    // task owns "blocks" by default, targeting every type — subtask is an
    // allowed target.
    const okResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { actorId, linkTypeKey: 'blocks', sourceTicketId: taskId, targetTicketId: subtaskId },
    });
    expect(okResponse.statusCode, okResponse.body).toBe(201);

    // Narrow task's "blocks" link type so epic is no longer an allowed
    // target, then attempt to link a task to an epic via "blocks".
    const [tasksBlocks] = await db
      .select()
      .from(linkTypes)
      .where(and(eq(linkTypes.ticketTypeId, typeIdByKey.task!), eq(linkTypes.key, 'blocks')));
    expect(tasksBlocks).toBeTruthy();
    await db
      .delete(linkTypeTargetTypes)
      .where(
        and(
          eq(linkTypeTargetTypes.linkTypeId, tasksBlocks!.id),
          eq(linkTypeTargetTypes.targetTypeId, typeIdByKey.epic!),
        ),
      );

    const disallowedTargetResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { actorId, linkTypeKey: 'blocks', sourceTicketId: taskId, targetTicketId: epicId },
    });
    expect(disallowedTargetResponse.statusCode, disallowedTargetResponse.body).toBe(422);

    // Task stops owning "duplicates" entirely (bug still owns it) — creating
    // a link with that key from a task source is now an un-owned key, not a
    // disallowed target.
    const [tasksDuplicates] = await db
      .select()
      .from(linkTypes)
      .where(and(eq(linkTypes.ticketTypeId, typeIdByKey.task!), eq(linkTypes.key, 'duplicates')));
    expect(tasksDuplicates).toBeTruthy();
    await db.delete(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, tasksDuplicates!.id));
    await db.delete(linkTypes).where(eq(linkTypes.id, tasksDuplicates!.id));

    const notOwnedResponse = await app.inject({
      method: 'POST',
      url: '/api/links',
      payload: { actorId, linkTypeKey: 'duplicates', sourceTicketId: taskId, targetTicketId: bugId },
    });
    expect(notOwnedResponse.statusCode, notOwnedResponse.body).toBe(400);
  });
});

describe('board read', () => {
  test('GET board 200s with one logical priority field and fieldKey-keyed ticket values', async () => {
    await createTicket('task', {
      title: 'Board task',
      priority: 'urgent',
      assignee: 'claude-opus-4-8',
    });

    const response = await app.inject({ method: 'GET', url: `/api/projects/${projectKey}/board` });
    expect(response.statusCode, response.body).toBe(200);
    const board = response.json() as BoardJson;

    const priorityFields = board.fields.filter((field) => field.key === 'priority');
    expect(priorityFields.length).toBe(1);

    const boardTicket = board.tickets.find((ticket) => ticket.values.title === 'Board task');
    expect(boardTicket).toBeTruthy();
    expect(boardTicket!.values.priority).toBe('urgent');
    expect(boardTicket!.values.assignee).toBe('claude-opus-4-8');
  });
});
