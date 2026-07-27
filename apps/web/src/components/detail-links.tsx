import { useState } from 'react';
import type { Board, Item } from '../api/types';
import { useCreateLink } from '../api/use-create-link';
import { useDeleteLink } from '../api/use-delete-link';
import { useCurrentUser } from '../state/current-user-context';
import { Button, Combobox, type ComboOption, Input, ItemKey, Pill, SectionHeader } from '@tickets/ui';
import type { BoardIndexes } from '../utils/index-board';

// Direction is folded into the chip text: outgoing "label →", incoming
// "← inverseLabel", non-directional "label ↔". Incoming blocks (i.e. this
// item is blocked) gets the blocked kind color per the design.
function directionLabel(
  linkType: Board['linkTypes'][number],
  outgoing: boolean,
): { text: string; blocked: boolean } {
  if (!linkType.directional) {
    return { text: `${linkType.label} ↔`, blocked: false };
  }
  if (outgoing) {
    return { text: `${linkType.label} →`, blocked: false };
  }
  return { text: `← ${linkType.inverseLabel}`, blocked: linkType.key === 'blocks' };
}

export function DetailLinks({
  board,
  indexes,
  item,
  onOpenItem,
}: {
  board: Board;
  indexes: BoardIndexes;
  item: Item;
  onOpenItem: (itemNumber: number) => void;
}) {
  const { userId } = useCurrentUser();
  const createLink = useCreateLink();
  const deleteLink = useDeleteLink();

  const prefix = board.project.itemPrefix;
  const linkTypes = [...board.linkTypes]
    .filter((linkType) => !linkType.archivedAt)
    .sort((left, right) => left.position - right.position);
  // `${key}|out` / `${key}|in` — one combobox entry per legal direction.
  const options: ComboOption[] = linkTypes.flatMap((linkType) =>
    linkType.directional
      ? [
          { value: `${linkType.key}|out`, label: `${linkType.label} →` },
          { value: `${linkType.key}|in`, label: `← ${linkType.inverseLabel}` },
        ]
      : [{ value: `${linkType.key}|out`, label: `${linkType.label} ↔` }],
  );

  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<string | null>(() => options[0]?.value ?? null);
  const [numberDraft, setNumberDraft] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (choice === null) {
      return;
    }
    const digits = numberDraft.trim().match(/(\d+)\s*$/)?.[1];
    const other = digits ? indexes.itemByNumber.get(Number(digits)) : undefined;
    if (!other) {
      setError(`no item #${numberDraft.trim()}`);
      return;
    }
    if (userId === null) {
      return;
    }
    const [linkTypeKey = '', direction] = choice.split('|');
    try {
      await createLink.mutateAsync({
        actorId: userId,
        linkTypeKey,
        sourceItemId: direction === 'out' ? item.id : other.id,
        targetItemId: direction === 'out' ? other.id : item.id,
      });
      setNumberDraft('');
    } catch (linkError) {
      setError((linkError as Error).message);
    }
  };

  return (
    <section>
      <SectionHeader
        title="Links"
        action={
          <button
            type="button"
            className="font-sans text-meta font-medium text-gray-9 hover:text-gray-12"
            onClick={() => setAdding((value) => !value)}
          >
            ＋ Add link
          </button>
        }
        className="mb-2"
      />
      <div className="flex flex-col gap-1.5">
        {item.links.length === 0 ? (
          <p className="m-0 font-sans text-meta text-gray-9">No links.</p>
        ) : (
          item.links.map((link) => {
            const linkType = board.linkTypes.find((candidate) => candidate.id === link.linkTypeId);
            const outgoing = link.sourceItemId === item.id;
            const otherId = outgoing ? link.targetItemId : link.sourceItemId;
            const other = indexes.itemById.get(otherId);
            if (!linkType || !other) {
              return null;
            }
            const chip = directionLabel(linkType, outgoing);
            return (
              <div
                key={link.id}
                className="flex h-8.5 items-center gap-2.25 rounded-[9px] border border-gray-6 px-2.75 hover:bg-gray-1"
              >
                <Pill
                  tone={chip.blocked ? 'orange' : 'secondary'}
                  label={chip.text}
                  className="h-5 rounded-md text-label"
                />
                <button
                  type="button"
                  className="shrink-0"
                  onClick={() => onOpenItem(other.number)}
                >
                  <ItemKey
                    prefix={prefix}
                    number={other.number}
                    className="text-[11px] hover:text-indigo-9"
                  />
                </button>
                <span className="min-w-0 flex-1 truncate font-sans text-ui text-gray-11">
                  {String(other.values['title'] ?? '')}
                </span>
                <button
                  type="button"
                  aria-label="Remove link"
                  title="Remove link"
                  disabled={userId === null || deleteLink.isPending}
                  className="shrink-0 font-sans text-meta text-gray-9 hover:text-red-9 disabled:opacity-50"
                  onClick={() => {
                    if (userId !== null) {
                      deleteLink.mutate({ linkId: link.id, actorId: userId });
                    }
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
      {adding ? (
        <form
          className="mt-2 flex flex-wrap items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Combobox
            size="sm"
            className="w-44"
            options={options}
            value={choice}
            disabled={userId === null}
            onChange={setChoice}
          />
          <Input
            size="sm"
            className="w-28"
            placeholder={`${prefix}-131`}
            aria-label="Item number"
            value={numberDraft}
            disabled={userId === null}
            onChange={(event) => setNumberDraft(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            disabled={userId === null || numberDraft.trim().length === 0 || createLink.isPending}
          >
            Link
          </Button>
          {error ? <span className="font-sans text-meta text-red-9">{error}</span> : null}
        </form>
      ) : null}
    </section>
  );
}
