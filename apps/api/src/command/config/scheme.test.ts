import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, fields, itemTypes, optionSets, options } from '@tickets/db';
import { resetDb, seedFixture, testDb } from '../../test/db';
import { runCommand } from '../run-command';
import { schemeFork } from './scheme';

beforeEach(resetDb);
afterAll(resetDb);

it('forks a scheme with all types, fields, and options copied under fresh ids', async () => {
  const fx = await seedFixture();
  const srcTypes = await testDb.select().from(itemTypes).where(eq(itemTypes.schemeId, fx.schemeId));
  const srcFields = await testDb.select().from(fields).where(eq(fields.schemeId, fx.schemeId));

  const res = await runCommand(testDb, schemeFork, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceSchemeId: fx.schemeId, key: 'software-fork', name: 'Software (fork)',
  });

  const dstTypes = await testDb.select().from(itemTypes).where(eq(itemTypes.schemeId, res.schemeId));
  const dstFields = await testDb.select().from(fields).where(eq(fields.schemeId, res.schemeId));
  expect(dstTypes).toHaveLength(srcTypes.length);
  expect(dstFields).toHaveLength(srcFields.length);
  // fresh ids
  expect(dstTypes.every((t) => !srcTypes.some((s) => s.id === t.id))).toBe(true);
  // Option-typed fields keep a resolvable (remapped) option set: the cloned
  // field's optionSetId must be a FRESH id (not one of the source scheme's
  // option-set ids — catches "forgot to remap, left the stale source id"),
  // and must carry over exactly the same option count as its source
  // counterpart (catches "remapped to the wrong destination set"). Two
  // seeded fields — labels/component — legitimately have zero options
  // ("curated per project"); a bare not-empty check would wrongly fail on
  // those, so we compare dst count to src count per field instead.
  const srcOptionSets = await testDb.select().from(optionSets).where(eq(optionSets.schemeId, fx.schemeId));
  const srcSetIds = new Set(srcOptionSets.map((s) => s.id));
  const srcFieldByKey = new Map(srcFields.map((f) => [f.key, f]));
  for (const f of dstFields.filter((f) => f.optionSetId != null)) {
    expect(srcSetIds.has(f.optionSetId!)).toBe(false);
    const srcField = srcFieldByKey.get(f.key)!;
    const srcOptCount = (await testDb.select().from(options).where(eq(options.optionSetId, srcField.optionSetId!))).length;
    const dstOptCount = (await testDb.select().from(options).where(eq(options.optionSetId, f.optionSetId!))).length;
    expect(dstOptCount).toBe(srcOptCount);
  }
  expect((await testDb.select().from(events).where(eq(events.kind, 'scheme.forked')))).toHaveLength(1);
});
