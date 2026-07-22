import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../actor';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';

export function registerLinkTickets(server: McpServer, context: ToolContext) {
  server.registerTool(
    'link_tickets',
    {
      description:
        'Relate two tickets. Reads as "source <linkType> target", e.g. blocks: sourceNumber blocks targetNumber (the target cannot proceed until the source is done). Cycles in directional link types are rejected.',
      inputSchema: {
        projectKey: z.string(),
        linkTypeKey: z.string(),
        sourceNumber: z.number().int(),
        targetNumber: z.number().int(),
      },
    },
    ({ projectKey, linkTypeKey, sourceNumber, targetNumber }) =>
      runTool('link_tickets', async () => {
        const { actorId } = await context.getActor();
        const board = await loadBoard(projectKey);
        const source = resolveTicket(board, sourceNumber);
        const target = resolveTicket(board, targetNumber);
        await apiFetch('/api/links', {
          method: 'POST',
          body: JSON.stringify({
            actorId,
            linkTypeKey,
            sourceTicketId: source.id,
            targetTicketId: target.id,
          }),
        });
        return toText({ linked: true, relation: `${sourceNumber} ${linkTypeKey} ${targetNumber}` });
      }),
  );
}
