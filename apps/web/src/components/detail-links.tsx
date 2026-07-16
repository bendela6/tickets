import { useState } from 'react';
import type { Board, Item } from '../api/types';
import { useCreateLink } from '../api/use-create-link';
import { useDeleteLink } from '../api/use-delete-link';
import { useCurrentUser } from '../state/current-user-context';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import { Combobox } from '../ui/combobox';
import type { ComboOption } from '../ui/combobox-list';
import { Input } from '../ui/input';
import { TicketKey } from '../ui/ticket-key';
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
      <div className="mb-2 flex items-center gap-2">
        <span className="font-sans text-label font-medium uppercase text-ink-2">Links</span>
        <span className="flex-1" />
        <button
          type="button"
          className="font-sans text-meta font-medium text-ink-3 hover:text-ink"
          onClick={() => setAdding((value) => !value)}
        >
          ＋ Add link
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {item.links.length === 0 ? (
          <p className="m-0 font-sans text-meta text-ink-3">No links.</p>
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
                className="flex h-8.5 items-center gap-2.25 rounded-[9px] border border-hairline px-2.75 hover:bg-app"
              >
                <span
                  className={cn(
                    'inline-flex h-5 shrink-0 items-center rounded-ctrl px-2 font-sans text-label font-medium',
                    chip.blocked
                      ? 'bg-kind-blocked-subtle text-kind-blocked'
                      : 'bg-inset text-ink-2',
                  )}
                >
                  {chip.text}
                </span>
                <button
                  type="button"
                  className="shrink-0"
                  onClick={() => onOpenItem(other.number)}
                >
                  <TicketKey
                    prefix={prefix}
                    number={other.number}
                    className="text-[11px] hover:text-accent"
                  />
                </button>
                <span className="min-w-0 flex-1 truncate font-sans text-ui text-ink-2">
                  {String(other.values['title'] ?? '')}
                </span>
                <button
                  type="button"
                  aria-label="Remove link"
                  title="Remove link"
                  disabled={userId === null || deleteLink.isPending}
                  className="shrink-0 font-sans text-meta text-ink-3 hover:text-danger disabled:opacity-50"
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
            size="compact"
            className="w-44"
            options={options}
            value={choice}
            disabled={userId === null}
            onChange={setChoice}
          />
          <Input
            size="compact"
            className="w-28"
            placeholder={`${prefix}-131`}
            aria-label="Item number"
            value={numberDraft}
            disabled={userId === null}
            onChange={(event) => setNumberDraft(event.target.value)}
          />
          <Button
            type="submit"
            size="compact"
            disabled={userId === null || numberDraft.trim().length === 0 || createLink.isPending}
          >
            Link
          </Button>
          {error ? <span className="font-sans text-meta text-danger">{error}</span> : null}
        </form>
      ) : null}
    </section>
  );
}
