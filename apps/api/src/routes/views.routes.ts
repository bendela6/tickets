import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { views } from '@tickets/db';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';
import { validateViewConfig } from '../views/validate-view-config';
import { loadProjectVocab } from '../vocab/load-project-vocab';

const createViewSchema = v.object({
  //
  name: v.pipe(v.string(), v.minLength(1)),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const patchViewSchema = v.object({
  //
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

export function registerViewsRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const createView = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const body = parseBody(createViewSchema, request.body);
    const vocab = await loadProjectVocab(db, { key });
    if (body.config !== undefined) {
      validateViewConfig(vocab, body.config);
    }
    const inserted = await db
      .insert(views)
      .values({
        projectId: vocab.project.id,
        name: body.name,
        config: body.config ?? {},
        position: vocab.views.length,
      })
      .returning();
    reply.status(201).send(inserted[0]);
  };

  const patchView = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchViewSchema, request.body);
    const rows = await db.select().from(views).where(eq(views.id, id));
    const view = rows[0];
    if (!view) {
      throw new HttpError(404, 'view not found');
    }
    if (body.config !== undefined) {
      const vocab = await loadProjectVocab(db, { id: view.projectId });
      validateViewConfig(vocab, body.config);
    }
    const updated = await db
      .update(views)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        ...(body.archived !== undefined ? { archivedAt: body.archived ? sql`now()` : null } : {}),
      })
      .where(eq(views.id, id))
      .returning();
    reply.send(updated[0]);
  };

  app.post('/api/projects/:key/views', createView);
  app.patch('/api/views/:id', patchView);
}
