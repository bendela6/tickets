import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';
import type { TicketEvent } from '../types';

export function registerListTicketEvents(server: McpServer) {
  server.registerTool(
    'list_ticket_events',
    {
      description:
        'The audit trail of one ticket, newest first: who changed what and when (status flips, value edits, comments, links, archive).',
      inputSchema: {
        projectKey: z.string(),
        ticketNumber: z.number().int(),
        take: z.number().int().min(1).max(200).optional(),
      },
    },
    ({ projectKey, ticketNumber, take }) =>
      runTool(async () => {
        const board = await loadBoard(projectKey);
        const ticket = resolveTicket(board, ticketNumber);
        const events = await apiFetch<{ data: TicketEvent[]; meta: { total: number } }>(
          `/api/tickets/${ticket.id}/events?take=${take ?? 50}`,
        );
        return toText({
          total: events.meta.total,
          events: events.data.map((event) => ({
            kind: event.kind,
            by: event.actorName,
            at: event.createdAt,
            payload: event.payload,
          })),
        });
      }),
  );
}
