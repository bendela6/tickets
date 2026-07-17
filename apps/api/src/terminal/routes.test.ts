import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { Db } from '@tickets/db';
import { environment, terminalSessions, workdirs } from '@tickets/db';
import { buildApp } from '../app';
import { createTerminalDriver } from './driver';
import { createTerminalStore } from './store';
import type { StartSpec, TerminalDriver } from './driver';

// Route-level integration test for the terminal REST surface. Ported from
// apps/api/src/routes/ai.routes.test.ts, dropping every agent case: no kind
// discriminator, no agentId/providerKey/dispatch — a terminal session always
// carries a bare workdirId. Uses a scratch Postgres (same pattern as the rest
// of the api tests) but injects a FAKE driver for most cases, so it proves
// the sessions wiring — path + runner validation, insert, archive, stop —
// without spawning a real PTY. The workdir CRUD these tests lean on to make a
// workdir belongs to neither subsystem and is tested in workdir/routes.test.ts. The real driver (over a fake Runner) is
// exercised separately below to prove the spawn-failure -> `failed` path end
// to end through HTTP, and is covered unit-wise by driver.test.ts.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_terminal_routes_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;

// Records what the routes ask of the driver; has() reports a session as live
// once started and not yet stopped.
const started: StartSpec[] = [];
const stopped: number[] = [];
const fakeDriver: TerminalDriver = {
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
  interrupt: () => {},
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

  app = buildApp({ db, terminalDriver: fakeDriver });
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

// Creates a workdir + terminal session via the real routes (own workdir per
// call so tests don't collide). The fake driver marks it "live" (has(id) ===
// true) until stopped, matching a real just-started terminal session.
async function createTerminalSession() {
  const workdirId = (
    await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: `wd-term-${Date.now()}-${Math.random()}`, path: tmpdir() },
    })
  ).json().id;
  return (
    await app.inject({
      method: 'POST',
      url: '/api/terminal/sessions',
      payload: { workdirId },
    })
  ).json();
}

describe('terminal routes', () => {
  test('creates a terminal session against a workdir', async () => {
    const wd = await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: 'w', path: tmpdir() },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/terminal/sessions',
      payload: { workdirId: wd.json().id },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('starting');
    expect(res.json()).not.toHaveProperty('kind'); // no discriminator any more
  });

  test('creating a session validates path + runner, spawns, and is retrievable', async () => {
    const wdRes = await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: 'wd-live', path: tmpdir() },
    });
    const workdirId = wdRes.json().id;

    const before = started.length;
    const res = await app.inject({
      method: 'POST',
      url: '/api/terminal/sessions',
      payload: { workdirId, title: 'my shell' },
    });
    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session).toMatchObject({ title: 'my shell', workdirId });
    expect(started.length).toBe(before + 1);
    expect(started.at(-1)).toMatchObject({ id: session.id, cwd: tmpdir() });

    const got = await app.inject({ method: 'GET', url: `/api/terminal/sessions/${session.id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().id).toBe(session.id);

    const listed = await app.inject({ method: 'GET', url: '/api/terminal/sessions' });
    expect(listed.json().map((s: { id: number }) => s.id)).toContain(session.id);
  });

  test('rejects a non-existent workdir path with 400 (no session created)', async () => {
    const wdRes = await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: 'wd-badpath', path: resolve(tmpdir(), 'definitely-not-here-xyz') },
    });
    const workdirId = wdRes.json().id;
    const res = await app.inject({
      method: 'POST',
      url: '/api/terminal/sessions',
      payload: { workdirId },
    });
    expect(res.statusCode).toBe(400);
  });

  test('rejects the container runner', async () => {
    const wdRes = await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: 'wd-container', path: tmpdir(), runner: 'container' },
    });
    const containerWd = wdRes.json().id;
    const res = await app.inject({
      method: 'POST',
      url: '/api/terminal/sessions',
      payload: { workdirId: containerWd },
    });
    expect(res.statusCode).toBe(400);
  });

  test('404s for an unknown workdir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/terminal/sessions',
      payload: { workdirId: 999999 },
    });
    expect(res.statusCode).toBe(404);
  });

  test('404s for an unknown session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/terminal/sessions/999999' });
    expect(res.statusCode).toBe(404);
  });

  test('excludes archived sessions from the list unless ?archived=true', async () => {
    const live = await createTerminalSession();
    const arch = await createTerminalSession();
    await app.inject({ method: 'POST', url: `/api/terminal/sessions/${arch.id}/archive` });

    const def = await app.inject({ method: 'GET', url: '/api/terminal/sessions' });
    const ids = def.json().map((s: { id: number }) => s.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(arch.id);

    const all = await app.inject({ method: 'GET', url: '/api/terminal/sessions?archived=true' });
    expect(all.json().map((s: { id: number }) => s.id)).toContain(arch.id);
  });

  test('stopping a live session kills the PTY but leaves it in the list', async () => {
    // The distinction stop exists for: ending a session must not hide it.
    const s = await createTerminalSession();
    const res = await app.inject({ method: 'POST', url: `/api/terminal/sessions/${s.id}/stop` });
    expect(res.statusCode).toBe(200);
    expect(stopped).toContain(s.id);
    expect(res.json().archivedAt).toBeNull();

    const listed = await app.inject({ method: 'GET', url: '/api/terminal/sessions' });
    expect(listed.json().map((x: { id: number }) => x.id)).toContain(s.id);
  });

  test('stopping a session the driver does not own finalizes it to disconnected, unarchived', async () => {
    const [wd] = await db
      .insert(workdirs)
      .values({ name: `wd-stop-${Date.now()}-${Math.random()}`, path: tmpdir(), runner: 'local' })
      .returning({ id: workdirs.id });
    const [orphan] = await db
      .insert(terminalSessions)
      .values({ title: 'orphan to stop', workdirId: wd!.id, status: 'live', endedAt: null })
      .returning({ id: terminalSessions.id });

    const res = await app.inject({
      method: 'POST',
      url: `/api/terminal/sessions/${orphan!.id}/stop`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ status: 'disconnected' });
    expect(body.endedAt).not.toBeNull();
    expect(body.archivedAt).toBeNull();
  });

  test('404s when stopping an unknown session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/terminal/sessions/999999/stop' });
    expect(res.statusCode).toBe(404);
  });

  test('archiving a live session stops it via the driver first', async () => {
    const s = await createTerminalSession();
    const res = await app.inject({ method: 'POST', url: `/api/terminal/sessions/${s.id}/archive` });
    expect(res.statusCode).toBe(200);
    expect(stopped).toContain(s.id);
    expect(res.json().archivedAt).not.toBeNull();
  });

  test('archiving a session the driver does not own finalizes it to disconnected', async () => {
    // Inserted directly (not via createSession()), so the fake driver's
    // has() reports false — exercising the "not live" branch (as opposed to
    // the createTerminalSession() rows used elsewhere, which the fake driver
    // tracks as live until stopped).
    const [wd] = await db
      .insert(workdirs)
      .values({ name: `wd-orphan-${Date.now()}-${Math.random()}`, path: tmpdir(), runner: 'local' })
      .returning({ id: workdirs.id });
    const [orphan] = await db
      .insert(terminalSessions)
      .values({
        title: 'orphaned session',
        workdirId: wd!.id,
        status: 'live',
        endedAt: null,
      })
      .returning({ id: terminalSessions.id });

    const res = await app.inject({
      method: 'POST',
      url: `/api/terminal/sessions/${orphan!.id}/archive`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ status: 'disconnected' });
    expect(body.archivedAt).not.toBeNull();
    expect(body.endedAt).not.toBeNull();
  });

  test('unarchive brings a session back into the list', async () => {
    const s = await createTerminalSession();
    await app.inject({ method: 'POST', url: `/api/terminal/sessions/${s.id}/archive` });
    await app.inject({ method: 'POST', url: `/api/terminal/sessions/${s.id}/unarchive` });
    const def = await app.inject({ method: 'GET', url: '/api/terminal/sessions' });
    expect(def.json().map((r: { id: number }) => r.id)).toContain(s.id);
  });
});

// ── Real driver, fake Runner: the spawn-failure -> `failed` path end to end ──

describe('terminal routes — spawn failure (real driver)', () => {
  let failApp: FastifyInstance;

  beforeAll(async () => {
    const realDriver = createTerminalDriver({
      runner: {
        spawnPty: () => {
          throw new Error('Cannot create process, error code: 87');
        },
      },
      store: createTerminalStore(db),
      schedule: (fn) => fn(),
    });
    failApp = buildApp({ db, terminalDriver: realDriver });
    await failApp.ready();
  });

  afterAll(async () => {
    await failApp?.close();
  });

  test('a spawn failure becomes failed, not a 500', async () => {
    const wd = await failApp.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: `wd-fail-${Date.now()}`, path: tmpdir() },
    });
    const res = await failApp.inject({
      method: 'POST',
      url: '/api/terminal/sessions',
      payload: { workdirId: wd.json().id },
    });
    expect(res.statusCode).toBe(201);
    await vi.waitFor(async () => {
      const got = await failApp.inject({ url: `/api/terminal/sessions/${res.json().id}` });
      expect(got.json().status).toBe('failed');
    });
  });
});
