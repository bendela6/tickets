import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, Field, Item, Option, StatusKind } from '../api/types';
import { usePatchItem } from '../api/use-patch-item';
import { KIND_ICON, KIND_TONE, typePill } from '../domain/status';
import { useCurrentUser } from '../state/current-user-context';
import { Avatar, Card, cn, Icon, Pill, RelativeDate } from '@bh/ui';
import { ItemKey } from './item-key';
import { avatarFor } from '../domain/actor';
import { childProgress } from '../utils/child-progress';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';
import { creatableTypes } from './new-item-dialog';

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

// The columns: every status any type's workflow offers, in option order.
// Types may narrow a shared status set (allowedOptionIds) or own a workflow
// field of their own, and every card must find its column either way, so
// this is the union over the board's types (and the types of the rows, in
// case one is archived), merged by value.
function workflowColumns(board: Board, indexes: BoardIndexes, rows: Item[]): Option[] {
  const typeIds = new Set(board.types.filter((type) => !type.archivedAt).map((type) => type.id));
  for (const row of rows) typeIds.add(row.typeId);
  const setOrder: number[] = [];
  const byValue = new Map<string, Option>();
  for (const typeId of typeIds) {
    const field = indexes.workflowField(typeId);
    if (!field) continue;
    for (const option of indexes.optionsForField(typeId, field)) {
      if (byValue.has(option.value)) continue;
      byValue.set(option.value, option);
      if (!setOrder.includes(option.optionSetId)) setOrder.push(option.optionSetId);
    }
  }
  return [...byValue.values()].sort(
    (a, b) =>
      setOrder.indexOf(a.optionSetId) - setOrder.indexOf(b.optionSetId) || a.position - b.position,
  );
}

// Board-mode kanban: one column per workflow status (workflowColumns), cards
// draggable between columns. While dragging, columns the card's workflow
// allows show a drop slot and the rest dim with a "no transition" note
// (mirrors legalStatusTargets, which mirrors the server rule). Dropping
// PATCHes the card's own workflow field. A card whose status has no column
// (unset, or an archived option) sits in a trailing "Other" column.
export function KanbanView({
  board,
  indexes,
  rows,
  onOpenTicket,
  onNewTicket,
}: {
  board: Board;
  indexes: BoardIndexes;
  rows: Item[];
  /** Kept for API symmetry with TableView; cards show each item's key. */
  projectKey: string;
  onOpenTicket: (itemKey: string) => void;
  /** A column's ＋: start a new item in that status. */
  onNewTicket?: (status: string) => void;
}): JSX.Element {
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const columns = useMemo(() => workflowColumns(board, indexes, rows), [board, indexes, rows]);
  // A column's ＋ shows only where some type may start (its entry statuses),
  // so it never opens New item on a status the item can't be created in.
  const startable = useMemo(
    () =>
      new Set(
        creatableTypes(board).flatMap((type) =>
          legalStatusTargets(board, indexes, null, type.id).map((option) => option.value),
        ),
      ),
    [board, indexes],
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

  if (columns.length === 0) {
    return (
      <div className="px-16 py-24 font-sans text-13/19 text-gray-9">
        This project has no workflow field, so board mode is unavailable.
      </div>
    );
  }

  const statusValueOf = (ticket: Item): string | null => {
    const field = indexes.workflowField(ticket.typeId);
    const raw = field ? ticket.values[field.key] : undefined;
    return typeof raw === 'string' ? raw : null;
  };
  const statusOptionOf = (ticket: Item): Option | undefined => {
    const field = indexes.workflowField(ticket.typeId);
    const value = statusValueOf(ticket);
    return field && value !== null ? indexes.optionByValue(field, value) : undefined;
  };

  const cardsByValue = new Map<string, Item[]>(columns.map((option) => [option.value, []]));
  const unplaced: Item[] = [];
  for (const ticket of rows) {
    const value = statusValueOf(ticket);
    const column = value === null ? undefined : cardsByValue.get(value);
    if (column) {
      column.push(ticket);
    } else {
      unplaced.push(ticket);
    }
  }

  const dragged = draggingId === null ? null : (rows.find((t) => t.id === draggingId) ?? null);
  const draggedFromValue = dragged ? statusValueOf(dragged) : null;
  const draggedFromLabel =
    (dragged ? statusOptionOf(dragged)?.label : undefined) ?? draggedFromValue ?? '?';
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
    const field = ticket ? indexes.workflowField(ticket.typeId) : undefined;
    if (!ticket || !field || userId === null || statusValueOf(ticket) === target.value) {
      return;
    }
    patch.mutate(
      {
        itemId: ticket.id,
        actorId: userId,
        expectedUpdatedAt: ticket.updatedAt,
        values: { [field.key]: target.value },
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
    const kind = statusOptionOf(ticket)?.kind;
    const overdue =
      due !== null && kind !== 'done' && kind !== 'dropped' && isPastDate(due, new Date());

    const progress = childProgress(ticket, indexes);
    const hasFooter = assigneeUser !== undefined || due !== null || progress.total > 0;

    return (
      <Card
        key={ticket.id}
        interactive
        padding={3}
        role="button"
        tabIndex={0}
        draggable={userId !== null}
        title={userId === null ? 'Pick a user in the header to move items' : undefined}
        onClick={() => onOpenTicket(ticket.key)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenTicket(ticket.key);
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
          'flex shrink-0 flex-col gap-8 text-left',
          draggingId === ticket.id && 'opacity-40',
        )}
      >
        <div className="flex items-center gap-8">
          <ItemKey itemKey={ticket.key} className="text-11" />
          {priorityOption ? (
            <Pill
              label={priorityOption.label}
              tone={priorityOption.config.color ?? 'gray'}
              shape="round"
              className="h-18 px-7 text-10"
            />
          ) : null}
          <span className="flex-1" />
          {type ? (
            <Pill
              {...typePill}
              label={type.label}
              className={cn(typePill.className, 'h-18 rounded-6 px-7 text-10')}
            />
          ) : null}
        </div>
        <div className="font-sans text-13/19 leading-[1.4] font-500 text-gray-12">
          {String(ticket.values['title'] ?? '')}
        </div>
        {hasFooter ? (
          <div className="flex items-center gap-9">
            {assigneeUser ? (
              <Avatar name={assigneeUser.name} {...avatarFor(assigneeUser.kind)} size="sm" />
            ) : null}
            {due !== null ? (
              <RelativeDate value={due} overdue={overdue} className="text-11" />
            ) : null}
            <span className="flex-1" />
            {progress.total > 0 ? (
              <span className="font-mono text-10 text-gray-9">
                {progress.done}/{progress.total}
              </span>
            ) : null}
          </div>
        ) : null}
      </Card>
    );
  };

  return (
    <div className="relative flex flex-1 gap-14 overflow-x-auto overflow-y-auto pb-20">
      {columns.map((option) => {
        const cards = cardsByValue.get(option.value) ?? [];
        const mode = columnMode(option);
        const kind = option.kind ?? 'todo';
        return (
          <section
            key={option.id}
            aria-label={option.label}
            className={cn(
              'flex w-[85vw] flex-none flex-col rounded-12 bg-surface-inset md:w-252',
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
            <div className="flex items-center gap-8 px-13 pt-12 pb-8">
              <span className="inline-flex shrink-0">
                <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size="xs" />
              </span>
              <span className="font-sans text-13/19 font-500 text-gray-12">{option.label}</span>
              <span className="font-mono text-11 text-gray-9">{cards.length}</span>
              <span className="flex-1" />
              {onNewTicket && startable.has(option.value) ? (
                <button
                  type="button"
                  aria-label={`New item in ${option.label}`}
                  onClick={() => onNewTicket(option.value)}
                  className="inline-flex size-22 items-center justify-center rounded-6 bg-transparent font-sans text-13/19 text-gray-9 hover:bg-surface-raised hover:text-gray-12"
                >
                  ＋
                </button>
              ) : null}
            </div>
            {mode === 'illegal' ? (
              <div className="mx-10 mb-8 rounded-8 bg-red-3 px-10 py-7 font-sans text-11 leading-[1.4] text-red-9">
                ✕ workflow: no transition {draggedFromLabel} → {option.label}
              </div>
            ) : null}
            {mode === 'legal' ? (
              <div className="mx-10 mb-8 flex h-[74px] shrink-0 items-center justify-center rounded-12 border-2 border-dashed border-indigo-9 bg-indigo-3 font-sans text-12/17 font-500 text-indigo-9">
                Drop — {draggedFromLabel} → {option.label}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-10 pb-10">
              {cards.map((ticket) => renderCard(ticket))}
              {mode === 'origin' && dragged ? (
                <div className="flex h-[74px] shrink-0 items-center justify-center rounded-12 border-2 border-dashed border-gray-7 font-mono text-11 text-gray-9">
                  {dragged.key} — dragging…
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
      {unplaced.length > 0 ? (
        <section
          aria-label="Other"
          className={cn(
            'flex w-[85vw] flex-none flex-col rounded-12 bg-surface-inset md:w-252',
            dragged && 'opacity-50',
          )}
        >
          <div className="flex items-center gap-8 px-13 pt-12 pb-8">
            <span className="font-sans text-13/19 font-500 text-gray-12">Other</span>
            <span className="font-mono text-11 text-gray-9">{unplaced.length}</span>
          </div>
          <p className="m-0 px-13 pb-8 font-sans text-11 leading-[1.4] text-gray-9">
            No status, or one no longer offered. Open a card to set it.
          </p>
          <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-10 pb-10">
            {unplaced.map((ticket) => renderCard(ticket))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
