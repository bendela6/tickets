import fastify from 'fastify';
import type { Db } from '@tickets/db';
import { HttpError, uniqueViolation } from './errors';
import { registerActivityRoutes } from './routes/activity.routes';
import { registerAgentsRoutes } from './routes/agents.routes';
import { registerAttachmentsRoutes } from './routes/attachments.routes';
import { registerBoardRoutes } from './routes/board.routes';
import { registerItemsRoutes } from './routes/items.routes';
import { registerLinksRoutes } from './routes/links.routes';
import { registerProjectsRoutes } from './routes/projects.routes';
import { registerSchemaRoutes } from './routes/schema.routes';
import { registerSchemesRoutes } from './routes/schemes.routes';
import { registerUsersRoutes } from './routes/users.routes';
import { registerViewsRoutes } from './routes/views.routes';
import { registerVocabularyRoutes } from './routes/vocabulary.routes';

export function buildApp(context: { db: Db }) {
  const app = fastify({ logger: false });

  // Attachment uploads arrive as raw image bytes, not JSON — register a
  // buffer parser for exactly the mimes registerAttachmentsRoutes accepts so
  // request.body is a Buffer there. Any other content-type (e.g.
  // application/pdf) has no parser and fastify replies 415 on its own,
  // which is what that route relies on for rejecting non-image uploads.
  app.addContentTypeParser(
    ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

  app.setErrorHandler((thrown, _request, reply) => {
    const error = uniqueViolation(thrown) ?? thrown;
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    // Fastify's own errors (body-parser, payload-too-large, content-type,
    // etc.) carry a statusCode without being our HttpError — pass the real
    // status through instead of flattening every non-HttpError into 500.
    const fastifyErr = error as { statusCode?: number; message?: string };
    const fastifyStatus = fastifyErr.statusCode;
    if (typeof fastifyStatus === 'number' && fastifyStatus < 500) {
      reply.status(fastifyStatus).send({ error: fastifyErr.message ?? 'request failed' });
      return;
    }
    console.error(error);
    reply.status(500).send({ error: 'internal error' });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'not found' });
  });

  registerProjectsRoutes(app, context);
  registerUsersRoutes(app, context);
  registerItemsRoutes(app, context);
  registerActivityRoutes(app, context);
  registerAttachmentsRoutes(app, context);
  registerLinksRoutes(app, context);
  registerBoardRoutes(app, context);
  registerVocabularyRoutes(app, context);
  registerSchemesRoutes(app, context);
  registerViewsRoutes(app, context);
  registerAgentsRoutes(app, context);
  registerSchemaRoutes(app);

  return app;
}
