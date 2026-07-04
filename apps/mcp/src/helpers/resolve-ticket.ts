import type { Board, BoardTicket } from '../types';

export function resolveTicket(board: Board, ticketNumber: number): BoardTicket {
  const ticket = board.tickets.find((candidate) => candidate.number === ticketNumber);
  if (!ticket) {
    throw new Error(
      `no ticket ${board.project.ticketPrefix}-${ticketNumber} in project "${board.project.key}"`,
    );
  }
  return ticket;
}
