import { and, count, eq, isNotNull, max, min, notInArray } from 'drizzle-orm';
import type { Db, Tx } from './db/client';
import { issues, signals } from './db/schema';

// Keeps an app's `issues` rows consistent after ANY deletion of `signals` rows:
// - drops issues that no longer have a single referencing signal
// - recomputes eventCount/firstSeen/lastSeen for the issues that survive
//
// Must be called with a transaction (`tx`) that already contains the signal
// deletion, so the two writes are atomic. Reused by delete-app and
// delete-release, not just clear-signals.
export async function pruneIssues(tx: Db | Tx, appId: number): Promise<{ prunedIssues: number }> {
  const referenced = await tx
    .selectDistinct({ issueId: signals.issueId })
    .from(signals)
    .where(and(eq(signals.appId, appId), isNotNull(signals.issueId)));
  const referencedIds = referenced.map((r) => r.issueId!);

  const deleted = await tx
    .delete(issues)
    .where(
      and(
        eq(issues.appId, appId),
        referencedIds.length > 0 ? notInArray(issues.id, referencedIds) : undefined,
      ),
    )
    .returning({ id: issues.id });

  if (referencedIds.length > 0) {
    const aggregates = await tx
      .select({
        issueId: signals.issueId,
        eventCount: count(),
        firstSeen: min(signals.receivedAt),
        lastSeen: max(signals.receivedAt),
      })
      .from(signals)
      .where(and(eq(signals.appId, appId), isNotNull(signals.issueId)))
      .groupBy(signals.issueId);

    for (const agg of aggregates) {
      await tx
        .update(issues)
        .set({ eventCount: agg.eventCount, firstSeen: agg.firstSeen!, lastSeen: agg.lastSeen! })
        .where(eq(issues.id, agg.issueId!));
    }
  }

  return { prunedIssues: deleted.length };
}
