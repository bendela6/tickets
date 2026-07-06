import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, BoardTicket } from '../api/types';
import { useCreateTicket } from '../api/use-create-ticket';
import { usePatchTicket } from '../api/use-patch-ticket';
import { useCurrentUser } from '../state/current-user-context';
import { cn } from '../ui/cn';
import { KindGlyph, type StatusKind } from '../ui/kind-glyph';
import { StatusSelect } from '../ui/status-select';
import { TicketKey } from '../ui/ticket-key';
import { childProgress } from '../utils/child-progress';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';

const KIND_TEXT: Record<StatusKind, string> = {
  todo: 'text-kind-todo',
  active: 'text-kind-active',
  blocked: 'text-kind-blocked',
  done: 'text-kind-done',
  dropped: 'text-kind-dropped',
};

// Subtasks panel: progress header, one row per child (kind glyph, key, title,
// inline status select), and the always-there "type a title" creator row.
export function DetailChildren({
  projectKey,
  board,
  indexes,
  ticket,
  onOpenTicket,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
  onOpenTicket: (ticketNumber: number) => void;
}) {
  const { userId } = useCurrentUser();
  const createTicket = useCreateTicket();
  const patch = usePatchTicket();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const prefix = board.project.ticketPrefix;
  const children = [...(indexes.childrenByParent.get(ticket.id) ?? [])].sort(
    (left, right) => left.number - right.number,
  );
  const progress = childProgress(ticket, indexes);
  const statusField = indexes.statusField;
  const activeStatuses = [...board.statuses]
    .filter((status) => !status.archivedAt)
    .sort((left, right) => left.position - right.position)
    .map((status) => ({ key: status.key, label: status.label, kind: status.kind }));
  const nextNumber = board.tickets.reduce((max, row) => Math.max(max, row.number), 0) + 1;

  const setChildStatus = (child: BoardTicket, next: string) => {
    if (userId === null || !statusField) {
      return;
    }
    patch.mutate(
      {
        ticketId: child.id,
        actorId: userId,
        expectedUpdatedAt: child.updatedAt,
        values: { [statusField.key]: next },
      },
      { onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }) },
    );
  };

  return (
    <section>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="font-sans text-label font-medium uppercase text-ink-2">Subtasks</span>
        {progress.any ? (
          <>
            <span className="h-1 w-15 overflow-hidden rounded-full bg-inset">
              <span
                className="block h-full bg-kind-done"
                style={{
                  width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </span>
            <span className="font-mono text-label text-ink-3">
              {progress.done}/{progress.total} done
            </span>
          </>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-[10px] border border-hairline">
        {children.map((child) => {
          const rawStatus = statusField ? child.values[statusField.key] : undefined;
          const status =
            typeof rawStatus === 'string' ? indexes.statusByKey.get(rawStatus) : undefined;
          const kind = status?.kind ?? 'todo';
          const settled = kind === 'done' || kind === 'dropped';
          return (
            <div
              key={child.id}
              className="flex h-9.5 cursor-pointer items-center gap-2.5 border-b border-hairline px-3 hover:bg-app"
              onClick={() => onOpenTicket(child.number)}
            >
              <span aria-hidden className={cn('inline-flex shrink-0', KIND_TEXT[kind])}>
                <KindGlyph kind={kind} />
              </span>
              <TicketKey
                prefix={prefix}
                number={child.number}
                muted={settled}
                className="shrink-0 text-[11px]"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate font-sans text-ui',
                  settled ? 'text-ink-3' : 'text-ink',
                )}
              >
                {String(child.values['title'] ?? '')}
              </span>
              <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
                <StatusSelect
                  size="compact"
                  className="w-auto"
                  statuses={activeStatuses}
                  legalTargets={legalStatusTargets(board, indexes, child).map((s) => s.key)}
                  value={typeof rawStatus === 'string' ? rawStatus : null}
                  disabled={userId === null || !statusField}
                  onChange={(next) => setChildStatus(child, next)}
                />
              </span>
            </div>
          );
        })}
        <form
          className="flex h-9.5 items-center gap-2.5 bg-app px-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (userId === null || title.trim().length === 0) {
              return;
            }
            await createTicket.mutateAsync({
              projectKey,
              actorId: userId,
              typeKey: 'subtask',
              parentId: ticket.id,
              values: { title: title.trim() },
            });
            setTitle('');
          }}
        >
          <span
            aria-hidden
            className="size-2.25 shrink-0 rounded-full border-[1.5px] border-dashed border-control"
          />
          <input
            className="m-0 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-ui text-ink outline-none placeholder:text-ink-3"
            placeholder="Add subtask — type a title…"
            aria-label="Add subtask"
            value={title}
            disabled={userId === null}
            onChange={(event) => setTitle(event.target.value)}
          />
          {title.trim().length > 0 ? (
            <span className="shrink-0 font-mono text-[10px] text-ink-3">
              ↵ creates {prefix}-{nextNumber}
            </span>
          ) : null}
        </form>
      </div>
      {createTicket.isError ? (
        <p className="m-0 mt-1.5 font-sans text-meta text-danger">
          {(createTicket.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}
