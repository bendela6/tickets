import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, Field, Item, Option, StatusKind } from '../api/types';
import { usePatchItem } from '../api/use-patch-item';
import { KIND_ICON, KIND_TONE, typePill } from '../domain/status';
import { hexToOptionColor } from '../registry/option-color';
import { useCurrentUser } from '../state/current-user-context';
import { Avatar, cn, Icon, ItemKey, Pill, RelativeDate } from '@tickets/ui';
import { childProgress } from '../utils/child-progress';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';

// Card decorations come from conventionally named fields; the board schema is
// user-defined, so we match by key/label rather than hard-coding field ids.
function findFieldByPattern(
  fields: Field[],
  types: Field['type'][],
  pattern: RegExp,
): Field | null {
  return (
    fields.find(
      (field) =>
        !field.archivedAt &&
        types.includes(field.type) &&
        (pattern.test(field.key) || pattern.test(field.label)),
    ) ?? null
  );
}

function isPastDate(value: string, now: Date): boolean {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const dueMidnight = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dueMidnight < nowMidnight;
}

type DragMode = 'idle' | 'origin' | 'legal' | 'illegal';

// Board-mode kanban: one column per active workflow option (of the board's
// primary type — the scheme shares one status set across types), cards
// draggable between columns. While dragging, columns the workflow allows show
// a drop slot and the rest dim with a "no transition" note (mirrors
// legalStatusTargets, which mirrors the server rule). Dropping PATCHes the
// workflow field.
export function KanbanView({
  board,
  indexes,
  rows,
  onOpenTicket,
}: {
  board: Board;
  indexes: BoardIndexes;
  rows: Item[];
  /** Kept for API symmetry with TableView; keys render from the itemPrefix. */
  projectKey: string;
  onOpenTicket: (ticketNumber: number) => void;
}): JSX.Element {
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const firstType = board.types[0];
  const workflowField = firstType ? indexes.workflowField(firstType.id) : undefined;

  const columns = useMemo(
    () =>
      !workflowField || workflowField.optionSetId === null
        ? []
        : (indexes.optionsBySetId.get(workflowField.optionSetId) ?? []),
    [workflowField, indexes],
  );

  const priorityField = useMemo(
    () => findFieldByPattern(board.fields, ['option'], /prio|priority|severity/i),
    [board.fields],
  );
  const assigneeField = useMemo(
    () => findFieldByPattern(board.fields, ['user'], /assignee|owner/i),
    [board.fields],
  );
  const dueField = useMemo(
    () => findFieldByPattern(board.fields, ['date'], /due/i),
    [board.fields],
  );

  if (!workflowField) {
    return (
      <div className="px-4 py-6 font-sans text-ui text-gray-9">
        This project has no workflow field, so board mode is unavailable.
      </div>
    );
  }

  const statusValueOf = (ticket: Item): string | null => {
    const raw = ticket.values[workflowField.key];
    return typeof raw === 'string' ? raw : null;
  };

  const cardsByValue = new Map<string, Item[]>(columns.map((option) => [option.value, []]));
  for (const ticket of rows) {
    const value = statusValueOf(ticket);
    if (value !== null) {
      cardsByValue.get(value)?.push(ticket);
    }
  }

  const dragged = draggingId === null ? null : (rows.find((t) => t.id === draggingId) ?? null);
  const draggedFromValue = dragged ? statusValueOf(dragged) : null;
  const draggedFromLabel =
    (draggedFromValue
      ? indexes.optionByValue(workflowField, draggedFromValue)?.label
      : undefined) ??
    draggedFromValue ??
    '?';
  const legalTargetValues = dragged
    ? new Set(
        legalStatusTargets(board, indexes, dragged, dragged.typeId).map((option) => option.value),
      )
    : null;

  const columnMode = (option: Option): DragMode => {
    if (!dragged || !legalTargetValues) {
      return 'idle';
    }
    if (option.value === draggedFromValue) {
      return 'origin';
    }
    return legalTargetValues.has(option.value) ? 'legal' : 'illegal';
  };

  const dropOnColumn = (target: Option) => {
    const ticket = dragged;
    setDraggingId(null);
    if (!ticket || userId === null || statusValueOf(ticket) === target.value) {
      return;
    }
    patch.mutate(
      {
        itemId: ticket.id,
        actorId: userId,
        expectedUpdatedAt: ticket.updatedAt,
        values: { [workflowField.key]: target.value },
      },
      { onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }) },
    );
  };

  const renderCard = (ticket: Item) => {
    const type = indexes.typeById.get(ticket.typeId);

    const priorityRaw = priorityField ? ticket.values[priorityField.key] : undefined;
    const priorityOption =
      priorityField && priorityRaw !== undefined && priorityRaw !== null && priorityRaw !== ''
        ? (indexes
            .optionsForField(ticket.typeId, priorityField)
            .find((option) => option.value === priorityRaw) ?? null)
        : null;

    // 'user'-typed field value: a user id (or {id,name}); resolve through the board's users.
    const assigneeRaw = assigneeField ? ticket.values[assigneeField.key] : undefined;
    const assigneeUserId =
      typeof assigneeRaw === 'number'
        ? assigneeRaw
        : assigneeRaw !== null &&
            typeof assigneeRaw === 'object' &&
            typeof (assigneeRaw as { id?: unknown }).id === 'number'
          ? (assigneeRaw as { id: number }).id
          : null;
    const assigneeUser = assigneeUserId === null ? undefined : indexes.userById.get(assigneeUserId);

    const dueRaw = dueField ? ticket.values[dueField.key] : undefined;
    const due = typeof dueRaw === 'string' && dueRaw !== '' ? dueRaw : null;
    const kind = indexes.optionByValue(workflowField, statusValueOf(ticket) ?? '')?.kind;
    const overdue =
      due !== null && kind !== 'done' && kind !== 'dropped' && isPastDate(due, new Date());

    const progress = childProgress(ticket, indexes);
    const hasFooter = assigneeUser !== undefined || due !== null || progress.total > 0;

    return (
      <div
        key={ticket.id}
        role="button"
        tabIndex={0}
        draggable={userId !== null}
        title={userId === null ? 'Pick a user in the header to move items' : undefined}
        onClick={() => onOpenTicket(ticket.number)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenTicket(ticket.number);
          }
        }}
        onDragStart={(event) => {
          if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', String(ticket.id));
            event.dataTransfer.effectAllowed = 'move';
          }
          setDraggingId(ticket.id);
        }}
        onDragEnd={() => setDraggingId(null)}
        className={cn(
          'flex shrink-0 cursor-pointer flex-col gap-2 rounded-[10px] border border-gray-6 bg-surface-raised px-3.25 py-2.75 text-left shadow-sm',
          draggingId === ticket.id && 'opacity-40',
        )}
      >
        <div className="flex items-center gap-2">
          <ItemKey
            prefix={board.project.itemPrefix}
            number={ticket.number}
            className="text-[11px]"
          />
          {priorityOption ? (
            <Pill
              label={priorityOption.label}
              tone={hexToOptionColor(priorityOption.config.color)}
              shape="round"
              className="h-4.5 px-1.75 text-[10px]"
            />
          ) : null}
          <span className="flex-1" />
          {type ? (
            <Pill
              {...typePill}
              label={type.label}
              className={cn(typePill.className, 'h-4.5 rounded-[5px] px-1.75 text-[10px]')}
            />
          ) : null}
        </div>
        <div className="font-sans text-ui leading-[1.4] font-medium text-gray-12">
          {String(ticket.values['title'] ?? '')}
        </div>
        {hasFooter ? (
          <div className="flex items-center gap-2.25">
            {assigneeUser ? (
              <Avatar name={assigneeUser.name} kind={assigneeUser.kind} size="sm" />
            ) : null}
            {due !== null ? (
              <RelativeDate value={due} overdue={overdue} className="text-[11px]" />
            ) : null}
            <span className="flex-1" />
            {progress.total > 0 ? (
              <span className="font-mono text-[10px] text-gray-9">
                {progress.done}/{progress.total}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="relative flex flex-1 gap-3.5 overflow-x-auto overflow-y-auto pb-5">
      {columns.map((option) => {
        const cards = cardsByValue.get(option.value) ?? [];
        const mode = columnMode(option);
        const kind = option.kind ?? 'todo';
        return (
          <section
            key={option.id}
            aria-label={option.label}
            className={cn(
              'flex w-[85vw] flex-none flex-col rounded-[12px] bg-surface-inset md:w-63',
              mode === 'illegal' && 'opacity-50',
            )}
            onDragOver={
              mode === 'legal'
                ? (event) => {
                    event.preventDefault();
                    if (event.dataTransfer) {
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }
                : undefined
            }
            onDrop={
              mode === 'legal'
                ? (event) => {
                    event.preventDefault();
                    dropOnColumn(option);
                  }
                : undefined
            }
          >
            <div className="flex items-center gap-2 px-3.25 pt-3 pb-2">
              <span className="inline-flex shrink-0">
                <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size={10} />
              </span>
              <span className="font-sans text-ui font-medium text-gray-12">{option.label}</span>
              <span className="font-mono text-[11px] text-gray-9">{cards.length}</span>
              <span className="flex-1" />
              {/* Inert for now: card creation from a column lands in a later task. */}
              <span aria-hidden className="font-sans text-ui text-gray-9">
                ＋
              </span>
            </div>
            {mode === 'illegal' ? (
              <div className="mx-2.5 mb-2 rounded-[8px] bg-red-3 px-2.5 py-1.75 font-sans text-[11px] leading-[1.4] text-red-9">
                ✕ workflow: no transition {draggedFromLabel} → {option.label}
              </div>
            ) : null}
            {mode === 'legal' ? (
              <div className="mx-2.5 mb-2 flex h-[74px] shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-indigo-9 bg-indigo-3 font-sans text-meta font-medium text-indigo-9">
                Drop — {draggedFromLabel} → {option.label}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
              {cards.map((ticket) => renderCard(ticket))}
              {mode === 'origin' && dragged ? (
                <div className="flex h-[74px] shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-gray-7 font-mono text-[11px] text-gray-9">
                  {board.project.itemPrefix}-{dragged.number} — dragging…
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
