import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { createDbClient, type Db } from '../client';
import {
  comments, commentReactions, events, fields, itemLinks, itemTypeChildTypes, itemTypeFields,
  itemTypes, itemValues, items, linkTypeTargetTypes, linkTypes, optionSets, optionTransitions,
  options, projects, schemes, users, views,
} from '../schema';
import { createLegacyClient } from './legacy-client';
import { importLegacy, type ImportResult } from './import-legacy';
import { readLegacy, type Legacy } from './read-legacy';
import { verifyImport, type VerifyReport } from './verify-import';

// Self-contained, like import-legacy.test.ts and import-history.test.ts: the
// suite runs test files sequentially (vitest.config.ts's fileParallelism:
// false) and both of those sibling files clean up everything they insert in
// their own afterAll, so by the time a later file's beforeAll runs, an
// already-imported tickets_dev is back to freshly-migrated/empty. This file
// runs its own import so `report = await verifyImport(...)` has something to
// diff, then cleans up after itself the same way — the whole-suite run stays
// idempotent on an immediate second `pnpm test` with no DB reset. The
// assertions below are unchanged from the task-12 brief.
describe('verifyImport (run after the import tasks)', () => {
  let db: Db;
  let legacySql: Sql;
  let report: VerifyReport;
  let close: () => Promise<void>;
  let legacy: Legacy;
  let result: ImportResult;

  beforeAll(async () => {
    const target = createDbClient({ max: 1 });
    const legacyClient = createLegacyClient();
    db = target.db;
    legacySql = legacyClient.sql;
    close = async () => { await target.sql.end(); await legacyClient.sql.end(); };
    legacy = await readLegacy(legacyClient.sql);
    result = await importLegacy(db, legacy);
    report = await verifyImport(db, legacyClient.sql);
  }, 120_000);

  afterAll(async () => {
    // If beforeAll itself threw, the import transaction rolled back —
    // nothing to clean up — but `result`/`legacy` may be unset, so skip
    // straight to closing the connections.
    if (!result || !legacy) {
      await close();
      return;
    }

    // Delete exactly what this file's import created, children before
    // parents. Mirrors import-legacy.test.ts's afterAll.
    await db.delete(events);
    await db.delete(itemLinks).where(inArray(itemLinks.id, legacy.ticketLinks.map((l) => l.id)));
    await db.delete(commentReactions).where(inArray(commentReactions.id, legacy.commentReactions.map((r) => r.id)));
    await db.delete(comments).where(inArray(comments.id, legacy.comments.map((c) => c.id)));
    await db.delete(itemValues).where(inArray(itemValues.id, legacy.ticketValues.map((v) => v.id)));
    await db.delete(items).where(inArray(items.id, legacy.tickets.map((t) => t.id)));
    await db.delete(views).where(inArray(views.id, legacy.views.map((v) => v.id)));

    const typeIds = legacy.ticketTypes.map((t) => t.id);
    await db.delete(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds));
    await db.delete(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, typeIds));

    const linkTypeIds = legacy.linkTypes.map((lt) => lt.id);
    await db.delete(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkTypeIds));
    await db.delete(linkTypes).where(inArray(linkTypes.id, linkTypeIds));

    await db.delete(optionTransitions).where(inArray(optionTransitions.fieldId, [...result.fieldIdByLegacyId.values()]));
    await db.delete(itemTypes).where(inArray(itemTypes.id, typeIds));
    await db.delete(projects).where(inArray(projects.id, legacy.projects.map((p) => p.id)));

    await db.delete(fields).where(eq(fields.schemeId, result.schemeId));
    const setRows = await db.select({ id: optionSets.id }).from(optionSets).where(eq(optionSets.schemeId, result.schemeId));
    const setIds = setRows.map((s) => s.id);
    if (setIds.length) await db.delete(options).where(inArray(options.optionSetId, setIds));
    await db.delete(optionSets).where(eq(optionSets.schemeId, result.schemeId));
    await db.delete(schemes).where(eq(schemes.id, result.schemeId));

    await db.delete(users).where(
      inArray(users.id, [...legacy.users.map((u) => u.id), ...result.userIdByAgentName.values()]),
    );

    await close();
  });

  it('reports zero logical differences across all 635 items', () => {
    expect(report.itemDiffs).toEqual([]);
  });

  it('reports zero item skeleton, comment, and item link differences', () => {
    expect(report.skeletonDiffs).toEqual([]);
    expect(report.commentDiffs).toEqual([]);
    expect(report.linkDiffs).toEqual([]);
  });

  it('matches every row count, including views', () => {
    for (const c of report.counts) {
      expect(c, `${c.table}: legacy ${c.legacy} vs imported ${c.imported}`).toMatchObject({ ok: true });
    }
    expect(report.counts.some((c) => c.table === 'views')).toBe(true);
  });

  it('passes overall', () => {
    expect(report.ok).toBe(true);
  });

  // Proves the newly-added surfaces actually bite: corrupt one row on each
  // one, confirm verifyImport both flags it AND flips `ok` to false, then
  // restore and confirm a clean report again. Each test cleans up after
  // itself so later tests in this describe block still see a healthy
  // database (order matters here — vitest runs `it`s within a file in
  // declaration order by default).
  describe('newly-covered surfaces actually get caught when corrupted', () => {
    it('flags and recovers from a corrupted item type_id (skeleton)', async () => {
      const [sample] = await db.select({ id: items.id, typeId: items.typeId }).from(items).limit(1);
      expect(sample).toBeDefined();
      const [otherType] = await db
        .select({ id: itemTypes.id })
        .from(itemTypes)
        .where(ne(itemTypes.id, sample!.typeId))
        .limit(1);
      expect(otherType).toBeDefined();

      await db.update(items).set({ typeId: otherType!.id }).where(eq(items.id, sample!.id));
      const corrupted = await verifyImport(db, legacySql);
      expect(corrupted.ok).toBe(false);
      expect(
        corrupted.skeletonDiffs.some((d) => d.itemId === sample!.id && d.field === 'type_key'),
      ).toBe(true);

      await db.update(items).set({ typeId: sample!.typeId }).where(eq(items.id, sample!.id));
      const restored = await verifyImport(db, legacySql);
      expect(restored.ok).toBe(true);
    });

    it('flags and recovers from a corrupted item link target', async () => {
      const [sampleLink] = await db
        .select({
          id: itemLinks.id,
          linkTypeId: itemLinks.linkTypeId,
          sourceItemId: itemLinks.sourceItemId,
          targetItemId: itemLinks.targetItemId,
        })
        .from(itemLinks)
        .limit(1);
      expect(sampleLink).toBeDefined();

      const usedTargets = new Set(
        (
          await db
            .select({ targetItemId: itemLinks.targetItemId })
            .from(itemLinks)
            .where(and(eq(itemLinks.linkTypeId, sampleLink!.linkTypeId), eq(itemLinks.sourceItemId, sampleLink!.sourceItemId)))
        ).map((r) => r.targetItemId),
      );
      const candidates = await db.select({ id: items.id }).from(items).limit(50);
      const newTarget = candidates.find((i) => i.id !== sampleLink!.sourceItemId && !usedTargets.has(i.id));
      expect(newTarget).toBeDefined();

      await db.update(itemLinks).set({ targetItemId: newTarget!.id }).where(eq(itemLinks.id, sampleLink!.id));
      const corrupted = await verifyImport(db, legacySql);
      expect(corrupted.ok).toBe(false);
      expect(
        corrupted.linkDiffs.some((d) => d.linkId === sampleLink!.id && d.field === 'target_item_id'),
      ).toBe(true);

      await db.update(itemLinks).set({ targetItemId: sampleLink!.targetItemId }).where(eq(itemLinks.id, sampleLink!.id));
      const restored = await verifyImport(db, legacySql);
      expect(restored.ok).toBe(true);
    });

    it('flags and recovers from a corrupted comment body', async () => {
      const [sampleComment] = await db.select({ id: comments.id, body: comments.body }).from(comments).limit(1);
      expect(sampleComment).toBeDefined();

      await db.update(comments).set({ body: '__verify-import corruption test__' }).where(eq(comments.id, sampleComment!.id));
      const corrupted = await verifyImport(db, legacySql);
      expect(corrupted.ok).toBe(false);
      expect(
        corrupted.commentDiffs.some((d) => d.commentId === sampleComment!.id && d.field === 'body'),
      ).toBe(true);

      await db.update(comments).set({ body: sampleComment!.body }).where(eq(comments.id, sampleComment!.id));
      const restored = await verifyImport(db, legacySql);
      expect(restored.ok).toBe(true);
    });
  });
});
