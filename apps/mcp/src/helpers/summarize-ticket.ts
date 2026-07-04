import type { Board, BoardTicket } from '../types';

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
  return {
    number: ticket.number,
    type: type?.key ?? '?',
    ...restValues,
    parentNumber: parent,
    children: children.length > 0 ? children.map((child) => child.number) : undefined,
    blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    commentCount: ticket.comments.length > 0 ? ticket.comments.length : undefined,
    archived: ticket.archivedAt !== null ? true : undefined,
  };
}
