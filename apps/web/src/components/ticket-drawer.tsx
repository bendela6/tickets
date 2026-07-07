import { useEffect } from 'react';
import type { Board, BoardTicket } from '../api/types';
import type { BoardIndexes } from '../utils/index-board';
import { TicketDetail } from './ticket-detail';

// Right-side peek panel over the board: scrim + fixed full-height drawer
// (620px from md up, full-screen sheet below md per the mobile design).
// Esc closes; the board behind stays mounted.
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
      <div aria-hidden className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside
        aria-label="Ticket detail"
        className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-hairline bg-raised font-sans text-ink shadow-lg md:w-155 md:max-w-[calc(100vw-3rem)]"
      >
        {/* Keyed so switching tickets in-place resets edit drafts and tab state. */}
        <TicketDetail
          key={ticket.id}
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
