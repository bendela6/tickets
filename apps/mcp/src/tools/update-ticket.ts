import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../actor';
import { loadBoard } from '../helpers/load-board';
import { patchTicketWithRetry } from '../helpers/patch-ticket-with-retry';
import { encodeValues } from '../helpers/rich-content';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';

export function registerUpdateTicket(server: McpServer, context: ToolContext) {
  server.registerTool(
    'update_ticket',
    {
      description:
        'Update ticket field values (e.g. {"status": "in-progress"} or {"title": "..."}; null clears a field), move it under a parent (parentNumber, null to detach), or archive/unarchive. Concurrency is handled internally. Status changes are validated against the workflow graph — a 422 error names the illegal move. Rich-text field values are markdown by default; pass format: "rich" to submit serialized tiptap docs verbatim.',
      inputSchema: {
        projectKey: z.string(),
        ticketNumber: z.number().int(),
        values: z.record(z.string(), z.unknown()).optional(),
        parentNumber: z.number().int().nullable().optional(),
        archived: z.boolean().optional(),
        format: z.enum(['markdown', 'rich']).optional(),
      },
    },
    ({ projectKey, ticketNumber, values, parentNumber, archived, format }) =>
      runTool(async () => {
        const { actorId } = await context.getActor();
        const body: Record<string, unknown> = {};
        const needsBoard = values !== undefined || (parentNumber !== undefined && parentNumber !== null);
        const board = needsBoard ? await loadBoard(projectKey) : undefined;
        if (values !== undefined && board) {
          body.values = encodeValues(values, board.fields, format ?? 'markdown');
        }
        if (parentNumber !== undefined) {
          if (parentNumber === null) {
            body.parentId = null;
          } else if (board) {
            body.parentId = resolveTicket(board, parentNumber).id;
          }
        }
        if (archived !== undefined) {
          body.archived = archived;
        }
        const result = await patchTicketWithRetry(actorId, projectKey, ticketNumber, body);
        return toText({ updated: true, ticketNumber, updatedAt: result.updatedAt });
      }),
  );
}
