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
