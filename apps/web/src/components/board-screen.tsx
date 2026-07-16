import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useBoard } from '../api/use-board';
import { useViewConfig } from '../state/use-view-config';
import { compareTickets } from '../utils/compare-tickets';
import { evaluateFilters } from '../utils/evaluate-filters';
import { indexBoard } from '../utils/index-board';
import type { FilterRule } from '../utils/view-config';
import { BoardHeader } from './board/board-header';
import { FilterChips } from './board/filter-chips';
import { KpiStrip } from './board/kpi-strip';
import { TableView } from './board/table-view';
import { KanbanView } from './kanban-view';
import { NewItemDialog } from './new-item-dialog';
import { TicketDrawer } from './ticket-drawer';

// The board area of a view route: header, filter chips, KPI strip, then the
// mode-selected renderer (table or kanban). Ad-hoc state rides the URL
// (q = title query, f = unsaved filter rules, t = drawer ticket number);
// everything else persists into the view config.
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
  const [creating, setCreating] = useState(false);

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
  const topLevel = board.tickets.filter((ticket) => !ticket.archivedAt && ticket.parentId === null);
  const rows = topLevel
    .filter((ticket) => evaluateFilters(effectiveRules, query, ticket, indexes))
    .sort(compareTickets(indexes, config.sort));
  const openTicket = search.t !== undefined ? (indexes.ticketByNumber.get(search.t) ?? null) : null;

  const doneCount = topLevel.filter((ticket) => {
    const raw = indexes.statusField ? ticket.values[indexes.statusField.key] : undefined;
    return typeof raw === 'string' && indexes.statusByKey.get(raw)?.kind === 'done';
  }).length;
  const donePercent = topLevel.length > 0 ? Math.round((doneCount / topLevel.length) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BoardHeader
        board={board}
        indexes={indexes}
        ticketCount={topLevel.length}
        donePercent={donePercent}
        query={query}
        onQueryChange={(next) => setSearch({ q: next.length > 0 ? next : undefined })}
        config={config}
        onUpdate={update}
      />
      <FilterChips
        board={board}
        indexes={indexes}
        rules={effectiveRules}
        dirty={adHocRules !== undefined}
        shown={rows.length}
        total={topLevel.length}
        onRulesChange={(next) => setSearch({ f: next })}
        onSaveToView={() => {
          update((current) => ({ ...current, filters: { rules: effectiveRules } }));
          setSearch({ f: undefined });
        }}
      />
      {config.kpi ? (
        <KpiStrip
          tickets={topLevel}
          indexes={indexes}
          onHide={() => update((current) => ({ ...current, kpi: false }))}
        />
      ) : null}
      {config.mode === 'board' ? (
        <KanbanView
          board={board}
          indexes={indexes}
          rows={rows}
          projectKey={projectKey}
          onOpenTicket={(ticketNumber) => setSearch({ t: ticketNumber })}
        />
      ) : (
        <TableView
          board={board}
          indexes={indexes}
          config={config}
          rows={rows}
          projectKey={projectKey}
          filtered={effectiveRules.length > 0 || query.length > 0}
          filterCount={effectiveRules.length + (query.length > 0 ? 1 : 0)}
          totalCount={topLevel.length}
          onUpdate={update}
          onOpenTicket={(ticketNumber) => setSearch({ t: ticketNumber })}
          onClearFilters={() => setSearch({ f: [], q: undefined })}
          onNewTicket={() => setCreating(true)}
        />
      )}
      {openTicket ? (
        <TicketDrawer
          projectKey={projectKey}
          board={board}
          indexes={indexes}
          ticket={openTicket}
          onClose={() => setSearch({ t: undefined })}
        />
      ) : null}
      <NewItemDialog
        projectKey={projectKey}
        board={board}
        indexes={indexes}
        open={creating}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}
