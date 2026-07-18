import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from 'vitest';
import type { Db } from '@tickets/db';
import { environment as dbEnvironment } from '@tickets/db';
import { buildApp } from '../app';
import { environment } from '../environment';

// Route-level integration test for `/api/workdirs`. It lives here rather than
// under terminal/ or agent/ because the workdir CRUD is neither subsystem's:
// both need it, so neither may own it. buildApp registers it independently of
// the two drivers, and this test injects NO driver at all — proving the
// workdir surface stands on its own.
const { host, port, user, password } = dbEnvironment.postgres;
const dbName = `tozf_workdir_routes_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;

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

  app = buildApp({ db });
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('workdir routes', () => {
  test('creates, lists workdirs', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: 'wd-a', path: tmpdir() },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'wd-a', path: tmpdir(), runner: 'local' });

    const list = await app.inject({ method: 'GET', url: '/api/workdirs' });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((w: { name: string }) => w.name)).toContain('wd-a');
  });

  test('defaults runner to local and keeps the optional columns null', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: 'wd-defaults', path: tmpdir() },
    });
    expect(created.json()).toMatchObject({
      runner: 'local',
      containerName: null,
      gitRemote: null,
      defaultBranch: null,
    });
  });

  test('rejects a body with no path', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workdirs',
      payload: { name: 'wd-nopath' },
    });
    expect(res.statusCode).toBe(400);
  });

  describe('directory browser routes', () => {
    let savedRoots: string[];

    beforeEach(() => {
      savedRoots = environment.workdirRoots;
    });

    afterEach(() => {
      environment.workdirRoots = savedRoots;
    });

    it('GET /api/workdirs/roots returns the configured roots', async () => {
      environment.workdirRoots = [tmpdir()];
      const res = await app.inject({ method: 'GET', url: '/api/workdirs/roots' });
      expect(res.statusCode).toBe(200);
      expect(res.json().map((r: { path: string }) => r.path)).toContain(resolve(tmpdir()));
    });

    it('GET /api/workdirs/dirs lists sub-directories under a root', async () => {
      const base = await mkdtemp(join(tmpdir(), 'dirs-route-'));
      await mkdir(join(base, 'child-a'));
      environment.workdirRoots = [base];
      const res = await app.inject({ method: 'GET', url: `/api/workdirs/dirs?path=${encodeURIComponent(base)}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().entries.map((e: { name: string }) => e.name)).toEqual(['child-a']);
    });

    it('GET /api/workdirs/dirs rejects a path outside the roots with 403', async () => {
      const base = await mkdtemp(join(tmpdir(), 'dirs-route-'));
      environment.workdirRoots = [join(base, 'inner')];
      await mkdir(join(base, 'inner'));
      const res = await app.inject({ method: 'GET', url: `/api/workdirs/dirs?path=${encodeURIComponent(base)}` });
      expect(res.statusCode).toBe(403);
    });

    it('GET /api/workdirs/dirs with no path is a 400', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/workdirs/dirs' });
      expect(res.statusCode).toBe(400);
    });
  });
});
