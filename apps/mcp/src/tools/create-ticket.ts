import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../actor';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { encodeValues } from '../helpers/rich-content';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';

export function registerCreateTicket(server: McpServer, context: ToolContext) {
  server.registerTool(
    'create_ticket',
    {
      description:
        'Create a ticket. values is a map of field key to value (e.g. {"title": "...", "description": "markdown", "severity": "high", "epic": "..."}); required fields depend on the type (see get_board); status defaults to the initial one. Pass parentNumber to create a subtask under a parent ticket. Rich-text field values (e.g. description) are markdown by default; pass format: "rich" to submit serialized tiptap docs verbatim.',
      inputSchema: {
        projectKey: z.string(),
        typeKey: z.string(),
        values: z.record(z.string(), z.unknown()),
        parentNumber: z.number().int().optional(),
        format: z.enum(['markdown', 'rich']).optional(),
      },
    },
    ({ projectKey, typeKey, values, parentNumber, format }) =>
      runTool(async () => {
        const { actorId } = await context.getActor();
        const board = await loadBoard(projectKey);
        let parentId: number | undefined;
        if (parentNumber !== undefined) {
          parentId = resolveTicket(board, parentNumber).id;
        }
        const created = await apiFetch<{ id: number; number: number }>(
          `/api/projects/${encodeURIComponent(projectKey)}/tickets`,
          {
            method: 'POST',
            body: JSON.stringify({
              actorId,
              typeKey,
              ...(parentId !== undefined ? { parentId } : {}),
              values: encodeValues(values, board.fields, format ?? 'markdown'),
            }),
          },
        );
        return toText({ created: true, ticketNumber: created.number });
      }),
  );
}
