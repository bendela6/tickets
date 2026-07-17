import fastify from 'fastify';
import type { Db } from '@tickets/db';
import { registerAiSocket } from './ai/ai-socket';
import { createDbSessionStore } from './ai/db-session-store';
import { createLocalRunner } from './ai/local-runner';
import { createProviderRegistry, type ProviderRegistry } from './ai/provider-registry';
import { createClaudeProvider } from './ai/providers/claude-provider';
import { createSupervisor, type Supervisor } from './ai/supervisor';
import { createLocalWorktreeManager, type WorktreeManager } from './ai/worktree';
import { HttpError } from './errors';
import { registerActivityRoutes } from './routes/activity.routes';
import { registerAiRoutes } from './routes/ai.routes';
import { registerBoardRoutes } from './routes/board.routes';
import { registerItemsRoutes } from './routes/items.routes';
import { registerLinksRoutes } from './routes/links.routes';
import { registerProjectsRoutes } from './routes/projects.routes';
import { registerSchemaRoutes } from './routes/schema.routes';
import { registerSchemesRoutes } from './routes/schemes.routes';
import { registerUsersRoutes } from './routes/users.routes';
import { registerViewsRoutes } from './routes/views.routes';
import { registerVocabularyRoutes } from './routes/vocabulary.routes';

export function buildApp(context: {
  db: Db;
  supervisor?: Supervisor;
  providers?: ProviderRegistry;
  worktrees?: WorktreeManager;
}) {
  const app = fastify({ logger: false });

  // One Session Supervisor per app: it owns every live PTY and outlives the
  // sockets that attach to it. Injectable so tests can drive a fake runner; in
  // production it wraps the node-pty LocalRunner over the DB-backed store.
  const supervisor =
    context.supervisor ??
    (() => {
      const store = createDbSessionStore(context.db);
      // Sessions left running/live/etc. with no ended_at were orphaned by an
      // API restart (their pty/agent process is gone) — reconcile once at
      // boot. Only for the real supervisor: tests that inject a fake one keep
      // their seeded rows untouched.
      void store.reconcileOrphaned()
        .then((n) => { if (n > 0) app.log.info({ reconciled: n }, 'marked orphaned sessions disconnected'); })
        .catch((err) => app.log.error({ err }, 'orphan reconcile failed'));
      return createSupervisor({
        runner: createLocalRunner(),
        store,
      });
    })();

  // The agent provider registry (code registry, not DB rows). Injectable so
  // tests supply a fake provider; production ships the Claude adapter.
  const providers = context.providers ?? createProviderRegistry([createClaudeProvider()]);

  // Git worktree manager for isolating dispatched runs (TIX-206/208). Injectable
  // so tests exercise dispatch without touching a real repo.
  const worktrees = context.worktrees ?? createLocalWorktreeManager();

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    console.error(error);
    reply.status(500).send({ error: 'internal error' });
  });

  registerProjectsRoutes(app, context);
  registerUsersRoutes(app, context);
  registerItemsRoutes(app, context);
  registerActivityRoutes(app, context);
  registerLinksRoutes(app, context);
  registerBoardRoutes(app, context);
  registerVocabularyRoutes(app, context);
  registerSchemesRoutes(app, context);
  registerViewsRoutes(app, context);
  registerSchemaRoutes(app);
  registerAiRoutes(app, { db: context.db, supervisor, providers, worktrees });
  registerAiSocket(app, { supervisor });

  return app;
}
