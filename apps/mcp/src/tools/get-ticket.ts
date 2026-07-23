import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiFetch } from '../api-client';
import { loadBoard } from '../helpers/load-board';
import { decodeBody, decodeValues } from '../helpers/rich-content';
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
        'Full detail for one ticket: every field value including the description, comments with authors, links with direction labels, children, and the 10 most recent events. Read this before working a ticket. Rich-text values and comment bodies come back as markdown by default; pass format: "rich" to get serialized tiptap docs verbatim.',
      inputSchema: {
        projectKey: z.string(),
        ticketNumber: z.number().int(),
        format: z.enum(['markdown', 'rich']).optional(),
      },
    },
    ({ projectKey, ticketNumber, format }) =>
      runTool(async () => {
        const resolvedFormat = format ?? 'markdown';
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
        const decodedValues = decodeValues(ticket.values, board.fields, resolvedFormat);
        return toText({
          ...summarizeTicket(board, { ...ticket, values: decodedValues }),
          description: decodedValues['description'] ?? null,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          comments: ticket.comments.map((comment) => ({
            by: userName(comment.authorId),
            at: comment.createdAt,
            body: decodeBody(comment.body, resolvedFormat),
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
