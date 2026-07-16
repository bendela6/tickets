import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../test/db';
import { runCommand } from './run-command';
import { itemCreate } from './item/create';
import { itemComment } from './item/comment';

beforeEach(resetDb);
afterAll(resetDb);

// NOTE: testDb is created with `{ max: 1 }` (see ../test/db.ts), so these 6
// concurrent commands serialize at the connection level and never actually
// race on nextSeq() — this test only verifies the success-path invariant
// (no 500s, unique seqs). It is NOT a deterministic regression test for the
// stream-seq retry; that lives in run-command-retry.test.ts.
it('concurrent comments on one item all succeed (no 500 from a seq collision)', async () => {
  const fx = await seedFixture();
  const item = await runCommand(testDb, itemCreate, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    projectKey: fx.projectKey, typeKey: 'task', values: { title: 'A' },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      runCommand(testDb, itemComment, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
        itemId: item.id, body: `c${i}`,
      })),
  );
  // none rejected with a 500; any rejections are a clean 409
  for (const r of results) {
    if (r.status === 'rejected') expect(r.reason).toMatchObject({ statusCode: 409 });
  }
  const seqs = (await testDb.select().from(events).where(eq(events.aggregateId, item.id))).map((e) => e.seq);
  expect(new Set(seqs).size).toBe(seqs.length); // all seqs unique
});
