import fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import type { SignalsClient } from '@bendela6/signals-node';
import type { Db } from '@tickets/db';
import { createAgentStore } from './agent/store';
import { createAgentDriver, type AgentDriver } from './agent/driver';
import { registerAgentDispatchRoute } from './agent/dispatch';
import { createProviderRegistry, type ProviderRegistry } from './agent/provider-registry';
import { createClaudeProvider } from './agent/providers/claude-provider';
import { registerAgentRoutes } from './agent/routes';
import { registerAgentSocket } from './agent/socket';
import { createLocalWorktreeManager, type WorktreeManager } from './agent/worktree';
import { HttpError } from './errors';
import { registerActivityRoutes } from './routes/activity.routes';
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
import { createTerminalDriver, type TerminalDriver } from './terminal/driver';
import { createLocalRunner } from './terminal/local-runner';
import { registerTerminalRoutes } from './terminal/routes';
import { registerTerminalSocket } from './terminal/socket';
import { createTerminalStore } from './terminal/store';
import { registerWorkdirRoutes } from './workdir/routes';

// One Signals issue per (method, matched route pattern, status) rather than
// per concrete request — request.routeOptions.url is fastify's matched
// pattern (e.g. "/api/items/:id"), stable across every interpolated id/key,
// unlike the HttpError message (~85 throw sites, many interpolate an
// identifier into the message) or the raw request.url (also per-identifier).
// Falls back to request.url if routeOptions is ever unavailable (defensive —
// it is always set for a matched route in fastify v5).
function routeFingerprint(status: number, request: FastifyRequest): string {
  const routePattern = request.routeOptions?.url ?? request.url;
  return `http-${status}-${request.method}-${routePattern}`;
}

export function buildApp(context: {
  db: Db;
  agentDriver?: AgentDriver;
  providers?: ProviderRegistry;
  worktrees?: WorktreeManager;
  terminalDriver?: TerminalDriver;
  // Signals client for self-monitoring — undefined in most tests, real
  // client in production (or a fake in tests exercising the error hook).
  signals?: SignalsClient | null;
}) {
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

  // The agent provider registry (code registry, not DB rows). Injectable so
  // tests supply a fake provider; production ships the Claude adapter.
  const providers = context.providers ?? createProviderRegistry([createClaudeProvider()]);

  // Git worktree manager for isolating dispatched runs. Injectable so tests
  // exercise dispatch without touching a real repo.
  const worktrees = context.worktrees ?? createLocalWorktreeManager();

  // The Agent Driver: a full independent sibling of the Terminal Driver below
  // — it owns agent.* runs over the agent schema and knows nothing about
  // PTYs/shells/terminal output. Injectable so tests can drive a fake
  // provider or a fake driver entirely; in production it wraps the
  // DB-backed AgentStore.
  const agentDriver =
    context.agentDriver ??
    (() => {
      const store = createAgentStore(context.db);
      // Sessions left starting/running/idle/awaiting_input/interrupted with
      // no ended_at were orphaned by an API restart (their process is gone)
      // — reconcile once at boot. Only for the real driver: tests that
      // inject a fake one keep their seeded rows untouched.
      void store
        .reconcileOrphaned()
        .then((n) => {
          if (n > 0) app.log.info({ reconciled: n }, 'marked orphaned agent sessions interrupted');
        })
        .catch((err) => app.log.error({ err }, 'agent orphan reconcile failed'));
      return createAgentDriver({ store });
    })();

  // The Terminal Driver: a full independent sibling of the Agent Driver
  // above — it owns terminal.* PTYs over the terminal schema and knows
  // nothing about agents/providers/messages/permissions/cost/dispatch.
  // Injectable so tests can drive a fake runner or a fake driver entirely; in
  // production it wraps the node-pty LocalRunner over the DB-backed
  // TerminalStore.
  const terminalDriver =
    context.terminalDriver ??
    (() => {
      const store = createTerminalStore(context.db);
      // Sessions left starting/live with no ended_at were orphaned by an API
      // restart (their pty process is gone) — reconcile once at boot. Only
      // for the real driver: tests that inject a fake one keep their seeded
      // rows untouched.
      void store.reconcileOrphaned()
        .then((n) => { if (n > 0) app.log.info({ reconciled: n }, 'marked orphaned terminal sessions disconnected'); })
        .catch((err) => app.log.error({ err }, 'terminal orphan reconcile failed'));
      return createTerminalDriver({
        runner: createLocalRunner(),
        store,
      });
    })();

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      // Expected client errors (4xx) — still worth visibility as a warning-level
      // Signal (a spike of 404s/409s is a real product signal), just not at
      // error severity like a genuine 500. Fingerprint on the ROUTE PATTERN,
      // not the (often per-identifier-interpolated) message — otherwise
      // "item 17 not found" and "item 18 not found" become two issues
      // instead of one. request.routeOptions.url is the matched pattern
      // (e.g. "/api/items/:id"), stable across every concrete id.
      context.signals?.captureError(error, {
        level: 'warning',
        mechanism: 'middleware',
        fingerprint: routeFingerprint(error.statusCode, request),
        contexts: { http: { method: request.method, url: request.url, status: error.statusCode } },
      });
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    // Fastify's own errors (body-parser, payload-too-large, content-type,
    // etc.) carry a statusCode without being our HttpError — pass the real
    // status through instead of flattening every non-HttpError into 500, and
    // capture it as a warning like any other expected 4xx (same route-pattern
    // fingerprinting as the HttpError branch above).
    const fastifyErr = error as { statusCode?: number; message?: string };
    const fastifyStatus = fastifyErr.statusCode;
    if (typeof fastifyStatus === 'number' && fastifyStatus < 500) {
      context.signals?.captureError(error, {
        level: 'warning',
        mechanism: 'middleware',
        fingerprint: routeFingerprint(fastifyStatus, request),
        contexts: { http: { method: request.method, url: request.url, status: fastifyStatus } },
      });
      reply.status(fastifyStatus).send({ error: fastifyErr.message ?? 'request failed' });
      return;
    }
    console.error(error);
    // Genuine 500s keep natural (stack-based) fingerprinting — a route
    // pattern would over-group distinct bugs that happen to share a route.
    context.signals?.captureError(error, {
      level: 'error',
      mechanism: 'middleware',
      contexts: { http: { method: request.method, url: request.url, status: 500 } },
    });
    reply.status(500).send({ error: 'internal error' });
  });

  // Fastify's own not-found handling bypasses setErrorHandler entirely, so an
  // unmatched route (a typo'd path, a stale client, a probe) would otherwise
  // never reach Signals. One stable fingerprint for ALL unmatched routes —
  // there is no route pattern to group by here, and per-path fingerprints
  // would explode identically to the interpolated-message problem above.
  app.setNotFoundHandler((request, reply) => {
    context.signals?.captureError(new Error(`route not found: ${request.method} ${request.url}`), {
      level: 'warning',
      mechanism: 'middleware',
      fingerprint: 'http-404-unmatched',
      contexts: { http: { method: request.method, url: request.url, status: 404 } },
    });
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
  registerSchemaRoutes(app);
  // Workdirs mount independently of both drivers: `core.workdirs` is a core
  // concept both subsystems consume, so neither may own its CRUD — mounting it
  // inside one would silently make unmounting that one break the other.
  registerWorkdirRoutes(app, { db: context.db });
  registerAgentRoutes(app, { db: context.db, driver: agentDriver, providers });
  registerAgentDispatchRoute(app, { db: context.db, driver: agentDriver, providers, worktrees });
  registerAgentSocket(app, { driver: agentDriver });
  registerTerminalRoutes(app, { db: context.db, driver: terminalDriver });
  registerTerminalSocket(app, { driver: terminalDriver });

  return app;
}
