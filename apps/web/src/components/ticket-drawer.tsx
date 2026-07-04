import { useEffect } from 'react';
import type { Board, BoardTicket } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';
import { TicketDetail } from './ticket-detail';

export function TicketDrawer({
  projectKey,
  board,
  indexes,
  ticket,
  onClose,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="overlay open" onClick={onClose} />
      <aside className="drawer open" aria-label="Ticket detail">
        <TicketDetail
          projectKey={projectKey}
          board={board}
          indexes={indexes}
          ticket={ticket}
          variant="drawer"
          onClose={onClose}
        />
      </aside>
    </>
  );
}
