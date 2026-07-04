import { useMemo } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { getCellContent } from '../registry/get-cell-content';
import { childProgress } from '../utils/child-progress';
import { compareTickets } from '../utils/compare-tickets';
import { indexBoard } from '../utils/index-board';
import { normalizeViewConfig } from '../utils/view-config';
import { KpiTiles } from './kpi-tiles';
import { ProgressCell } from './progress-cell';
import { TicketDrawer } from './ticket-drawer';
import { ValueBadge } from './value-badge';

export function BoardScreen() {
  const params = useParams({ strict: false }) as { projectKey?: string; viewId?: string };
  const search = useSearch({ strict: false }) as { t?: number };
  const navigate = useNavigate();
  const projectKey = params.projectKey ?? '';
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);

  if (!board || !indexes) {
    return null;
  }

  const view =
    board.views.find((candidate) => candidate.id === Number(params.viewId)) ?? board.views[0];
  const config = normalizeViewConfig(view?.config ?? {}, board);
  const visibleColumns = config.columns.filter((column) => column.hidden !== true);
  const rows = board.tickets
    .filter((ticket) => !ticket.archivedAt && ticket.parentId === null)
    .sort(compareTickets(indexes, config.sort));
  const openTicket = search.t !== undefined ? (indexes.ticketByNumber.get(search.t) ?? null) : null;

  const closeDrawer = () => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, t: undefined }),
    });
  };

  return (
    <>
      <KpiTiles board={board} indexes={indexes} />
      <section className="card">
        <div className="table-scroll">
          <table aria-label="Tickets">
            <thead>
              <tr>
                {visibleColumns.map((column, index) => {
                  const label =
                    column.source === 'number'
                      ? 'ID'
                      : column.source === 'type'
                        ? 'Type'
                        : column.source === 'progress'
                          ? 'Progress'
                          : (indexes.fieldById.get(column.fieldId)?.label ?? '?');
                  return (
                    <th key={index} style={column.width ? { width: column.width } : undefined}>
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() =>
                    void navigate({
                      to: '.',
                      search: (previous: Record<string, unknown>) => ({
                        ...previous,
                        t: ticket.number,
                      }),
                    })
                  }
                >
                  {visibleColumns.map((column, index) => {
                    if (column.source === 'number') {
                      return (
                        <td key={index} className="id">
                          {board.project.ticketPrefix}-{String(ticket.number).padStart(3, '0')}
                        </td>
                      );
                    }
                    if (column.source === 'type') {
                      const type = indexes.typeById.get(ticket.typeId);
                      return (
                        <td key={index}>
                          <ValueBadge label={type?.label ?? '?'} color={type?.config.color} />
                        </td>
                      );
                    }
                    if (column.source === 'progress') {
                      return (
                        <td key={index} className="progress-cell">
                          <ProgressCell {...childProgress(ticket, indexes)} />
                        </td>
                      );
                    }
                    const field = indexes.fieldById.get(column.fieldId);
                    if (!field) {
                      return <td key={index} />;
                    }
                    const isTitle = field.key === 'title';
                    return (
                      <td key={index} className={isTitle ? 'title-cell' : undefined}>
                        {getCellContent(field, ticket.values[field.key], indexes)}
                        {isTitle && ticket.comments.length > 0 ? (
                          <span className="comment-count">💬 {ticket.comments.length}</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="count-note">
          Showing {rows.length} tickets · view “{view?.name ?? '?'}”
        </div>
      </section>
      {openTicket ? (
        <TicketDrawer
          projectKey={projectKey}
          board={board}
          indexes={indexes}
          ticket={openTicket}
          onClose={closeDrawer}
        />
      ) : null}
    </>
  );
}
