import { afterAll, beforeEach, expect, it } from 'vitest';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { commands, events } from '@tickets/db';
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
