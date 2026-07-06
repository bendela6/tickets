import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../actor';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';

export function registerAddComment(server: McpServer, context: ToolContext) {
  server.registerTool(
    'add_comment',
    {
      description: 'Add a markdown comment to a ticket, attributed to the configured actor.',
      inputSchema: {
        projectKey: z.string(),
        ticketNumber: z.number().int(),
        body: z.string().min(1),
      },
    },
    ({ projectKey, ticketNumber, body }) =>
      runTool(async () => {
        const { actorId } = await context.getActor();
        const board = await loadBoard(projectKey);
        const ticket = resolveTicket(board, ticketNumber);
        await apiFetch(`/api/tickets/${ticket.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ authorId: actorId, body }),
        });
        return toText({ commented: true, ticketNumber });
      }),
  );
}
