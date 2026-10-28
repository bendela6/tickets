import { OWN_ERROR } from '../api/mutation-meta';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, Item, StatusKind } from '../api/types';
import { useCreateItem } from '../api/use-create-item';
import { usePatchItem } from '../api/use-patch-item';
import { KIND_ICON, KIND_TONE } from '../domain/status';
import { statusChoices } from '../domain/status-choices';
import { useCurrentUser } from '../state/current-user-context';
import { Card, cn, Combobox, Icon, Kbd, Progress, SectionHeader } from '@tilewise/ui';
import { ItemKey } from './item-key';
import { childProgress } from '../utils/child-progress';
import { nextKey } from '../utils/next-key';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';

// Subtasks panel: progress header, one row per child (kind glyph, key, title,
// inline status select), and the "type a title" row that adds one. A child is
// one of the types the item's type may hold (structure.item_type_child_types):
// a plan feature adds a ticket, a ticket a subticket, a software task a
// subtask; where there are several, the row offers them, the scheme's first
// until another is picked. An item whose type holds none has no add row, and
// with no children either, no panel.
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
  onOpenItem: (itemKey: string) => void;
}) {
  const { userId } = useCurrentUser();
  const createItem = useCreateItem(OWN_ERROR);
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [pickedTypeKey, setPickedTypeKey] = useState<string | null>(null);

  const children = [...(indexes.childrenByParent.get(item.id) ?? [])].sort(
    (left, right) => left.number - right.number,
  );
  const progress = childProgress(item, indexes);
  const childTypes = indexes.childTypesByParent.get(item.typeId) ?? [];
  const childType = childTypes.find((type) => type.key === pickedTypeKey) ?? childTypes[0];
  const nextChildKey = childType
    ? nextKey(board, indexes, { typeKey: childType.key, parentId: item.id })
    : null;

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

  if (children.length === 0 && !childType) {
    return null;
  }

  return (
    <section>
      <SectionHeader
        title="Subtasks"
        count={
          progress.any ? (
            <>
              <Progress
                tone="green"
                value={progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}
                className="w-60"
              />
              <span className="font-mono text-11/13 tracking-wider text-gray-9">
                {progress.done}/{progress.total} done
              </span>
            </>
          ) : null
        }
        className="mb-8 gap-10"
      />
      <Card>
        {children.map((child) => {
          const wf = indexes.workflowField(child.typeId);
          const rawStatus = wf ? child.values[wf.key] : undefined;
          const option =
            wf && typeof rawStatus === 'string' ? indexes.optionByValue(wf, rawStatus) : undefined;
          const kind = option?.kind ?? 'todo';
          const settled = kind === 'done' || kind === 'dropped';
          const childStatuses = wf
            ? indexes.optionsForField(child.typeId, wf).filter((candidate) => !candidate.archivedAt)
            : [];
          const legal = wf ? legalStatusTargets(board, indexes, child, child.typeId) : [];
          const statusValue = typeof rawStatus === 'string' ? rawStatus : null;
          return (
            <div
              key={child.id}
              className="flex h-38 cursor-pointer items-center gap-10 border-b-1 border-gray-6 px-12 last:border-b-0 hover:bg-gray-1"
              onClick={() => onOpenItem(child.key)}
            >
              <span aria-hidden className="inline-flex shrink-0">
                <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size="xs" />
              </span>
              <ItemKey itemKey={child.key} muted={settled} className="shrink-0 text-11" />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate font-sans text-13/19',
                  settled ? 'text-gray-9' : 'text-gray-12',
                )}
              >
                {String(child.values['title'] ?? '')}
              </span>
              <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
                <Combobox
                  size="xs"
                  className="w-160"
                  aria-label={`Status of ${child.key}`}
                  searchable={false}
                  placeholder="Set status…"
                  {...statusChoices(childStatuses, legal, statusValue)}
                  value={statusValue}
                  disabled={userId === null || !wf}
                  onChange={(next) => {
                    if (next !== null) {
                      setChildStatus(child, next);
                    }
                  }}
                />
              </span>
            </div>
          );
        })}
        {childType ? (
          <form
            className="flex h-38 items-center gap-10 bg-gray-1 px-12"
            onSubmit={async (event) => {
              event.preventDefault();
              if (userId === null || title.trim().length === 0) {
                return;
              }
              // A refusal keeps the title for a retry and says why below.
              try {
                await createItem.mutateAsync({
                  projectKey,
                  actorId: userId,
                  typeKey: childType.key,
                  parentId: item.id,
                  values: { title: title.trim() },
                });
              } catch {
                return;
              }
              setTitle('');
            }}
          >
            <span
              aria-hidden
              className="size-9 shrink-0 rounded-full border-1.5 border-dashed border-gray-7"
            />
            <input
              className="m-0 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-13/19 text-gray-12 outline-none placeholder:text-gray-9"
              placeholder={`Add ${childType.label.toLowerCase()} — type a title…`}
              aria-label={`Add ${childType.label.toLowerCase()}`}
              value={title}
              disabled={userId === null}
              onChange={(event) => setTitle(event.target.value)}
            />
            {title.trim().length > 0 && nextChildKey !== null ? (
              <span className="inline-flex shrink-0 items-center gap-4 font-mono text-10 text-gray-9">
                <Kbd keys="enter" size="sm" /> creates {nextChildKey}
              </span>
            ) : null}
            {childTypes.length > 1 ? (
              <Combobox
                size="xs"
                className="w-120 shrink-0"
                aria-label="Child type"
                searchable={false}
                options={childTypes.map((type) => ({ value: type.key, label: type.label }))}
                value={childType.key}
                disabled={userId === null}
                onChange={(next) => {
                  if (next !== null) {
                    setPickedTypeKey(next);
                  }
                }}
              />
            ) : null}
          </form>
        ) : null}
      </Card>
      {createItem.isError ? (
        <p className="m-0 mt-6 font-sans text-12/17 text-red-9">
          {(createItem.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}
