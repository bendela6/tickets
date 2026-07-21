import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, sourcemapArtifacts } from '../db/schema';
import { HttpError } from '../errors';

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
    reply.status(201).send({ stored: files.length });
  });
}
