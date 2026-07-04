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
    return <p style={{ color: 'var(--critical)' }}>No ticket #{number} in this project.</p>;
  }
  return (
    <section className="card" style={{ maxWidth: 860 }}>
      <TicketDetail
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        ticket={ticket}
        variant="page"
      />
    </section>
  );
}

export const ticketPageRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 't/$number',
  component: TicketPageScreen,
});
