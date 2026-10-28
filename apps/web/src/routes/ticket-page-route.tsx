import { useMemo } from 'react';
import { Navigate, createRoute } from '@tanstack/react-router';
import { ScreenState } from '@tilewise/ui';
import { useBoard } from '../api/use-board';
import { ItemDetail } from '../components/item-detail';
import { indexBoard } from '../utils/index-board';
import { projectRoute } from './project-route';

// An item's page, by its key: /p/tickets/t/TIX-90, /p/tk/t/TK-80.3, an epic's
// slash sent encoded (/p/tk/t/TK%2FE14). An old link by number
// (/p/tickets/t/90) is sent on to the item's key.
function TicketPageScreen() {
  const { projectKey, itemKey } = ticketPageRoute.useParams();
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);
  if (!board || !indexes) {
    return null;
  }
  const byNumber = /^\d+$/.test(itemKey) ? indexes.itemByNumber.get(Number(itemKey)) : undefined;
  if (byNumber) {
    return (
      <Navigate
        to="/p/$projectKey/t/$itemKey"
        params={{ projectKey, itemKey: byNumber.key }}
        replace
      />
    );
  }
  const item = indexes.itemByKey.get(itemKey);
  if (!item) {
    return <ScreenState tone="danger" icon="triangle-alert" title={`No item ${itemKey} in this project.`} />;
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
  path: 't/$itemKey',
  component: TicketPageScreen,
});
