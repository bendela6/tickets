import type { Board, BoardTicket, Status } from '../api/types';
import type { BoardIndexes } from './index-board';

// Mirrors the server's transition rule: zero edges in the project = anything
// goes; with edges, an update may only follow a matching from→to edge (the
// current status stays listed so the select shows where the ticket is).
export function legalStatusTargets(
  board: Board,
  indexes: BoardIndexes,
  ticket: BoardTicket | null,
): Status[] {
  const active = [...board.statuses]
    .filter((status) => !status.archivedAt)
    .sort((left, right) => left.position - right.position);
  if (board.transitions.length === 0) {
    return active;
  }
  if (!ticket || !indexes.statusField) {
    // creation: entry edges (from NULL) constrain when they exist at all
    const entryEdges = board.transitions.filter((edge) => edge.fromStatusId === null);
    if (entryEdges.length === 0) {
      return active;
    }
    return active.filter((status) => entryEdges.some((edge) => edge.toStatusId === status.id));
  }
  const currentKey = ticket.values[indexes.statusField.key];
  const current = typeof currentKey === 'string' ? indexes.statusByKey.get(currentKey) : undefined;
  const applicable = board.transitions.filter(
    (edge) => edge.ticketTypeId === null || edge.ticketTypeId === ticket.typeId,
  );
  const fromCurrent = applicable.filter((edge) => edge.fromStatusId === (current?.id ?? null));
  return active.filter(
    (status) =>
      status.id === current?.id || fromCurrent.some((edge) => edge.toStatusId === status.id),
  );
}
