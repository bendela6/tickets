import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from './run-command';
import { itemCreate } from './item/create';
import { itemComment } from './item/comment';

// Deterministic regression coverage for the SP2 N3 fix: runCommand's bounded
// retry on `events_stream_seq` collisions (run-command.ts). The concurrency
// test in run-command-concurrency.test.ts runs against a `max: 1` pool, so it
// can never actually trigger a real seq collision — it only checks the
// success-path invariant. This file drives the retry loop and the
// 409-after-exhaustion path directly by controlling how `db.transaction`
// rejects, without touching the test harness's connection pool.

beforeEach(resetDb);
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(resetDb);

// Shape of the error drizzle's postgres-js driver surfaces for a unique
// violation: the real node-postgres error (code, constraint_name) lives on
// `.cause`, per isStreamSeqCollision/isCommandsPkeyCollision in run-command.ts.
function pgUniqueViolation(constraintName: string): Error {
  const cause = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint_name: constraintName,
  });
  return Object.assign(new Error('Failed query: insert into "events" ...'), { cause });
}

it('retries a stream-seq collision and succeeds once the retry clears', async () => {
  const fx = await seedFixture();
  const item = await runCommand(
    testDb,
    itemCreate,
    { commandId: crypto.randomUUID(), actorId: fx.actorId },
    { projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' } },
  );

  // Delegate to the real transaction on the final call so the success path
  // (and its result) is genuine — only the first two attempts are faked.
  const realTransaction = testDb.transaction.bind(testDb);
  let calls = 0;
  const spy = vi.spyOn(testDb, 'transaction').mockImplementation((cb, config) => {
    calls++;
    if (calls <= 2) return Promise.reject(pgUniqueViolation('events_stream_seq'));
    return realTransaction(cb, config);
  });

  const result = await runCommand(
    testDb,
    itemComment,
    { commandId: crypto.randomUUID(), actorId: fx.actorId },
    { itemId: item.id, body: 'hello' },
  );

  expect(result).toMatchObject({ id: expect.any(Number) });
  expect(calls).toBe(3); // 2 failed attempts + 1 success == N+1
  spy.mockRestore();
});

it('gives up after MAX_SEQ_RETRIES and rejects with a 409, not a raw throw', async () => {
  let calls = 0;
  vi.spyOn(testDb, 'transaction').mockImplementation(() => {
    calls++;
    return Promise.reject(pgUniqueViolation('events_stream_seq'));
  });

  await expect(
    runCommand(
      testDb,
      itemComment,
      { commandId: crypto.randomUUID(), actorId: 1 },
      { itemId: 1, body: 'hello' },
    ),
  ).rejects.toMatchObject({ statusCode: 409 });

  expect(calls).toBe(4); // MAX_SEQ_RETRIES (3) retries + the initial attempt
});

it('maps a commands_pkey collision to 409 without retrying', async () => {
  let calls = 0;
  vi.spyOn(testDb, 'transaction').mockImplementation(() => {
    calls++;
    return Promise.reject(pgUniqueViolation('commands_pkey'));
  });

  await expect(
    runCommand(
      testDb,
      itemComment,
      { commandId: crypto.randomUUID(), actorId: 1 },
      { itemId: 1, body: 'hello' },
    ),
  ).rejects.toMatchObject({ statusCode: 409 });

  expect(calls).toBe(1); // a pkey collision is not a stream-seq collision — no retry
});

it('propagates an unrelated error unchanged, not as a 409', async () => {
  const otherConstraint = pgUniqueViolation('options_set_value');
  vi.spyOn(testDb, 'transaction').mockRejectedValue(otherConstraint);

  await expect(
    runCommand(testDb, itemComment, { commandId: crypto.randomUUID(), actorId: 1 }, { itemId: 1, body: 'hello' }),
  ).rejects.toBe(otherConstraint);

  vi.restoreAllMocks();

  const genericErr = new Error('boom');
  vi.spyOn(testDb, 'transaction').mockRejectedValue(genericErr);

  await expect(
    runCommand(testDb, itemComment, { commandId: crypto.randomUUID(), actorId: 1 }, { itemId: 1, body: 'hello' }),
  ).rejects.toBe(genericErr);
});
