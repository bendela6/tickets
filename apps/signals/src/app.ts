import fastify from 'fastify';
import type { Db } from './db/client';
import { HttpError } from './errors';
import { registerAppsRoutes } from './routes/apps.routes';

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

  app.get('/health', async () => ({ ok: true }));

  registerAppsRoutes(app, context);

  return app;
}
