import { afterAll, beforeEach, expect, it } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { commands, events, schemes } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { defineEvent } from '../event/registry';
import { defineCommand } from './registry';
import { runCommand } from './run-command';

beforeEach(resetDb);
afterAll(resetDb);

const pinged = defineEvent({
  kind: 'probe.pinged',
  aggregateType: 'probe',
  version: 1,
  payload: v.object({ n: v.number() }),
});

const ping = defineCommand({
  kind: 'probe.ping',
  input: v.object({ n: v.number() }),
  aggregate: () => ({ type: 'probe', id: 1 }),
  async handler(_tx, input, ctx) {
    await ctx.emit(pinged, { n: input.n });
    return { ok: true, n: input.n };
  },
});

const env = (actorId: number) => ({ commandId: '22222222-2222-2222-2222-222222222222', actorId });

it('runs the handler, writes one ledger row and one event, returns the result', async () => {
  const fx = await seedFixture();
  const result = await runCommand(testDb, ping, env(fx.actorId), { n: 3 });
  expect(result).toEqual({ ok: true, n: 3 });
  expect(await testDb.select().from(commands)).toHaveLength(1);
  expect(await testDb.select().from(events).where(eq(events.kind, 'probe.pinged'))).toHaveLength(1);
});

it('is idempotent: a replayed commandId returns the stored result and does not re-run', async () => {
  const fx = await seedFixture();
  const first = await runCommand(testDb, ping, env(fx.actorId), { n: 3 });
  const second = await runCommand(testDb, ping, env(fx.actorId), { n: 99 }); // different input, same id
  expect(second).toEqual(first); // stored result, handler never ran again
  expect(await testDb.select().from(events).where(eq(events.kind, 'probe.pinged'))).toHaveLength(1);
});

// A handler can trip a *different* unique constraint (not the commands ledger
// PK). That must propagate as the real DB error, not get misclassified as the
// 409 "command already in flight" — every Postgres unique-violation message
// contains "duplicate key value violates unique constraint", so a message-only
// check would wrongly swallow this too.
const clashScheme = defineCommand({
  kind: 'probe.clash-scheme',
  input: v.object({ key: v.string() }),
  aggregate: () => ({ type: 'probe', id: 2 }),
  async handler(tx, input) {
    await tx.insert(schemes).values({ key: input.key, name: 'first' });
    await tx.insert(schemes).values({ key: input.key, name: 'second' }); // duplicate schemes_key_unique
    return { ok: true };
  },
});

it('propagates a non-PK unique violation from the handler instead of masking it as 409', async () => {
  const fx = await seedFixture();
  let caught: unknown;
  try {
    await runCommand(testDb, clashScheme, env(fx.actorId), { key: 'dup-key' });
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeDefined();
  const asHttpError = caught as { statusCode?: number; message?: string };
  expect(asHttpError.statusCode).not.toBe(409);
  expect(asHttpError.message ?? '').not.toMatch(/in flight/);
});

it('rejects input that fails the command schema with a 400 HttpError, not a raw ValiError/500', async () => {
  const fx = await seedFixture();
  let caught: unknown;
  try {
    // `n` is required and must be a number — omit it entirely.
    await runCommand(testDb, ping, env(fx.actorId), {});
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeDefined();
  expect(caught).not.toHaveProperty('issues'); // not a raw valibot ValiError
  const asHttpError = caught as { statusCode?: number };
  expect(asHttpError.statusCode).toBe(400);
});
