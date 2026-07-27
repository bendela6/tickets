import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, Item, StatusKind } from '../api/types';
import { useCreateItem } from '../api/use-create-item';
import { usePatchItem } from '../api/use-patch-item';
import { KIND_ICON, KIND_TONE } from '../domain/status';
import { useCurrentUser } from '../state/current-user-context';
import { cn, Icon, ItemKey, Meter, SectionHeader } from '@tickets/ui';
import { StatusSelect } from '../ui/status-select';
import { childProgress } from '../utils/child-progress';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';

// Subtasks panel: progress header, one row per child (kind glyph, key, title,
// inline status select), and the always-there "type a title" creator row.
export function DetailChildren({
  projectKey,
  board,
  indexes,
  item,
  onOpenItem,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  item: Item;
  onOpenItem: (itemNumber: number) => void;
}) {
  const { userId } = useCurrentUser();
  const createItem = useCreateItem();
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const prefix = board.project.itemPrefix;
  const children = [...(indexes.childrenByParent.get(item.id) ?? [])].sort(
    (left, right) => left.number - right.number,
  );
  const progress = childProgress(item, indexes);
  const nextNumber = board.items.reduce((max, row) => Math.max(max, row.number), 0) + 1;

  const setChildStatus = (child: Item, next: string) => {
    if (userId === null) {
      return;
    }
    const wf = indexes.workflowField(child.typeId);
    if (!wf) {
      return;
    }
    patch.mutate(
      {
        itemId: child.id,
        actorId: userId,
        expectedUpdatedAt: child.updatedAt,
        values: { [wf.key]: next },
      },
      { onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }) },
    );
  };

  return (
    <section>
      <SectionHeader
        title="Subtasks"
        count={
          progress.any ? (
            <>
              <Meter
                tone="green"
                value={progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}
                max={100}
                className="w-15"
              />
              <span className="font-mono text-label text-gray-9">
                {progress.done}/{progress.total} done
              </span>
            </>
          ) : null
        }
        className="mb-2 gap-2.5"
      />
      <div className="overflow-hidden rounded-[10px] border border-gray-6">
        {children.map((child) => {
          const wf = indexes.workflowField(child.typeId);
          const rawStatus = wf ? child.values[wf.key] : undefined;
          const option =
            wf && typeof rawStatus === 'string' ? indexes.optionByValue(wf, rawStatus) : undefined;
          const kind = option?.kind ?? 'todo';
          const settled = kind === 'done' || kind === 'dropped';
          const childStatusOptions = wf
            ? indexes
                .optionsForField(child.typeId, wf)
                .filter((candidate) => !candidate.archivedAt)
                .map((candidate) => ({
                  key: candidate.value,
                  label: candidate.label,
                  kind: candidate.kind ?? 'todo',
                }))
            : [];
          const legalKeys = wf
            ? legalStatusTargets(board, indexes, child, child.typeId).map((option_) => option_.value)
            : [];
          return (
            <div
              key={child.id}
              className="flex h-9.5 cursor-pointer items-center gap-2.5 border-b border-gray-6 px-3 hover:bg-gray-1"
              onClick={() => onOpenItem(child.number)}
            >
              <span aria-hidden className="inline-flex shrink-0">
                <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size={10} />
              </span>
              <ItemKey
                prefix={prefix}
                number={child.number}
                muted={settled}
                className="shrink-0 text-[11px]"
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate font-sans text-ui',
                  settled ? 'text-gray-9' : 'text-gray-12',
                )}
              >
                {String(child.values['title'] ?? '')}
              </span>
              <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
                <StatusSelect
                  size="sm"
                  className="w-auto"
                  statuses={childStatusOptions}
                  legalTargets={legalKeys}
                  value={typeof rawStatus === 'string' ? rawStatus : null}
                  disabled={userId === null || !wf}
                  onChange={(next) => setChildStatus(child, next)}
                />
              </span>
            </div>
          );
        })}
        <form
          className="flex h-9.5 items-center gap-2.5 bg-gray-1 px-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (userId === null || title.trim().length === 0) {
              return;
            }
            await createItem.mutateAsync({
              projectKey,
              actorId: userId,
              typeKey: 'subtask',
              parentId: item.id,
              values: { title: title.trim() },
            });
            setTitle('');
          }}
        >
          <span
            aria-hidden
            className="size-2.25 shrink-0 rounded-full border-[1.5px] border-dashed border-gray-7"
          />
          <input
            className="m-0 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-ui text-gray-12 outline-none placeholder:text-gray-9"
            placeholder="Add subtask — type a title…"
            aria-label="Add subtask"
            value={title}
            disabled={userId === null}
            onChange={(event) => setTitle(event.target.value)}
          />
          {title.trim().length > 0 ? (
            <span className="shrink-0 font-mono text-[10px] text-gray-9">
              ↵ creates {prefix}-{nextNumber}
            </span>
          ) : null}
        </form>
      </div>
      {createItem.isError ? (
        <p className="m-0 mt-1.5 font-sans text-meta text-red-9">
          {(createItem.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}
