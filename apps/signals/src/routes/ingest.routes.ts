import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, issues, signals } from '../db/schema';
import { HttpError } from '../errors';
import { culpritFrom, fingerprintError, issueTitle } from '../fingerprint';
import type { RateLimiter } from '../rate-limit';
import type { SignalPayload } from '../types';
import { IngestEnvelopeSchema, type IngestSignal } from './ingest.schema';

const MAX_PAYLOAD_BYTES = 200_000;

function toPayload(s: IngestSignal): SignalPayload {
  const payload: SignalPayload = {
    stack: s.stack, breadcrumbs: s.breadcrumbs, user: s.user, tags: s.tags,
    contexts: s.contexts, platform: s.platform, sdk: s.sdk,
  };
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

    await context.db.transaction(async (tx) => {
      for (const s of batch) {
        let issueId: number | null = null;
        if (s.kind === 'error') {
          const fingerprint = fingerprintError({
            name: s.name, message: s.message, stack: s.stack, explicit: s.fingerprint,
          });
          const [issue] = await tx
            .insert(issues)
            .values({
              appId: appRow.id, fingerprint,
              title: issueTitle(s.name, s.message),
              culprit: culpritFrom(s.stack),
            })
            .onConflictDoUpdate({
              target: [issues.appId, issues.fingerprint],
              set: {
                eventCount: sql`${issues.eventCount} + 1`,
                lastSeen: sql`now()`,
                status: sql`CASE WHEN ${issues.status} = 'resolved' THEN 'open' ELSE ${issues.status} END`,
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
          issueId, payload: toPayload(s),
        });
      }
    });

    reply.status(202).send({ accepted: batch.length });
  });
}
