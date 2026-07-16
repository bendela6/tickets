import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { environment } from '@tickets/db';
import type { StartSpec, Supervisor } from '../ai/supervisor';
import { buildApp } from '../app';

// Route-level integration test for the AI REST surface. Uses a scratch Postgres
// (same pattern as app.test.ts) but injects a FAKE supervisor, so it proves the
// workspaces/sessions wiring — path + runner validation, insert, stop — without
// spawning a real PTY. The real supervisor is covered by its own unit tests and
// the LocalRunner spawn test.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_ai_routes_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;

// Records what the routes ask of the supervisor; has() reports a session as live
// once started and not yet stopped.
const started: StartSpec[] = [];
const stopped: number[] = [];
const fakeSupervisor: Supervisor = {
  start: (spec) => {
    started.push(spec);
  },
  stop: (id) => {
    stopped.push(id);
  },
  attach: async () => {},
  detach: () => {},
  write: () => {},
  resize: () => {},
  has: (id) => started.some((s) => s.id === id) && !stopped.includes(id),
  flush: async () => {},
};

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

  app = buildApp({ db, supervisor: fakeSupervisor });
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('AI routes', () => {
  test('creates, lists, and archives workspaces', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-a', path: tmpdir() },
    });
    expect(created.statusCode).toBe(201);
    const ws = created.json();
    expect(ws).toMatchObject({ name: 'ws-a', path: tmpdir(), runner: 'local' });

    const list = await app.inject({ method: 'GET', url: '/api/ai/workspaces' });
    expect(list.json().map((w: { name: string }) => w.name)).toContain('ws-a');

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/ai/workspaces/${ws.id}`,
      payload: { archived: true },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().archivedAt).not.toBeNull();

    const after = await app.inject({ method: 'GET', url: '/api/ai/workspaces' });
    expect(after.json().map((w: { name: string }) => w.name)).not.toContain('ws-a');
  });

  test('creating a session validates path + runner, spawns, and is retrievable', async () => {
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-live', path: tmpdir() },
    });
    const workspaceId = wsRes.json().id;

    const before = started.length;
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'terminal', workspaceId, title: 'my shell' },
    });
    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session).toMatchObject({ kind: 'terminal', title: 'my shell', workspaceId });
    expect(started.length).toBe(before + 1);
    expect(started.at(-1)).toMatchObject({ id: session.id, cwd: tmpdir() });

    const got = await app.inject({ method: 'GET', url: `/api/ai/sessions/${session.id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().id).toBe(session.id);

    const listed = await app.inject({ method: 'GET', url: '/api/ai/sessions?kind=terminal' });
    expect(listed.json().map((s: { id: number }) => s.id)).toContain(session.id);
  });

  test('rejects a non-existent workspace path with 400 (no session created)', async () => {
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-badpath', path: resolve(tmpdir(), 'definitely-not-here-xyz') },
    });
    const workspaceId = wsRes.json().id;
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'terminal', workspaceId },
    });
    expect(res.statusCode).toBe(400);
  });

  test('rejects the container runner and non-terminal kinds until E2', async () => {
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-container', path: tmpdir(), runner: 'container' },
    });
    const containerWs = wsRes.json().id;
    const containerRes = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'terminal', workspaceId: containerWs },
    });
    expect(containerRes.statusCode).toBe(400);

    const localWs = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/workspaces',
        payload: { name: 'ws-forkind', path: tmpdir() },
      })
    ).json().id;
    const agentRes = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'agent', workspaceId: localWs },
    });
    expect(agentRes.statusCode).toBe(400);
  });

  test('DELETE stops a live session via the supervisor', async () => {
    const workspaceId = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/workspaces',
        payload: { name: 'ws-stop', path: tmpdir() },
      })
    ).json().id;
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/sessions',
        payload: { kind: 'terminal', workspaceId },
      })
    ).json();

    const res = await app.inject({ method: 'DELETE', url: `/api/ai/sessions/${session.id}` });
    expect(res.statusCode).toBe(200);
    expect(stopped).toContain(session.id);
  });

  test('404s for an unknown session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ai/sessions/999999' });
    expect(res.statusCode).toBe(404);
  });
});
