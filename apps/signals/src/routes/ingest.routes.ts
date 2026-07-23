import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, issues, signals, sourcemapArtifacts } from '../db/schema';
import { HttpError } from '../errors';
import { culpritFrom, fingerprintError, issueTitle } from '../fingerprint';
import type { RateLimiter } from '../rate-limit';
import { captureSelfError, SELF_APP_SLUG } from '../signals-self';
import { symbolicateFrames } from '../symbolicate';
import type { SignalPayload, SymbolicatedFrame } from '../types';
import { IngestEnvelopeSchema, type IngestSignal } from './ingest.schema';

const MAX_PAYLOAD_BYTES = 200_000;

function toPayload(s: IngestSignal, stackSymbolicated: SymbolicatedFrame[] | null): SignalPayload {
  const payload: SignalPayload = {
    stack: s.stack, breadcrumbs: s.breadcrumbs, user: s.user, tags: s.tags,
    contexts: s.contexts, platform: s.platform, sdk: s.sdk,
  };
  if (stackSymbolicated) payload.stackSymbolicated = stackSymbolicated;
  // Oversize guard: breadcrumbs are the usual offender — drop them first,
  // then contexts. Flag truncation so the UI can say so.
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    payload.breadcrumbs = payload.breadcrumbs?.slice(0, 5);
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) delete payload.contexts;
    payload.truncated = true;
  }
  return payload;
}

export function registerIngestRoutes(
  app: FastifyInstance,
  context: { db: Db; rateLimiter: RateLimiter },
) {
  app.options('/ingest/:key', async (_request, reply) => reply.status(204).send());

  app.post('/ingest/:key', async (request, reply) => {
    const key = (request.params as { key: string }).key;
    const [appRow] = await context.db.select().from(apps).where(eq(apps.ingestKey, key));
    if (!appRow) throw new HttpError(403, 'unknown ingest key');

    const parsed = v.safeParse(IngestEnvelopeSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'invalid ingest envelope');
    const batch = parsed.output.signals;

    if (!context.rateLimiter.allow(key, batch.length)) {
      throw new HttpError(429, 'rate limit exceeded — back off');
    }

    try {
      await context.db.transaction(async (tx) => {
        // Keyed by release: batches commonly carry many error signals from
        // the same release, so avoid re-querying the artifact table per
        // signal.
        const artifactCache = new Map<string, { filename: string; content: string }[]>();
        for (const s of batch) {
          let issueId: number | null = null;
          let symbolicated: SymbolicatedFrame[] | null = null;
          if (s.kind === 'error') {
            if (s.stack && s.release) {
              let artifacts = artifactCache.get(s.release);
              if (!artifacts) {
                artifacts = await tx
                  .select({ filename: sourcemapArtifacts.filename, content: sourcemapArtifacts.content })
                  .from(sourcemapArtifacts)
                  .where(and(eq(sourcemapArtifacts.appId, appRow.id), eq(sourcemapArtifacts.release, s.release)))
                  .orderBy(asc(sourcemapArtifacts.uploadedAt), asc(sourcemapArtifacts.id));
                artifactCache.set(s.release, artifacts);
              }
              if (artifacts.length > 0) symbolicated = symbolicateFrames(s.stack, artifacts);
            }
            const effectiveStack = symbolicated ?? s.stack;
            const fingerprint = fingerprintError({
              name: s.name, message: s.message, stack: effectiveStack, explicit: s.fingerprint,
            });
            const [issue] = await tx
              .insert(issues)
              .values({
                appId: appRow.id, fingerprint,
                title: issueTitle(s.name, s.message),
                culprit: culpritFrom(effectiveStack),
              })
              .onConflictDoUpdate({
                target: [issues.appId, issues.fingerprint],
                set: {
                  eventCount: sql`${issues.eventCount} + 1`,
                  lastSeen: sql`now()`,
                  status: sql`CASE WHEN ${issues.status} = 'resolved' THEN 'open' ELSE ${issues.status} END`,
                  culprit: sql`COALESCE(EXCLUDED.culprit, ${issues.culprit})`,
                },
              })
              .returning({ id: issues.id });
            issueId = issue!.id;
          }
          await tx.insert(signals).values({
            appId: appRow.id, kind: s.kind, sessionId: s.sessionId, name: s.name,
            message: s.message ?? null, mechanism: s.mechanism, level: s.level,
            clientTimestamp: new Date(s.timestamp),
            release: s.release ?? null, environment: s.environment ?? null,
            issueId, payload: toPayload(s, symbolicated),
          });
        }
      });
    } catch (err) {
      // Anti-recursion: never self-report a failure to ingest the
      // self-client's own signals — that failure trying to get self-reported
      // is exactly the loop this collector must not create. See
      // signals-self.ts for the full reasoning.
      if (appRow.slug !== SELF_APP_SLUG) {
        captureSelfError(err, {
          contexts: { ingest: { appId: appRow.id, appSlug: appRow.slug, batchSize: batch.length } },
        });
      }
      throw err;
    }

    reply.status(202).send({ accepted: batch.length });
  });
}
