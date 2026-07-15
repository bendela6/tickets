import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import {
  events, fields, itemTypeChildTypes, itemTypeFields, itemTypes, linkTypeTargetTypes, linkTypes,
  optionSets, optionTransitions, options,
} from '@tickets/db';
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

it('remaps every FK across all 9 child levels of a fork, not just types/fields', async () => {
  const fx = await seedFixture();
  const srcTypes = await testDb.select().from(itemTypes).where(eq(itemTypes.schemeId, fx.schemeId));
  const srcTypeIds = srcTypes.map((t) => t.id);
  const srcFields = await testDb.select().from(fields).where(eq(fields.schemeId, fx.schemeId));
  const srcFieldIds = srcFields.map((f) => f.id);
  const srcOptionSets = await testDb.select().from(optionSets).where(eq(optionSets.schemeId, fx.schemeId));
  const srcOptionSetIds = srcOptionSets.map((s) => s.id);
  const srcOptions = srcOptionSetIds.length
    ? await testDb.select().from(options).where(inArray(options.optionSetId, srcOptionSetIds))
    : [];

  const srcPlacements = await testDb.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, srcTypeIds));
  const srcChildren = await testDb.select().from(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, srcTypeIds));
  const srcLinks = await testDb.select().from(linkTypes).where(inArray(linkTypes.itemTypeId, srcTypeIds));
  const srcLinkIds = srcLinks.map((l) => l.id);
  const srcTargets = srcLinkIds.length
    ? await testDb.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, srcLinkIds))
    : [];
  const srcTransitions = await testDb.select().from(optionTransitions).where(inArray(optionTransitions.fieldId, srcFieldIds));

  // Sanity: the seed genuinely exercises all 5 levels the old test never
  // looked at — if any of these go to zero, the assertions below would
  // pass vacuously and this test would stop meaning anything.
  expect(srcPlacements.length).toBeGreaterThan(0);
  expect(srcChildren.length).toBeGreaterThan(0);
  expect(srcLinks.length).toBeGreaterThan(0);
  expect(srcTargets.length).toBeGreaterThan(0);
  expect(srcTransitions.length).toBeGreaterThan(0);

  const res = await runCommand(testDb, schemeFork, { commandId: crypto.randomUUID(), actorId: fx.actorId }, {
    sourceSchemeId: fx.schemeId, key: 'software-fork-2', name: 'Software (fork 2)',
  });

  const dstTypes = await testDb.select().from(itemTypes).where(eq(itemTypes.schemeId, res.schemeId));
  const dstTypeIds = dstTypes.map((t) => t.id);
  const dstTypeIdSet = new Set(dstTypeIds);
  const dstFields = await testDb.select().from(fields).where(eq(fields.schemeId, res.schemeId));
  const dstFieldIdSet = new Set(dstFields.map((f) => f.id));
  const dstOptionSets = await testDb.select().from(optionSets).where(eq(optionSets.schemeId, res.schemeId));
  const dstOptionSetIds = dstOptionSets.map((s) => s.id);
  const dstOptions = dstOptionSetIds.length
    ? await testDb.select().from(options).where(inArray(options.optionSetId, dstOptionSetIds))
    : [];
  const dstOptionIdSet = new Set(dstOptions.map((o) => o.id));

  // item_type_fields
  const dstPlacements = dstTypeIds.length
    ? await testDb.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, dstTypeIds))
    : [];
  expect(dstPlacements).toHaveLength(srcPlacements.length);
  for (const p of dstPlacements) {
    expect(dstTypeIdSet.has(p.itemTypeId)).toBe(true);
    expect(dstFieldIdSet.has(p.fieldId)).toBe(true);
  }

  // item_type_child_types
  const dstChildren = dstTypeIds.length
    ? await testDb.select().from(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, dstTypeIds))
    : [];
  expect(dstChildren).toHaveLength(srcChildren.length);
  for (const c of dstChildren) {
    expect(dstTypeIdSet.has(c.parentTypeId)).toBe(true);
    expect(dstTypeIdSet.has(c.childTypeId)).toBe(true);
  }

  // link_types
  const dstLinks = dstTypeIds.length
    ? await testDb.select().from(linkTypes).where(inArray(linkTypes.itemTypeId, dstTypeIds))
    : [];
  const dstLinkIds = dstLinks.map((l) => l.id);
  const dstLinkIdSet = new Set(dstLinkIds);
  expect(dstLinks).toHaveLength(srcLinks.length);
  for (const l of dstLinks) {
    expect(dstTypeIdSet.has(l.itemTypeId)).toBe(true);
  }

  // link_type_target_types
  const dstTargets = dstLinkIds.length
    ? await testDb.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, dstLinkIds))
    : [];
  expect(dstTargets).toHaveLength(srcTargets.length);
  for (const t of dstTargets) {
    expect(dstLinkIdSet.has(t.linkTypeId)).toBe(true);
    expect(dstTypeIdSet.has(t.targetTypeId)).toBe(true);
  }

  // option_transitions
  const dstTransitions = dstFieldIdSet.size
    ? await testDb.select().from(optionTransitions).where(inArray(optionTransitions.fieldId, [...dstFieldIdSet]))
    : [];
  expect(dstTransitions).toHaveLength(srcTransitions.length);
  for (const t of dstTransitions) {
    expect(dstFieldIdSet.has(t.fieldId)).toBe(true);
    expect(dstOptionIdSet.has(t.toOptionId)).toBe(true);
    if (t.fromOptionId != null) expect(dstOptionIdSet.has(t.fromOptionId)).toBe(true);
    if (t.itemTypeId != null) expect(dstTypeIdSet.has(t.itemTypeId)).toBe(true);
  }

  // No destination row of any of these 5 levels may point back at a
  // source-scheme id — this is the check a "forgot to remap" regression
  // would actually trip, since count-only assertions can pass even when
  // ids are wrong (e.g. reusing the same set size by coincidence).
  const srcTypeIdSet = new Set(srcTypeIds);
  const srcFieldIdSet = new Set(srcFieldIds);
  const srcOptionIdSet = new Set(srcOptions.map((o) => o.id));
  const srcLinkIdSet = new Set(srcLinkIds);
  for (const p of dstPlacements) {
    expect(srcTypeIdSet.has(p.itemTypeId)).toBe(false);
    expect(srcFieldIdSet.has(p.fieldId)).toBe(false);
  }
  for (const c of dstChildren) {
    expect(srcTypeIdSet.has(c.parentTypeId)).toBe(false);
    expect(srcTypeIdSet.has(c.childTypeId)).toBe(false);
  }
  for (const l of dstLinks) {
    expect(srcTypeIdSet.has(l.itemTypeId)).toBe(false);
  }
  for (const t of dstTargets) {
    expect(srcLinkIdSet.has(t.linkTypeId)).toBe(false);
    expect(srcTypeIdSet.has(t.targetTypeId)).toBe(false);
  }
  for (const t of dstTransitions) {
    expect(srcFieldIdSet.has(t.fieldId)).toBe(false);
    expect(srcOptionIdSet.has(t.toOptionId)).toBe(false);
    if (t.fromOptionId != null) expect(srcOptionIdSet.has(t.fromOptionId)).toBe(false);
    if (t.itemTypeId != null) expect(srcTypeIdSet.has(t.itemTypeId)).toBe(false);
  }
});
