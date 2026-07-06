import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../actor';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';

export function registerRemoveLink(server: McpServer, context: ToolContext) {
  server.registerTool(
    'remove_link',
    {
      description: 'Remove an existing relation between two tickets (same shape as link_tickets).',
      inputSchema: {
        projectKey: z.string(),
        linkTypeKey: z.string(),
        sourceNumber: z.number().int(),
        targetNumber: z.number().int(),
      },
    },
    ({ projectKey, linkTypeKey, sourceNumber, targetNumber }) =>
      runTool(async () => {
        const { actorId } = await context.getActor();
        const board = await loadBoard(projectKey);
        const source = resolveTicket(board, sourceNumber);
        const target = resolveTicket(board, targetNumber);
        const linkType = board.linkTypes.find((candidate) => candidate.key === linkTypeKey);
        if (!linkType) {
          throw new Error(`unknown link type "${linkTypeKey}"`);
        }
        const link = source.links.find(
          (candidate) =>
            candidate.linkTypeId === linkType.id &&
            candidate.sourceTicketId === source.id &&
            candidate.targetTicketId === target.id,
        );
        if (!link) {
          throw new Error(`no ${linkTypeKey} link from ${sourceNumber} to ${targetNumber}`);
        }
        await apiFetch(`/api/links/${link.id}?actorId=${actorId}`, { method: 'DELETE' });
        return toText({ removed: true });
      }),
  );
}
