import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadBoard } from '../helpers/load-board';
import { searchableText } from '../helpers/rich-content';
import { runTool } from '../helpers/run-tool';
import { summarizeTicket } from '../helpers/summarize-ticket';
import { toText } from '../helpers/to-text';

export function registerSearchTickets(server: McpServer) {
  server.registerTool(
    'search_tickets',
    {
      description:
        "Filter a project's tickets by free-text query (matches all field values), status kinds (todo/active/blocked/done/dropped), specific status keys, epic, or ticket type. Returns summary rows.",
      inputSchema: {
        projectKey: z.string(),
        query: z.string().optional(),
        statusKinds: z.array(z.string()).optional(),
        statuses: z.array(z.string()).optional(),
        epic: z.string().optional(),
        typeKey: z.string().optional(),
        includeArchived: z.boolean().optional(),
      },
    },
    ({ projectKey, query, statusKinds, statuses, epic, typeKey, includeArchived }) =>
      runTool('search_tickets', async () => {
        const board = await loadBoard(projectKey);
        const statusField = board.fields.find((field) => field.type === 'status');
        const matches = board.tickets
          .filter((ticket) => (includeArchived === true ? true : !ticket.archivedAt))
          .filter((ticket) => {
            if (typeKey) {
              const type = board.types.find((candidate) => candidate.id === ticket.typeId);
              if (type?.key !== typeKey) {
                return false;
              }
            }
            const statusKey = statusField ? String(ticket.values[statusField.key] ?? '') : '';
            if (statuses && statuses.length > 0 && !statuses.includes(statusKey)) {
              return false;
            }
            if (statusKinds && statusKinds.length > 0) {
              const kind = board.statuses.find((candidate) => candidate.key === statusKey)?.kind;
              if (!kind || !statusKinds.includes(kind)) {
                return false;
              }
            }
            if (epic && String(ticket.values['epic'] ?? '') !== epic) {
              return false;
            }
            if (query) {
              const haystack = [
                String(ticket.number),
                ...Object.values(ticket.values).map((value) =>
                  typeof value === 'string' ? searchableText(value) : value,
                ),
              ]
                .join(' ')
                .toLowerCase();
              if (!haystack.includes(query.toLowerCase())) {
                return false;
              }
            }
            return true;
          })
          .sort((left, right) => left.number - right.number);
        return toText({
          total: matches.length,
          tickets: matches.map((ticket) => summarizeTicket(board, ticket)),
        });
      }),
  );
}
