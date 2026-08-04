import { useMemo } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { ItemDetail } from '../components/item-detail';
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
  const item = indexes.itemByNumber.get(Number(number));
  if (!item) {
    return (
      <p className="py-16 font-sans text-13/19 text-red-9">No item #{number} in this project.</p>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ItemDetail
        key={item.id}
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        item={item}
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
