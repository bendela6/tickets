import { and, eq, lt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { apps, signals } from '../db/schema';
import { HttpError } from '../errors';
import { pruneIssues } from '../issue-prune';
import { parseIntParam } from '../params';

const KINDS = ['error', 'log', 'event'] as const;
type Kind = (typeof KINDS)[number];

export function registerAppSignalsRoutes(app: FastifyInstance, context: { db: Db }) {
  // Clears an app's signals — all, or filtered by any combination of
  // received-before / release / kind — and prunes any issue left with zero
  // referencing signals in the same transaction.
  app.delete('/apps/:id/signals', async (request) => {
    const id = parseIntParam((request.params as { id: string }).id);
    const [appRow] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!appRow) throw new HttpError(404, 'app not found');

    const q = request.query as Record<string, string | undefined>;

    let before: Date | undefined;
    if (q.before !== undefined) {
      before = new Date(q.before);
      if (Number.isNaN(before.getTime())) throw new HttpError(400, 'invalid before');
    }

    let kind: Kind | undefined;
    if (q.kind !== undefined) {
      if (!(KINDS as readonly string[]).includes(q.kind)) throw new HttpError(400, 'invalid kind');
      kind = q.kind as Kind;
    }

    const where = and(
      eq(signals.appId, id),
      before ? lt(signals.receivedAt, before) : undefined,
      q.release ? eq(signals.release, q.release) : undefined,
      kind ? eq(signals.kind, kind) : undefined,
    );

    const result = await context.db.transaction(async (tx) => {
      const deleted = await tx.delete(signals).where(where).returning({ id: signals.id });
      const { prunedIssues } = await pruneIssues(tx, id);
      return { deletedSignals: deleted.length, prunedIssues };
    });

    return result;
  });
}
