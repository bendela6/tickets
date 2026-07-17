import fastify from 'fastify';
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

export function buildApp(context: {
  db: Db;
  agentDriver?: AgentDriver;
  providers?: ProviderRegistry;
  worktrees?: WorktreeManager;
  terminalDriver?: TerminalDriver;
}) {
  const app = fastify({ logger: false });

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
