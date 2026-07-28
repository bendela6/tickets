import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Board, Item } from '../../api/types';
import { usePatchItem } from '../../api/use-patch-item';
import { typePill } from '../../domain/status';
import { getCellContent } from '../../registry/get-cell-content';
import { useCurrentUser } from '../../state/current-user-context';
import { Button, cn, ItemKey, Menu, MenuContent, MenuItem, MenuTrigger, Progress, Pill, ScreenState } from '@tickets/ui';
import { StatusSelect } from '../../ui/status-select';
import { childProgress } from '../../utils/child-progress';
import type { BoardIndexes } from '../../utils/index-board';
import { legalStatusTargets } from '../../utils/legal-status-targets';
import type { ViewColumn, ViewConfig } from '../../utils/view-config';
import { columnLabel } from './board-header';

type UpdateConfig = (mutate: (current: ViewConfig) => ViewConfig) => void;

function columnWidth(column: ViewColumn, indexes: BoardIndexes): string {
  if (column.width !== undefined) {
    return `${column.width}px`;
  }
  if (column.source === 'number') {
    return '92px';
  }
  if (column.source === 'type') {
    return '84px';
  }
  if (column.source === 'progress') {
    return '96px';
  }
  const field = indexes.fieldByKey.get(column.fieldKey);
  if (!field) {
    return '96px';
  }
  if (field.key === 'title') {
    return 'minmax(240px, 1fr)';
  }
  switch (field.type) {
    case 'option':
      if (field.config.workflow === true) {
        return '138px';
      }
      return field.config.multiple === true ? '150px' : '110px';
    case 'date':
    case 'datetime':
      return '96px';
    case 'number':
      return '72px';
    case 'boolean':
      return '56px';
    default:
      return '160px';
  }
}

/** Inline status cell: workflow-filtered StatusSelect that PATCHes on pick. */
function StatusCell({
  board,
  indexes,
  ticket,
}: {
  board: Board;
  indexes: BoardIndexes;
  ticket: Item;
}) {
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const workflowField = indexes.workflowField(ticket.typeId);
  if (!workflowField) {
    return null;
  }
  const raw = ticket.values[workflowField.key];
  const statuses = indexes
    .optionsForField(ticket.typeId, workflowField)
    .filter((option) => !option.archivedAt)
    .map((option) => ({ key: option.value, label: option.label, kind: option.kind ?? 'todo' }));
  return (
    <StatusSelect
      size="sm"
      statuses={statuses}
      value={typeof raw === 'string' ? raw : null}
      legalTargets={legalStatusTargets(board, indexes, ticket, ticket.typeId).map(
        (option) => option.value,
      )}
      disabled={userId === null}
      onChange={(next) => {
        if (userId === null || next === raw) {
          return;
        }
        patch.mutate(
          {
            itemId: ticket.id,
            actorId: userId,
            expectedUpdatedAt: ticket.updatedAt,
            values: { [workflowField.key]: next },
          },
          { onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }) },
        );
      }}
    />
  );
}

/** Subtask rollup: 36×4 bar + n/m, or a dash when the ticket has no children. */
function ProgressCell({ ticket, indexes }: { ticket: Item; indexes: BoardIndexes }) {
  const { any, done, total } = childProgress(ticket, indexes);
  if (!any || total === 0) {
    return <span className="font-sans text-13/19 text-gray-9">—</span>;
  }
  const percent = Math.round((done / total) * 100);
  return (
    <span className="inline-flex items-center gap-1.75" title={`${done} of ${total} subtasks done`}>
      <Progress tone="green" value={percent} className="w-9" />
      <span className="font-mono text-11 text-gray-11">
        {done}/{total}
      </span>
    </span>
  );
}

/** Hover-revealed row actions: open the ticket page, or archive via ⋯ menu. */
function RowActions({ projectKey, ticket }: { projectKey: string; ticket: Item }) {
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const actionClasses =
    'flex size-7.5 items-center justify-center rounded-[7px] border border-gray-6 bg-surface-raised font-sans text-13/19 text-gray-11 shadow-sm hover:text-gray-12';
  return (
    <span
      className="absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-1.25 group-hover:flex"
      onClick={(event) => event.stopPropagation()}
    >
      <Link
        to="/p/$projectKey/t/$number"
        params={{ projectKey, number: String(ticket.number) }}
        title="Open item page"
        className={actionClasses}
      >
        ↗
      </Link>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" aria-label="Item actions" className={actionClasses}>
            ⋯
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem
            destructive
            disabled={userId === null}
            onSelect={() => {
              if (userId === null) {
                return;
              }
              patch.mutate({
                itemId: ticket.id,
                actorId: userId,
                expectedUpdatedAt: ticket.updatedAt,
                archived: true,
              });
            }}
          >
            Archive
          </MenuItem>
        </MenuContent>
      </Menu>
    </span>
  );
}

// Table renderer per docs/design/03-project-board.html lines 127–152: CSS grid
// columns driven by the view config, sticky uppercase header with click-to-sort,
// inline status edits, subtask rollup, hover actions. The view config IS the
// column model — sort/show-hide mutate it and persist via useViewConfig.
export function TableView({
  board,
  indexes,
  config,
  rows,
  projectKey,
  filtered,
  filterCount,
  totalCount,
  onUpdate,
  onOpenTicket,
  onClearFilters,
  onNewTicket,
}: {
  board: Board;
  indexes: BoardIndexes;
  config: ViewConfig;
  rows: Item[];
  projectKey: string;
  filtered: boolean;
  filterCount: number;
  totalCount: number;
  onUpdate: UpdateConfig;
  onOpenTicket: (ticketNumber: number) => void;
  onClearFilters: () => void;
  onNewTicket: () => void;
}) {
  const visible = config.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.hidden !== true);
  const gridTemplateColumns = visible.map(({ column }) => columnWidth(column, indexes)).join(' ');

  const sortMatches = (column: ViewColumn): boolean => {
    if (!config.sort) {
      return false;
    }
    if (column.source === 'field') {
      return config.sort.source === 'field' && config.sort.fieldKey === column.fieldKey;
    }
    return config.sort.source === column.source;
  };

  const cycleSort = (column: ViewColumn) => {
    onUpdate((current) => {
      const matches = sortMatches(column);
      if (matches && current.sort?.dir === 'desc') {
        return { ...current, sort: null };
      }
      const dir: 'asc' | 'desc' = matches && current.sort?.dir === 'asc' ? 'desc' : 'asc';
      return {
        ...current,
        sort:
          column.source === 'field'
            ? { source: 'field', fieldKey: column.fieldKey, dir }
            : { source: column.source, dir },
      };
    });
  };

  const cell = (column: ViewColumn, ticket: Item, key: number) => {
    if (column.source === 'number') {
      return (
        <span key={key} className="px-3">
          <ItemKey prefix={board.project.itemPrefix} number={ticket.number} />
        </span>
      );
    }
    if (column.source === 'type') {
      const type = indexes.typeById.get(ticket.typeId);
      return (
        <span key={key} className="px-2">
          <Pill {...typePill} label={type?.label ?? '?'} />
        </span>
      );
    }
    if (column.source === 'progress') {
      return (
        <span key={key} className="px-2">
          <ProgressCell ticket={ticket} indexes={indexes} />
        </span>
      );
    }
    const field = indexes.fieldByKey.get(column.fieldKey);
    if (!field) {
      return <span key={key} />;
    }
    if (field.type === 'option' && field.config.workflow === true) {
      return (
        <span key={key} className="px-2" onClick={(event) => event.stopPropagation()}>
          <StatusCell board={board} indexes={indexes} ticket={ticket} />
        </span>
      );
    }
    if (field.key === 'title') {
      return (
        <span key={key} className="truncate px-2 font-sans text-13/19 text-gray-12">
          {String(ticket.values[field.key] ?? '')}
        </span>
      );
    }
    return (
      <span key={key} className="min-w-0 truncate px-2 font-sans text-13/19 text-gray-11">
        {getCellContent(field, ticket.values[field.key], indexes, ticket.typeId)}
      </span>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-t-[12px] border border-gray-6 bg-surface-raised">
      <div
        role="row"
        className="sticky top-0 z-10 grid h-9 min-w-170 shrink-0 items-center border-b border-gray-6 bg-gray-1 px-1"
        style={{ gridTemplateColumns }}
      >
        {visible.map(({ column, index }) => {
          const active = sortMatches(column);
          return (
            <button
              key={index}
              type="button"
              onClick={() => cycleSort(column)}
              className={cn(
                'cursor-pointer text-left font-sans text-11/13 tracking-wider font-500 uppercase',
                column.source === 'number' ? 'px-3' : 'px-2',
                active ? 'text-gray-12' : 'text-gray-11 hover:text-gray-12',
              )}
            >
              {columnLabel(column, indexes)}
              {active ? <span aria-hidden> {config.sort?.dir === 'asc' ? '↑' : '↓'}</span> : null}
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <ScreenState
          className="flex-1 justify-center py-16"
          tone="neutral"
          icon="search"
          title={filtered ? 'No items match these filters' : 'No items yet'}
          body={
            filtered
              ? `${filterCount === 1 ? '1 filter is' : `${filterCount} filters are`} hiding all ${totalCount} items in this project.`
              : 'This project is brand new. Create the first item, or point an agent at it.'
          }
          action={
            filtered ? (
              <Button size="md" className="h-8" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="md" className="h-8" onClick={onNewTicket}>
                ＋ New item
              </Button>
            )
          }
        />
      ) : (
        rows.map((ticket) => (
          <div
            key={ticket.id}
            role="row"
            onClick={() => onOpenTicket(ticket.number)}
            className={cn(
              'group relative grid min-w-170 shrink-0 cursor-pointer items-center border-b border-gray-6 px-1 hover:bg-gray-1',
              config.density === 'compact' ? 'h-8' : 'h-10.5',
            )}
            style={{ gridTemplateColumns }}
          >
            {visible.map(({ column, index }) => cell(column, ticket, index))}
            <RowActions projectKey={projectKey} ticket={ticket} />
          </div>
        ))
      )}
    </div>
  );
}
