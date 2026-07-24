import { and, eq, lt, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { apps, signals, sourcemapArtifacts } from '../db/schema';
import { HttpError } from '../errors';
import { pruneIssues } from '../issue-prune';
import { parseIntParam } from '../params';

type ReleaseRow = {
  release: string;
  signal_count: string | number;
  error_count: string | number;
  sourcemap_count: string | number;
  sourcemap_bytes: string | number | null;
  first_seen: Date | string | null;
  last_seen: Date | string | null;
};

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

  // Lists an app's "releases" — the union of every distinct non-null `release`
  // value appearing in either `signals` or `sourcemap_artifacts` for this app,
  // since a release may have signals but no maps yet, or maps but no signals
  // yet. Per-release aggregates (including sourcemapBytes, via octet_length —
  // actual UTF-8 byte size of the stored map content, not character count) are
  // computed in SQL rather than fetched into node. Newest-first by lastSeen,
  // with releases that have no signals (maps-only) sorted last.
  app.get('/apps/:id/releases', async (request) => {
    const id = parseIntParam((request.params as { id: string }).id);
    const [appRow] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!appRow) throw new HttpError(404, 'app not found');

    const rows = await context.db.execute<ReleaseRow>(sql`
      WITH sig AS (
        SELECT
          release,
          count(*) AS signal_count,
          count(*) FILTER (WHERE kind = 'error') AS error_count,
          min(received_at) AS first_seen,
          max(received_at) AS last_seen
        FROM signals
        WHERE app_id = ${id} AND release IS NOT NULL
        GROUP BY release
      ),
      maps AS (
        SELECT
          release,
          count(*) AS sourcemap_count,
          sum(octet_length(content)) AS sourcemap_bytes
        FROM sourcemap_artifacts
        WHERE app_id = ${id}
        GROUP BY release
      )
      SELECT
        COALESCE(sig.release, maps.release) AS release,
        COALESCE(sig.signal_count, 0) AS signal_count,
        COALESCE(sig.error_count, 0) AS error_count,
        COALESCE(maps.sourcemap_count, 0) AS sourcemap_count,
        COALESCE(maps.sourcemap_bytes, 0) AS sourcemap_bytes,
        sig.first_seen AS first_seen,
        sig.last_seen AS last_seen
      FROM sig
      FULL OUTER JOIN maps ON sig.release = maps.release
      ORDER BY sig.last_seen DESC NULLS LAST, COALESCE(sig.release, maps.release) DESC
    `);

    return rows.map((r) => ({
      release: r.release,
      signalCount: Number(r.signal_count),
      errorCount: Number(r.error_count),
      sourcemapCount: Number(r.sourcemap_count),
      sourcemapBytes: Number(r.sourcemap_bytes ?? 0),
      firstSeen: r.first_seen ? new Date(r.first_seen).toISOString() : null,
      lastSeen: r.last_seen ? new Date(r.last_seen).toISOString() : null,
    }));
  });

  // Deletes one release's worth of an app's data — its signals and its
  // sourcemap artifacts — then prunes any issue left with zero referencing
  // signals, all in one transaction. A release with zero matches on a valid
  // app is a no-op 200 (zeros), not a 404; only an unknown app 404s.
  app.delete('/apps/:id/releases/:release', async (request) => {
    const id = parseIntParam((request.params as { id: string }).id);
    const [appRow] = await context.db.select().from(apps).where(eq(apps.id, id));
    if (!appRow) throw new HttpError(404, 'app not found');
    const release = decodeURIComponent((request.params as { release: string }).release);

    const result = await context.db.transaction(async (tx) => {
      const deletedSignals = await tx
        .delete(signals)
        .where(and(eq(signals.appId, id), eq(signals.release, release)))
        .returning({ id: signals.id });
      const deletedArtifacts = await tx
        .delete(sourcemapArtifacts)
        .where(and(eq(sourcemapArtifacts.appId, id), eq(sourcemapArtifacts.release, release)))
        .returning({ id: sourcemapArtifacts.id });
      const { prunedIssues } = await pruneIssues(tx, id);
      return {
        deletedSignals: deletedSignals.length,
        deletedArtifacts: deletedArtifacts.length,
        prunedIssues,
      };
    });

    return result;
  });
}
