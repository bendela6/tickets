import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadBoard } from '../helpers/load-board';
import { runTool } from '../helpers/run-tool';
import { summarizeTicket } from '../helpers/summarize-ticket';
import { toText } from '../helpers/to-text';

export function registerGetBoard(server: McpServer) {
  server.registerTool(
    'get_board',
    {
      description:
        'Project orientation: vocabulary (ticket types, statuses with kinds, fields, epics, link types) plus one summary row per ticket (no descriptions or comments — use get_ticket for depth). Call this before working in a project.',
      inputSchema: { projectKey: z.string() },
    },
    ({ projectKey }) =>
      runTool(async () => {
        const board = await loadBoard(projectKey);
        const epicField = board.fields.find((field) => field.key === 'epic');
        return toText({
          project: board.project,
          types: board.types.filter((type) => !type.archivedAt).map((type) => type.key),
          statuses: board.statuses
            .filter((status) => !status.archivedAt)
            .map((status) => ({ key: status.key, kind: status.kind })),
          fields: board.fields
            .filter((field) => !field.archivedAt)
            .map((field) => ({
              key: field.key,
              type: field.type,
              options:
                field.options.length > 0
                  ? field.options
                      .filter((option) => !option.archivedAt)
                      .map((option) => option.value)
                  : undefined,
            })),
          epics: epicField?.options.map((option) => option.value) ?? [],
          linkTypes: board.linkTypes.map((linkType) => linkType.key),
          transitionCount: board.transitions.length,
          tickets: board.tickets
            .filter((ticket) => !ticket.archivedAt && ticket.parentId === null)
            .sort((left, right) => left.number - right.number)
            .map((ticket) => summarizeTicket(board, ticket)),
        });
      }),
  );
}
