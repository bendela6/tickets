import { OWN_ERROR } from '../api/mutation-meta';
import { useState } from 'react';
import type { Board, Item } from '../api/types';
import { useCreateLink } from '../api/use-create-link';
import { useDeleteLink } from '../api/use-delete-link';
import { useCurrentUser } from '../state/current-user-context';
import { Button, Combobox, type Option, Icon, Input, Pill, ScreenState, SectionHeader } from '@bh/ui';
import { ItemKey } from './item-key';
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

// The item a typed key names on this board: the key as it is, in any case, or
// a bare number for the item with that number (`131` for TIX-131).
function findItem(indexes: BoardIndexes, typed: string) {
  const key = typed.trim();
  if (/^\d+$/.test(key)) {
    return indexes.itemByNumber.get(Number(key));
  }
  const upper = key.toUpperCase();
  return (
    indexes.itemByKey.get(key) ??
    [...indexes.itemByKey.values()].find((candidate) => candidate.key.toUpperCase() === upper)
  );
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
  onOpenItem: (itemKey: string) => void;
}) {
  const { userId } = useCurrentUser();
  const createLink = useCreateLink(OWN_ERROR);
  const deleteLink = useDeleteLink();

  // One entry per key: a plan scheme's types each own their own `blocks`.
  const seenKeys = new Set<string>();
  const linkTypes = [...board.linkTypes]
    .filter((linkType) => !linkType.archivedAt)
    .sort((left, right) => left.position - right.position)
    .filter((linkType) => !seenKeys.has(linkType.key) && Boolean(seenKeys.add(linkType.key)));
  // `${key}|out` / `${key}|in` — one combobox entry per legal direction.
  const options: Option[] = linkTypes.flatMap((linkType) =>
    linkType.directional
      ? [
          { value: `${linkType.key}|out`, label: `${linkType.label} →` },
          { value: `${linkType.key}|in`, label: `← ${linkType.inverseLabel}` },
        ]
      : [{ value: `${linkType.key}|out`, label: `${linkType.label} ↔` }],
  );

  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<string | null>(() => options[0]?.value ?? null);
  const [keyDraft, setKeyDraft] = useState('');
  const [whyDraft, setWhyDraft] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (choice === null) {
      return;
    }
    const other = findItem(indexes, keyDraft);
    if (!other) {
      setError(`no item ${keyDraft.trim()}`);
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
        ...(whyDraft.trim().length > 0 ? { why: whyDraft.trim() } : {}),
      });
      setKeyDraft('');
      setWhyDraft('');
    } catch (linkError) {
      setError((linkError as Error).message);
    }
  };

  return (
    <section>
      <SectionHeader
        title="Links"
        action={
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => setAdding((value) => !value)}>
            <Icon name="plus" size="sm" />
            Add link
          </Button>
        }
        className="mb-8"
      />
      <div className="flex flex-col gap-6">
        {item.links.length === 0 ? (
          <ScreenState className="px-12 py-20" title="No links." />
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
              <div key={link.id} className="rounded-8 border-1 border-gray-6 hover:bg-gray-1">
                <div className="flex h-34 items-center gap-9 px-11">
                  <Pill
                    tone={chip.blocked ? 'orange' : 'secondary'}
                    label={chip.text}
                    className="h-20 rounded-6 text-11/13 tracking-wider"
                  />
                  <button
                    type="button"
                    className="shrink-0"
                    onClick={() => onOpenItem(other.key)}
                  >
                    <ItemKey itemKey={other.key} className="text-11 hover:text-indigo-9" />
                  </button>
                  <span className="min-w-0 flex-1 truncate font-sans text-13/19 text-gray-11">
                    {String(other.values['title'] ?? '')}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove link"
                    title="Remove link"
                    disabled={userId === null || deleteLink.isPending}
                    className="shrink-0 font-sans text-12/17 text-gray-9 hover:text-red-9 disabled:opacity-50"
                    onClick={() => {
                      if (userId !== null) {
                        deleteLink.mutate({ linkId: link.id, actorId: userId });
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
                {link.why ? (
                  <p className="m-0 px-11 pb-8 font-sans text-12/17 text-gray-11">{link.why}</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      {adding ? (
        <form
          className="mt-8 flex flex-wrap items-center gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Combobox
            size="xs"
            className="w-176"
            options={options}
            value={choice}
            disabled={userId === null}
            onChange={setChoice}
          />
          <Input
            size="xs"
            className="w-112"
            placeholder={item.key}
            aria-label="Item key"
            value={keyDraft}
            disabled={userId === null}
            onChange={(next) => setKeyDraft(next)}
          />
          <Input
            size="xs"
            className="min-w-160 flex-1"
            placeholder={board.plan ? 'Why it waits' : 'Why (optional)'}
            aria-label="Why"
            value={whyDraft}
            disabled={userId === null}
            onChange={(next) => setWhyDraft(next)}
          />
          <Button
            type="submit"
            size="sm"
            disabled={userId === null || keyDraft.trim().length === 0 || createLink.isPending}
          >
            Link
          </Button>
          {error ? <span className="font-sans text-12/17 text-red-9">{error}</span> : null}
        </form>
      ) : null}
    </section>
  );
}
