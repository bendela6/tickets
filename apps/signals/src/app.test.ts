import { expect, it } from 'vitest';
import { buildApp } from './app';

it('GET /health returns ok without a db', async () => {
  const app = buildApp({ db: null as never });
  const res = await app.inject({ method: 'GET', url: '/health' });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ ok: true });
  await app.close();
});
