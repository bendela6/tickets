import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../actor';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';

export function registerCreateTicket(server: McpServer, context: ToolContext) {
  server.registerTool(
    'create_ticket',
    {
      description:
        'Create a ticket. values is a map of field key to value (e.g. {"title": "...", "description": "markdown", "severity": "high", "epic": "..."}); required fields depend on the type (see get_board); status defaults to the initial one. Pass parentNumber to create a subtask under a parent ticket.',
      inputSchema: {
        projectKey: z.string(),
        typeKey: z.string(),
        values: z.record(z.string(), z.unknown()),
        parentNumber: z.number().int().optional(),
      },
    },
    ({ projectKey, typeKey, values, parentNumber }) =>
      runTool(async () => {
        let parentId: number | undefined;
        if (parentNumber !== undefined) {
          const board = await loadBoard(projectKey);
          parentId = resolveTicket(board, parentNumber).id;
        }
        const created = await apiFetch<{ id: number; number: number }>(
          `/api/projects/${encodeURIComponent(projectKey)}/tickets`,
          {
            method: 'POST',
            body: JSON.stringify({
              actorId: context.actorId,
              typeKey,
              ...(parentId !== undefined ? { parentId } : {}),
              values,
            }),
          },
        );
        return toText({ created: true, ticketNumber: created.number });
      }),
  );
}
