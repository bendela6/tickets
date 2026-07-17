import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../actor';
import { apiFetch } from '../api-client';
import { environment } from '../environment';
import { loadBoard } from '../helpers/load-board';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';

// This is what lets an agent put another agent on a ticket. The MCP server
// already talks to the API over HTTP and resolves an actor, so dispatch needs no
// plumbing inside the agent process: it resolves the persona + ticket and POSTs
// /api/ai/dispatch, which creates the child session, isolates it in a worktree,
// and comments the result back. parent_session_id comes from AI_SESSION_ID when
// the caller is itself an agent session, so the sessions list nests as a tree.
export function registerDispatchAgent(server: McpServer, context: ToolContext) {
  server.registerTool(
    'dispatch_agent',
    {
      description:
        'Put an agent on a ticket: create a child agent session that works the ticket in its own git worktree and comments its result back when done. Use this to hand a well-scoped piece of work to a persona.',
      inputSchema: {
        agentKey: z.string().describe('key of the agent persona to dispatch (see the agent library)'),
        projectKey: z.string(),
        ticketNumber: z.number().int(),
        prompt: z.string().min(1).describe('the task for the dispatched agent'),
      },
    },
    ({ agentKey, projectKey, ticketNumber, prompt }) =>
      runTool(async () => {
        const { actorId } = await context.getActor();
        const board = await loadBoard(projectKey);
        const ticket = resolveTicket(board, ticketNumber);

        const agents = await apiFetch<{ id: number; key: string }[]>('/api/ai/agents');
        const agent = agents.find((a) => a.key === agentKey);
        if (!agent) {
          const known = agents.map((a) => a.key).join(', ') || 'none';
          throw new Error(`no agent with key "${agentKey}" (available: ${known})`);
        }

        const session = await apiFetch<{ id: number }>('/api/ai/dispatch', {
          method: 'POST',
          body: JSON.stringify({
            agentId: agent.id,
            ticketId: ticket.id,
            prompt,
            actorId,
            ...(environment.parentSessionId != null
              ? { parentSessionId: environment.parentSessionId }
              : {}),
          }),
        });

        return toText({
          dispatched: true,
          agentKey,
          ticket: `${board.project.ticketPrefix}-${ticketNumber}`,
          sessionId: session.id,
        });
      }),
  );
}
