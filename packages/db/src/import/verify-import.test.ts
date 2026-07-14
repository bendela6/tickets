import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
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
  let report: VerifyReport;
  let close: () => Promise<void>;
  let legacy: Legacy;
  let result: ImportResult;

  beforeAll(async () => {
    const target = createDbClient({ max: 1 });
    const legacyClient = createLegacyClient();
    db = target.db;
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

  it('matches every row count', () => {
    for (const c of report.counts) {
      expect(c, `${c.table}: legacy ${c.legacy} vs imported ${c.imported}`).toMatchObject({ ok: true });
    }
  });

  it('passes overall', () => {
    expect(report.ok).toBe(true);
  });
});
