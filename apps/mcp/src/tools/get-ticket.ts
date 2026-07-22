import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { resolveTicket } from '../helpers/resolve-ticket';
import { runTool } from '../helpers/run-tool';
import { summarizeTicket } from '../helpers/summarize-ticket';
import { toText } from '../helpers/to-text';
import type { TicketEvent } from '../types';

export function registerGetTicket(server: McpServer) {
  server.registerTool(
    'get_ticket',
    {
      description:
        'Full detail for one ticket: every field value including the markdown description, comments with authors, links with direction labels, children, and the 10 most recent events. Read this before working a ticket.',
      inputSchema: { projectKey: z.string(), ticketNumber: z.number().int() },
    },
    ({ projectKey, ticketNumber }) =>
      runTool('get_ticket', async () => {
        const board = await loadBoard(projectKey);
        const ticket = resolveTicket(board, ticketNumber);
        const events = await apiFetch<{ data: TicketEvent[] }>(
          `/api/tickets/${ticket.id}/events?take=10`,
        );
        const userName = (userId: number) =>
          board.users.find((user) => user.id === userId)?.name ?? `user ${userId}`;
        const links = ticket.links.map((link) => {
          const linkType = board.linkTypes.find((candidate) => candidate.id === link.linkTypeId);
          const outgoing = link.sourceTicketId === ticket.id;
          const otherId = outgoing ? link.targetTicketId : link.sourceTicketId;
          const other = board.tickets.find((candidate) => candidate.id === otherId);
          return {
            relation: outgoing ? (linkType?.label ?? '?') : (linkType?.inverseLabel ?? '?'),
            linkTypeKey: linkType?.key,
            ticketNumber: other?.number,
            title: other?.values['title'],
          };
        });
        return toText({
          ...summarizeTicket(board, ticket),
          description: ticket.values['description'] ?? null,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          comments: ticket.comments.map((comment) => ({
            by: userName(comment.authorId),
            at: comment.createdAt,
            body: comment.body,
          })),
          links,
          recentEvents: events.data.map((event) => ({
            kind: event.kind,
            by: event.actorName,
            at: event.createdAt,
            payload: event.payload,
          })),
        });
      }),
  );
}
