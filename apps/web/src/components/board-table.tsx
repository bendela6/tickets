import { useRef } from 'react';
import type { Board, BoardTicket } from '../api/types';
import { getCellContent } from '../registry/get-cell-content';
import type { BoardIndexes } from '../utils/index-board';
import { childProgress } from '../utils/child-progress';
import type { ViewConfig } from '../utils/view-config';
import { InlineStatusCell } from './inline-status-cell';
import { ProgressCell } from './progress-cell';
import { ValueBadge } from './value-badge';

type UpdateConfig = (mutate: (current: ViewConfig) => ViewConfig) => void;

// Hand-rolled on purpose (TASK-066): the view config IS the column model, so
// resize/reorder/show-hide/sort are plain mutations of it, persisted by the
// useViewConfig hook.
export function BoardTable({
  board,
  indexes,
  config,
  rows,
  onUpdate,
  onOpenTicket,
}: {
  board: Board;
  indexes: BoardIndexes;
  config: ViewConfig;
  rows: BoardTicket[];
  onUpdate: UpdateConfig;
  onOpenTicket: (ticketNumber: number) => void;
}) {
  const suppressClick = useRef(false);
  const dragIndex = useRef<number | null>(null);
  const visible = config.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.hidden !== true);
  const anyWidth = visible.some(({ column }) => column.width !== undefined);

  const headerLabel = (column: ViewConfig['columns'][number]): string => {
    if (column.source === 'number') {
      return 'ID';
    }
    if (column.source === 'type') {
      return 'Type';
    }
    if (column.source === 'progress') {
      return 'Progress';
    }
    return indexes.fieldById.get(column.fieldId)?.label ?? '?';
  };

  const sortMatches = (column: ViewConfig['columns'][number]): boolean => {
    if (!config.sort) {
      return false;
    }
    if (column.source === 'field') {
      return config.sort.source === 'field' && config.sort.fieldId === column.fieldId;
    }
    return config.sort.source === column.source;
  };

  const cycleSort = (column: ViewConfig['columns'][number]) => {
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
            ? { source: 'field', fieldId: column.fieldId, dir }
            : { source: column.source, dir },
      };
    });
  };

  const startResize = (event: React.PointerEvent, columnIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    const headerCell = (event.currentTarget as HTMLElement).closest('th');
    const startX = event.clientX;
    const startWidth = headerCell?.offsetWidth ?? 120;
    suppressClick.current = true;
    const onMove = (move: PointerEvent) => {
      const width = Math.max(60, Math.round(startWidth + move.clientX - startX));
      onUpdate((current) => ({
        ...current,
        columns: current.columns.map((entry, index) =>
          index === columnIndex ? { ...entry, width } : entry,
        ),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dropOn = (targetIndex: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === targetIndex) {
      return;
    }
    onUpdate((current) => {
      const columns = [...current.columns];
      const [moved] = columns.splice(from, 1);
      if (!moved) {
        return current;
      }
      columns.splice(targetIndex, 0, moved);
      return { ...current, columns };
    });
  };

  return (
    <section className="card">
      <div className="table-scroll">
        <table
          aria-label="Tickets"
          style={anyWidth ? { tableLayout: 'fixed', width: '100%' } : undefined}
        >
          <thead>
            <tr>
              {visible.map(({ column, index }) => (
                <th
                  key={index}
                  draggable
                  style={{
                    position: 'relative',
                    ...(column.width ? { width: column.width } : {}),
                  }}
                  onClick={() => {
                    if (!suppressClick.current) {
                      cycleSort(column);
                    }
                  }}
                  onDragStart={() => {
                    dragIndex.current = index;
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropOn(index)}
                >
                  {headerLabel(column)}
                  {sortMatches(column) ? (
                    <span className="arrow"> {config.sort?.dir === 'asc' ? '▲' : '▼'}</span>
                  ) : null}
                  <span
                    onPointerDown={(event) => startResize(event, index)}
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: -3,
                      width: 7,
                      height: '100%',
                      cursor: 'col-resize',
                      zIndex: 2,
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket) => (
              <tr key={ticket.id} onClick={() => onOpenTicket(ticket.number)}>
                {visible.map(({ column, index }) => {
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
                  if (field.type === 'status') {
                    return (
                      <td key={index}>
                        <InlineStatusCell board={board} indexes={indexes} ticket={ticket} />
                      </td>
                    );
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
    </section>
  );
}
