import { resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@tickets/db';
import { agentAgents, agentSessions, items } from '@tickets/db';
import { itemAgentDispatched } from '../command/item/agent-dispatched';
import { itemComment } from '../command/item/comment';
import { runCommand } from '../command/run-command';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { buildRunSpec } from './agent-run-spec';
import { dispatchComment } from './dispatch-comment';
import type { AgentDriver } from './driver';
import { loadRunnableWorkdir } from './load-workdir';
import type { ProviderRegistry } from './provider-registry';
import { worktreeName, type WorktreeManager } from './worktree';

// Cap on concurrent dispatched runs so a fan-out can't spawn unbounded worktrees
// + agent processes.
const MAX_CONCURRENT_DISPATCHES = 4;

const dispatchSchema = v.object({
  agentId: v.pipe(v.number(), v.integer()),
  itemId: v.pipe(v.number(), v.integer()),
  prompt: v.pipe(v.string(), v.minLength(1)),
  parentSessionId: v.optional(v.pipe(v.number(), v.integer())),
  workdirId: v.optional(v.pipe(v.number(), v.integer())),
  maxBudgetUsd: v.optional(v.number()),
  // Who initiated the dispatch (a human, or a parent agent's user). Defaults to
  // the dispatched agent's own user for attribution.
  actorId: v.optional(v.pipe(v.number(), v.integer())),
});

// Put an agent on an item — the one route in this module. Registered
// separately from routes.ts so the orchestration (worktree isolation,
// concurrency cap, comment-back) stays out of the CRUD file.
export function registerAgentDispatchRoute(
  app: FastifyInstance,
  context: { db: Db; driver: AgentDriver; providers: ProviderRegistry; worktrees: WorktreeManager },
): void {
  const { db, driver, providers, worktrees } = context;
  // Per-app dispatch concurrency counter.
  let activeDispatches = 0;

  const dispatch = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(dispatchSchema, request.body);
    if (activeDispatches >= MAX_CONCURRENT_DISPATCHES) {
      throw new HttpError(429, `dispatch limit reached (${MAX_CONCURRENT_DISPATCHES} concurrent)`);
    }
    const [agent] = await db.select().from(agentAgents).where(eq(agentAgents.id, body.agentId));
    if (!agent) throw new HttpError(404, 'agent not found');
    const [item] = await db.select({ id: items.id }).from(items).where(eq(items.id, body.itemId));
    if (!item) throw new HttpError(404, 'item not found');
    const workdirId = body.workdirId ?? agent.defaultWorkdirId;
    if (workdirId == null) throw new HttpError(400, 'no workdir — set the agent default or pass workdirId');
    const provider = providers.get(agent.providerKey);
    if (!provider) throw new HttpError(400, `unknown provider "${agent.providerKey}"`);
    const workdir = await loadRunnableWorkdir(db, workdirId);

    // Child session first, so its id names the worktree.
    const [session] = await db
      .insert(agentSessions)
      .values({
        title: `${agent.name} · ${body.itemId}`,
        workdirId: workdir.id,
        agentId: agent.id,
        parentSessionId: body.parentSessionId ?? null,
        itemId: body.itemId,
        status: 'starting',
        cwd: workdir.path,
      })
      .returning();

    // The "an agent is on this" signal — an item.agent_dispatched event via
    // the command pipeline (routes may not write events directly; see
    // command/no-raw-writes.test.ts).
    await runCommand(
      db,
      itemAgentDispatched,
      { commandId: uuidv4(), actorId: body.actorId ?? agent.userId },
      { itemId: body.itemId, sessionId: session!.id, agentId: agent.id },
    );

    // Isolated git worktree so parallel dispatches don't collide. Best-effort:
    // a non-git workdir just runs in place.
    let worktreePath: string | null = null;
    let cwd = workdir.path;
    try {
      const branch = worktreeName(session!.id, `i${body.itemId}`);
      const path = resolve(workdir.path, '..', `${workdir.name}-s${session!.id}`);
      const created = await worktrees.create({ repoPath: workdir.path, branch, path });
      worktreePath = created.path;
      cwd = created.path;
      await db
        .update(agentSessions)
        .set({ cwd, worktreePath })
        .where(eq(agentSessions.id, session!.id));
    } catch {
      // not a git repo / worktree unavailable — run in the workdir
    }

    activeDispatches += 1;
    const run = provider.start(buildRunSpec(agent, cwd, { maxBudgetUsd: body.maxBudgetUsd }));
    driver.start({
      id: session!.id,
      run,
      maxBudgetUsd: body.maxBudgetUsd,
      onEnd: async () => {
        activeDispatches = Math.max(0, activeDispatches - 1);
        if (worktreePath) await worktrees.remove(worktreePath).catch(() => {});
        const [final] = await db
          .select({ status: agentSessions.status, costUsd: agentSessions.costUsd })
          .from(agentSessions)
          .where(eq(agentSessions.id, session!.id));
        if (!final) return;
        // Comment the outcome back on the item. The platform forbids routes
        // writing comments/events directly (command/no-raw-writes.test.ts) —
        // itemComment inserts the row and emits commentAdded in one command.
        await runCommand(
          db,
          itemComment,
          { commandId: uuidv4(), actorId: agent.userId },
          {
            itemId: body.itemId,
            body: dispatchComment(agent.name, final.status, final.costUsd, session!.id),
          },
        );
      },
    });
    driver.prompt(session!.id, body.prompt);
    reply.status(201).send(session);
  };

  app.post('/api/agent/dispatch', dispatch);
}
