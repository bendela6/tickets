import fastify from 'fastify';
import type { Db } from '@tickets/db';
import { HttpError } from './errors';
import { registerCommentsRoutes } from './routes/comments.routes';
import { registerLinksRoutes } from './routes/links.routes';
import { registerProjectsRoutes } from './routes/projects.routes';
import { registerSchemesRoutes } from './routes/schemes.routes';
import { registerTicketsRoutes } from './routes/tickets.routes';
import { registerUsersRoutes } from './routes/users.routes';
import { registerViewsRoutes } from './routes/views.routes';
import { registerVocabularyRoutes } from './routes/vocabulary.routes';

export function buildApp(context: { db: Db }) {
  const app = fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    console.error(error);
    reply.status(500).send({ error: 'internal error' });
  });

  registerProjectsRoutes(app, context);
  registerSchemesRoutes(app, context);
  registerTicketsRoutes(app, context);
  registerCommentsRoutes(app, context);
  registerLinksRoutes(app, context);
  registerUsersRoutes(app, context);
  registerViewsRoutes(app, context);
  registerVocabularyRoutes(app, context);

  return app;
}
