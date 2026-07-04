import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, BoardTicket } from '../api/types';
import { usePatchTicket } from '../api/use-patch-ticket';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';
import { DetailActivity } from './detail-activity';
import { DetailChildren } from './detail-children';
import { DetailComments } from './detail-comments';
import { DetailFields } from './detail-fields';
import { DetailLinks } from './detail-links';
import { ValueBadge } from './value-badge';

// One detail component, two hosts: the drawer (peek) and the dedicated page.
export function TicketDetail({
  projectKey,
  board,
  indexes,
  ticket,
  variant,
  onClose,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
  variant: 'drawer' | 'page';
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const patch = usePatchTicket();
  const queryClient = useQueryClient();
  const type = indexes.typeById.get(ticket.typeId);
  const parent = ticket.parentId !== null ? indexes.ticketById.get(ticket.parentId) : null;

  const toggleArchived = () => {
    if (userId === null) {
      return;
    }
    patch.mutate(
      {
        ticketId: ticket.id,
        actorId: userId,
        expectedUpdatedAt: ticket.updatedAt,
        archived: ticket.archivedAt === null,
      },
      { onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }) },
    );
  };

  return (
    <>
      <div className="head">
        <span className="id">
          {board.project.ticketPrefix}-{String(ticket.number).padStart(3, '0')}
        </span>
        <ValueBadge label={type?.label ?? '?'} color={type?.config.color} />
        {parent ? (
          <button
            type="button"
            className="dep-badge"
            title={String(parent.values['title'] ?? '')}
            onClick={() =>
              void navigate({
                to: '.',
                search: (previous: Record<string, unknown>) => ({
                  ...previous,
                  t: parent.number,
                }),
              })
            }
          >
            ← {board.project.ticketPrefix}-{parent.number}
          </button>
        ) : null}
        {ticket.archivedAt ? <span className="badge">archived</span> : null}
        <span className="spacer" />
        <button type="button" className="btn" disabled={userId === null} onClick={toggleArchived}>
          {ticket.archivedAt ? 'Unarchive' : 'Archive'}
        </button>
        {variant === 'drawer' ? (
          <>
            <Link
              className="btn"
              to="/p/$projectKey/t/$number"
              params={{ projectKey, number: String(ticket.number) }}
            >
              Open page ↗
            </Link>
            <button type="button" className="btn" onClick={onClose}>
              Close ✕
            </button>
          </>
        ) : (
          <Link className="btn" to="/p/$projectKey" params={{ projectKey }}>
            ← Board
          </Link>
        )}
      </div>
      <div className="body">
        <DetailFields board={board} indexes={indexes} ticket={ticket} />
        {ticket.parentId === null ? (
          <DetailChildren projectKey={projectKey} board={board} indexes={indexes} ticket={ticket} />
        ) : null}
        <DetailLinks board={board} indexes={indexes} ticket={ticket} />
        <DetailComments indexes={indexes} ticket={ticket} />
        <DetailActivity ticket={ticket} />
      </div>
    </>
  );
}
