import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

it('POST /apps creates an app with slug, pub_ key, and sgl:// DSN', async () => {
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Storefront Web' } });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  expect(body.slug).toBe('storefront-web');
  expect(body.ingestKey).toMatch(/^pub_[0-9a-f]{12}$/);
  expect(body.dsn).toBe(`sgl://${body.ingestKey}@127.0.0.1:4640/${body.id}`);
  await app.close();
});

it('POST /apps rejects a missing name and duplicate slug', async () => {
  const app = buildApp({ db: testDb });
  expect((await app.inject({ method: 'POST', url: '/apps', payload: {} })).statusCode).toBe(400);
  await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Same' } });
  expect((await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Same' } })).statusCode).toBe(409);
  await app.close();
});

it('GET /apps lists apps; GET /apps/:id returns one with dsn; unknown id 404s', async () => {
  const app = buildApp({ db: testDb });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const list = (await app.inject({ method: 'GET', url: '/apps' })).json();
  expect(list).toHaveLength(1);
  expect(list[0].signals24h).toBe(0);
  const one = (await app.inject({ method: 'GET', url: `/apps/${created.id}` })).json();
  expect(one.dsn).toContain('sgl://');
  expect((await app.inject({ method: 'GET', url: '/apps/9999' })).statusCode).toBe(404);
  await app.close();
});

it('GET /meta reports database size', async () => {
  const app = buildApp({ db: testDb });
  const meta = (await app.inject({ method: 'GET', url: '/meta' })).json();
  expect(meta.dbSizeBytes).toBeGreaterThan(0);
  await app.close();
});

it('GET /apps/:id rejects a malformed id with 400', async () => {
  const app = buildApp({ db: testDb });
  expect((await app.inject({ method: 'GET', url: '/apps/abc' })).statusCode).toBe(400);
  await app.close();
});

it('POST /apps with upsert:true on duplicate slug returns 200 with existing app', async () => {
  const app = buildApp({ db: testDb });
  const firstRes = await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Tickets API', upsert: true } });
  expect(firstRes.statusCode).toBe(201);
  const first = firstRes.json();
  const secondRes = await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Tickets API', upsert: true } });
  expect(secondRes.statusCode).toBe(200);
  const second = secondRes.json();
  expect(second.id).toBe(first.id);
  expect(second.ingestKey).toBe(first.ingestKey);
  expect(second.dsn).toBe(first.dsn);
  await app.close();
});

it('POST /apps without upsert on duplicate slug still returns 409', async () => {
  const app = buildApp({ db: testDb });
  await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Tickets API' } });
  const second = await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Tickets API' } });
  expect(second.statusCode).toBe(409);
  await app.close();
});

it('POST /apps with upsert:true handles two concurrent first registrations without a 500', async () => {
  const app = buildApp({ db: testDb });
  const [first, second] = await Promise.all([
    app.inject({ method: 'POST', url: '/apps', payload: { name: 'Concurrent App', upsert: true } }),
    app.inject({ method: 'POST', url: '/apps', payload: { name: 'Concurrent App', upsert: true } }),
  ]);
  const statuses = [first.statusCode, second.statusCode].sort();
  expect(statuses).toEqual([200, 201]);
  const winner = (first.statusCode === 201 ? first : second).json();
  const loser = (first.statusCode === 200 ? first : second).json();
  expect(loser.id).toBe(winner.id);
  expect(loser.dsn).toBe(winner.dsn);
  await app.close();
});

it('PATCH /apps/:id renames the app, re-slugifies, and keeps the same ingestKey', async () => {
  const app = buildApp({ db: testDb });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Original Name' } })).json();
  const before = (await app.inject({ method: 'GET', url: `/apps/${created.id}` })).json();

  const res = await app.inject({ method: 'PATCH', url: `/apps/${created.id}`, payload: { name: 'Renamed App' } });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.name).toBe('Renamed App');
  expect(body.slug).toBe('renamed-app');

  const after = (await app.inject({ method: 'GET', url: `/apps/${created.id}` })).json();
  expect(after.name).toBe('Renamed App');
  expect(after.slug).toBe('renamed-app');
  expect(after.ingestKey).toBe(before.ingestKey);
  expect(after.dsn).toBe(before.dsn);
  await app.close();
});

it('PATCH /apps/:id 409s when the new name slugifies to another existing app', async () => {
  const app = buildApp({ db: testDb });
  await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Taken Slug' } });
  const second = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Other App' } })).json();

  const res = await app.inject({ method: 'PATCH', url: `/apps/${second.id}`, payload: { name: 'Taken Slug' } });
  expect(res.statusCode).toBe(409);
  await app.close();
});

it('PATCH /apps/:id 404s for an unknown id', async () => {
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'PATCH', url: '/apps/9999', payload: { name: 'Whatever' } });
  expect(res.statusCode).toBe(404);
  await app.close();
});

it('GET /apps/:id includes ingestKey and dsn, but GET /apps (list) omits ingestKey', async () => {
  const app = buildApp({ db: testDb });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Detail App' } })).json();

  const one = (await app.inject({ method: 'GET', url: `/apps/${created.id}` })).json();
  expect(one.ingestKey).toMatch(/^pub_[0-9a-f]{12}$/);
  expect(one.dsn).toBe(`sgl://${one.ingestKey}@127.0.0.1:4640/${one.id}`);

  const list = (await app.inject({ method: 'GET', url: '/apps' })).json();
  const listed = list.find((a: { id: number }) => a.id === created.id);
  expect(listed).toBeDefined();
  expect(listed.ingestKey).toBeUndefined();
  await app.close();
});

it('POST /apps/:id/rotate issues a new ingestKey and dsn, reflected on subsequent GET', async () => {
  const app = buildApp({ db: testDb });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'Rotate Me' } })).json();
  const before = (await app.inject({ method: 'GET', url: `/apps/${created.id}` })).json();

  const res = await app.inject({ method: 'POST', url: `/apps/${created.id}/rotate` });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.ingestKey).toMatch(/^pub_[0-9a-f]{12}$/);
  expect(body.ingestKey).not.toBe(before.ingestKey);
  expect(body.dsn).not.toBe(before.dsn);
  expect(body.dsn).toBe(`sgl://${body.ingestKey}@127.0.0.1:4640/${body.id}`);

  const after = (await app.inject({ method: 'GET', url: `/apps/${created.id}` })).json();
  expect(after.ingestKey).toBe(body.ingestKey);
  expect(after.dsn).toBe(body.dsn);
  await app.close();
});

it('POST /apps/:id/rotate 404s for an unknown id', async () => {
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'POST', url: '/apps/9999/rotate' });
  expect(res.statusCode).toBe(404);
  await app.close();
});
