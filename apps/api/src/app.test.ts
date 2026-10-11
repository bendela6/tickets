import { expect, it, vi } from 'vitest';
import { HttpError } from './errors';
import { testDb } from './test/db';
import { buildApp } from './app';

it('answers a genuine failure with 500 and logs it', async () => {
  const app = buildApp({ db: testDb });
  app.get('/__test/throws', async () => {
    throw new Error('boom');
  });
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

  const res = await app.inject({ method: 'GET', url: '/__test/throws' });
  expect(res.statusCode).toBe(500);
  expect(res.json()).toEqual({ error: 'internal error' });
  expect(logged).toHaveBeenCalledWith(expect.any(Error));

  logged.mockRestore();
  await app.close();
});

it('answers an HttpError with its own status and message', async () => {
  const app = buildApp({ db: testDb });
  app.get('/__test/http-error', async () => {
    throw new HttpError(404, 'nope');
  });

  const res = await app.inject({ method: 'GET', url: '/__test/http-error' });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: 'nope' });

  await app.close();
});

// drizzle wraps a postgres unique violation in a DrizzleQueryError whose
// `.cause` holds the code and detail; it answers 409, naming the clashing key.
it('answers a unique-key clash with 409 and the key that is taken', async () => {
  const app = buildApp({ db: testDb });
  app.get('/__test/duplicate', async () => {
    throw Object.assign(new Error('Failed query: insert into ...'), {
      cause: { code: '23505', detail: 'Key (scheme_id, key)=(1, status) already exists.' },
    });
  });

  const res = await app.inject({ method: 'GET', url: '/__test/duplicate' });
  expect(res.statusCode).toBe(409);
  expect(res.json()).toEqual({ error: 'key "status" is already taken' });

  await app.close();
});

it('answers an unmatched route with 404', async () => {
  const app = buildApp({ db: testDb });

  const res = await app.inject({ method: 'GET', url: '/__test/does-not-exist' });
  expect(res.statusCode).toBe(404);
  expect(res.json()).toEqual({ error: 'not found' });

  await app.close();
});
