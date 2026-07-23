import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { attachments } from '@tickets/db';
import { HttpError } from '../errors';
import { parseId } from '../utils/parse-id';

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

// Editor image uploads are a blob store, not a domain mutation — these routes
// deliberately bypass the command envelope (no envelope/actor/event) that
// every other write route goes through. Plan-approved deviation.
export function registerAttachmentsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/attachments', { bodyLimit: MAX_BYTES }, async (request, reply) => {
    const mime = (request.headers['content-type'] ?? '').split(';')[0]!.trim();
    if (!IMAGE_MIMES.has(mime)) {
      throw new HttpError(415, `unsupported attachment type: ${mime || '(none)'}`);
    }
    const data = request.body as Buffer;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw new HttpError(400, 'empty attachment body');
    }
    const filenameHeader = request.headers['x-filename'];
    const filename = typeof filenameHeader === 'string' && filenameHeader.length > 0
      ? decodeURIComponent(filenameHeader)
      : `image.${mime.split('/')[1]}`;
    const [row] = await db
      .insert(attachments)
      .values({ filename, mime, size: data.length, data })
      .returning({ id: attachments.id });
    reply.status(201).send({ id: row!.id, url: `/api/attachments/${row!.id}` });
  });

  app.get('/api/attachments/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
    if (!row) {
      throw new HttpError(404, 'attachment not found');
    }
    reply
      .header('content-type', row.mime)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(row.data);
  });
}
