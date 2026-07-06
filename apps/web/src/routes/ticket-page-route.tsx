import { useMemo } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { TicketDetail } from '../components/ticket-detail';
import { indexBoard } from '../utils/index-board';
import { projectRoute } from './project-route';

function TicketPageScreen() {
  const { projectKey, number } = ticketPageRoute.useParams();
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);
  if (!board || !indexes) {
    return null;
  }
  const ticket = indexes.ticketByNumber.get(Number(number));
  if (!ticket) {
    return (
      <p className="py-4 font-sans text-ui text-danger">No ticket #{number} in this project.</p>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <TicketDetail
        key={ticket.id}
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        ticket={ticket}
        variant="page"
      />
    </div>
  );
}

export const ticketPageRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 't/$number',
  component: TicketPageScreen,
});
