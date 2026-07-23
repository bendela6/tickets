import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, sourcemapArtifacts } from '../db/schema';
import { HttpError } from '../errors';
import { captureSelfEvent, SELF_APP_SLUG } from '../signals-self';

const UploadSchema = v.object({
  release: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  files: v.pipe(
    v.array(v.object({
      filename: v.pipe(v.string(), v.minLength(1), v.maxLength(300)),
      content: v.pipe(v.string(), v.minLength(2)),
    })),
    v.minLength(1),
    v.maxLength(50),
  ),
});

export function registerSourcemapRoutes(app: FastifyInstance, context: { db: Db }) {
  app.post('/ingest/:key/sourcemaps', { bodyLimit: 50 * 1024 * 1024 }, async (request, reply) => {
    const key = (request.params as { key: string }).key;
    const [appRow] = await context.db.select().from(apps).where(eq(apps.ingestKey, key));
    if (!appRow) throw new HttpError(403, 'unknown ingest key');
    const parsed = v.safeParse(UploadSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'release and files[] are required');
    const { release, files } = parsed.output;
    await context.db.insert(sourcemapArtifacts).values(
      files.map((f) => ({ appId: appRow.id, release, filename: f.filename, content: f.content })),
    );
    // A signal about the collector's own operation (uploads received), not
    // an error — skip when it's the self-app's own upload purely to avoid
    // noise, not for recursion safety (this success path can't recurse: a
    // failed self-report here just gets swallowed by the transport, never
    // re-captured).
    if (appRow.slug !== SELF_APP_SLUG) {
      captureSelfEvent('collector.sourcemap-upload', { release });
    }
    reply.status(201).send({ stored: files.length });
  });
}
