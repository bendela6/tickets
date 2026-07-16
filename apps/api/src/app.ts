import fastify from 'fastify';
import type { Db } from '@tickets/db';
import { createDbSessionStore } from './ai/db-session-store';
import { createLocalRunner } from './ai/local-runner';
import { createSupervisor, type Supervisor } from './ai/supervisor';
import { HttpError } from './errors';
import { registerAiRoutes } from './routes/ai.routes';
import { registerCommentsRoutes } from './routes/comments.routes';
import { registerLinksRoutes } from './routes/links.routes';
import { registerProjectsRoutes } from './routes/projects.routes';
import { registerSchemaRoutes } from './routes/schema.routes';
import { registerSchemesRoutes } from './routes/schemes.routes';
import { registerTicketsRoutes } from './routes/tickets.routes';
import { registerUsersRoutes } from './routes/users.routes';
import { registerViewsRoutes } from './routes/views.routes';
import { registerVocabularyRoutes } from './routes/vocabulary.routes';

export function buildApp(context: { db: Db; supervisor?: Supervisor }) {
  const app = fastify({ logger: false });

  // One Session Supervisor per app: it owns every live PTY and outlives the
  // sockets that attach to it. Injectable so tests can drive a fake runner; in
  // production it wraps the node-pty LocalRunner over the DB-backed store.
  const supervisor =
    context.supervisor ??
    createSupervisor({
      runner: createLocalRunner(),
      store: createDbSessionStore(context.db),
    });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    console.error(error);
    reply.status(500).send({ error: 'internal error' });
  });

  registerProjectsRoutes(app, context);
  registerSchemaRoutes(app, context);
  registerSchemesRoutes(app, context);
  registerTicketsRoutes(app, context);
  registerCommentsRoutes(app, context);
  registerLinksRoutes(app, context);
  registerUsersRoutes(app, context);
  registerViewsRoutes(app, context);
  registerVocabularyRoutes(app, context);
  registerAiRoutes(app, { db: context.db, supervisor });

  return app;
}
