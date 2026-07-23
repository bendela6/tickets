import type { Board, BoardTicket } from '../types';
import { searchableText } from './rich-content';

// The token-lean row shape get_board and search_tickets return: no
// descriptions, no comment bodies — agents fetch get_ticket for depth.
export function summarizeTicket(board: Board, ticket: BoardTicket) {
  const type = board.types.find((candidate) => candidate.id === ticket.typeId);
  const blocksType = board.linkTypes.find((candidate) => candidate.key === 'blocks');
  const blockedBy = ticket.links
    .filter(
      (link) =>
        blocksType !== undefined &&
        link.linkTypeId === blocksType.id &&
        link.targetTicketId === ticket.id,
    )
    .map((link) => board.tickets.find((candidate) => candidate.id === link.sourceTicketId)?.number)
    .filter((value): value is number => value !== undefined);
  const children = board.tickets.filter(
    (candidate) => candidate.parentId === ticket.id && !candidate.archivedAt,
  );
  const parent =
    ticket.parentId === null
      ? null
      : (board.tickets.find((candidate) => candidate.id === ticket.parentId)?.number ?? null);
  const { description: _description, ...restValues } = ticket.values;
  // Other string-valued fields (e.g. findings/steps) can also be stored as
  // serialized tiptap docs once written through the rich editor — flatten
  // them to plain text so summaries never leak raw doc JSON.
  const values: Record<string, unknown> = Object.fromEntries(
    Object.entries(restValues).map(
      ([key, value]): [string, unknown] => [
        key,
        typeof value === 'string' ? searchableText(value) : value,
      ],
    ),
  );
  return {
    number: ticket.number,
    type: type?.key ?? '?',
    ...values,
    parentNumber: parent,
    children: children.length > 0 ? children.map((child) => child.number) : undefined,
    blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    commentCount: ticket.comments.length > 0 ? ticket.comments.length : undefined,
    archived: ticket.archivedAt !== null ? true : undefined,
  };
}
