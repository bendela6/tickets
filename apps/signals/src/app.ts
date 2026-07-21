import fastify, { type FastifyError } from 'fastify';
import type { Db } from './db/client';
import { HttpError } from './errors';
import { createRateLimiter, type RateLimiter } from './rate-limit';
import { registerAppsRoutes } from './routes/apps.routes';
import { registerIngestRoutes } from './routes/ingest.routes';
import { registerIssuesRoutes } from './routes/issues.routes';
import { registerSdkRoutes } from './routes/sdk.routes';
import { registerSessionsRoutes } from './routes/sessions.routes';
import { registerSourcemapRoutes } from './routes/sourcemaps.routes';

export function buildApp(context: { db: Db; rateLimiter?: RateLimiter }) {
  const app = fastify({ logger: false });
  const rateLimiter = context.rateLimiter ?? createRateLimiter();

  // navigator.sendBeacon() has no way to set a request content-type, so it
  // always sends its Blob/string body as `text/plain` — the browser SDK's
  // flush-on-hide path (packages/signals/browser/src/instrument.ts) relies on
  // this. Parse it the same way as JSON; a body that isn't valid JSON becomes
  // `undefined`, which then fails valibot validation as a normal 400 rather
  // than crashing the parser (and the request) with a 500.
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(null, undefined);
    }
  });

  // Ingest is cross-origin by design: browser SDKs on other sites post here.
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/ingest/')) {
      reply.header('access-control-allow-origin', '*');
      reply.header('access-control-allow-headers', 'content-type');
      reply.header('access-control-allow-methods', 'POST, OPTIONS');
    }
    return payload;
  });

  app.setErrorHandler((error: FastifyError | HttpError, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    // Fastify's body parser (and other framework-level validation) throws
    // plain errors carrying a numeric statusCode — e.g. malformed JSON is
    // a 400, not a server error. Respect those; only 5xx/unlabeled errors
    // are truly "internal".
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    console.error(error);
    reply.status(500).send({ error: 'internal error' });
  });

  app.get('/health', async () => ({ ok: true }));

  registerAppsRoutes(app, context);
  registerIngestRoutes(app, { db: context.db, rateLimiter });
  registerIssuesRoutes(app, context);
  registerSdkRoutes(app);
  registerSessionsRoutes(app, context);
  registerSourcemapRoutes(app, context);

  return app;
}
