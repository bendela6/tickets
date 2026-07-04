import { useMemo } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { useViewConfig } from '../state/use-view-config';
import { compareTickets } from '../utils/compare-tickets';
import { evaluateFilters } from '../utils/evaluate-filters';
import { indexBoard } from '../utils/index-board';
import type { FilterRule } from '../utils/view-config';
import { BoardTable } from './board-table';
import { ColumnSettings } from './column-settings';
import { FilterBar } from './filter-bar';
import { KpiTiles } from './kpi-tiles';
import { TicketDrawer } from './ticket-drawer';

export function BoardScreen() {
  const params = useParams({ strict: false }) as { projectKey?: string; viewId?: string };
  const search = useSearch({ strict: false }) as { t?: number; q?: string; f?: FilterRule[] };
  const navigate = useNavigate();
  const projectKey = params.projectKey ?? '';
  const boardQuery = useBoard(projectKey);
  const board = boardQuery.data;
  const indexes = useMemo(() => (board ? indexBoard(board) : null), [board]);
  const view = board?.views.find((candidate) => candidate.id === Number(params.viewId));
  const { config, update } = useViewConfig(board, view);

  if (!board || !indexes) {
    return null;
  }

  const setSearch = (partial: Record<string, unknown>) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...partial }),
    });
  };

  const adHocRules = search.f;
  const effectiveRules = adHocRules ?? config.filters.rules;
  const query = search.q ?? '';
  const rows = board.tickets
    .filter((ticket) => !ticket.archivedAt && ticket.parentId === null)
    .filter((ticket) => evaluateFilters(effectiveRules, query, ticket, indexes))
    .sort(compareTickets(indexes, config.sort));
  const openTicket = search.t !== undefined ? (indexes.ticketByNumber.get(search.t) ?? null) : null;

  return (
    <>
      <KpiTiles board={board} indexes={indexes} />
      <FilterBar
        board={board}
        indexes={indexes}
        rules={effectiveRules}
        dirty={adHocRules !== undefined}
        query={query}
        onQueryChange={(next) => setSearch({ q: next.length > 0 ? next : undefined })}
        onRulesChange={(next) => setSearch({ f: next })}
        onSaveToView={() => {
          update((current) => ({ ...current, filters: { rules: effectiveRules } }));
          setSearch({ f: undefined });
        }}
        extraControls={<ColumnSettings indexes={indexes} config={config} onUpdate={update} />}
      />
      <BoardTable
        board={board}
        indexes={indexes}
        config={config}
        rows={rows}
        onUpdate={update}
        onOpenTicket={(ticketNumber) => setSearch({ t: ticketNumber })}
      />
      <div className="count-note">
        Showing {rows.length} tickets · view “{view?.name ?? '?'}”
        {adHocRules !== undefined ? ' · unsaved filters' : ''}
      </div>
      {openTicket ? (
        <TicketDrawer
          projectKey={projectKey}
          board={board}
          indexes={indexes}
          ticket={openTicket}
          onClose={() => setSearch({ t: undefined })}
        />
      ) : null}
    </>
  );
}
