import { useState } from 'react';
import type { Board, LinkType } from '../../api/types';
import { useCreateLinkType } from '../../api/use-create-link-type';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { cn } from '../../ui/cn';
import { Input } from '../../ui/input';
import type { BoardIndexes } from '../../utils/index-board';

const GRID = 'grid-cols-[1fr_1.3fr_1.3fr_110px]';

// Same folded-direction chip text as detail-links: outgoing "label →",
// incoming "← inverseLabel", symmetric "label ↔".
function DirectionChip({ text }: { text: string }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-ctrl bg-inset px-2 font-sans text-label font-medium text-ink-2">
      {text}
    </span>
  );
}

function ArchChip() {
  return (
    <span className="inline-flex h-[17px] shrink-0 items-center rounded-[4px] bg-inset px-1.5 font-mono text-[10px] font-medium text-ink-3">
      ARCH
    </span>
  );
}

// Project link-type vocabulary: list + create only — the API has no PATCH for
// link types (docs/api/create-link-type.md). Note: link types carry no
// createdAt, so the table shows direction instead of a created column.
export function LinkTypesSettings({
  board,
  projectKey,
}: {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
}) {
  const createLinkType = useCreateLinkType();

  const [composing, setComposing] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [outwardDraft, setOutwardDraft] = useState('');
  const [inwardDraft, setInwardDraft] = useState('');
  const [directional, setDirectional] = useState(true);
  const [error, setError] = useState('');

  const linkTypes: LinkType[] = [...board.linkTypes].sort(
    (left, right) =>
      Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt)) ||
      left.position - right.position,
  );
  const archivedCount = linkTypes.filter((linkType) => linkType.archivedAt).length;
  const countLabel =
    `${linkTypes.length} ${linkTypes.length === 1 ? 'link type' : 'link types'}` +
    (archivedCount > 0 ? ` · ${archivedCount} archived` : '');

  const submit = async () => {
    setError('');
    const key = keyDraft.trim();
    const label = outwardDraft.trim();
    // per the API doc, symmetric types use the same label both ways
    const inverseLabel = inwardDraft.trim() || label;
    if (key.length === 0 || label.length === 0) {
      return;
    }
    try {
      await createLinkType.mutateAsync({ projectKey, key, label, inverseLabel, directional });
      setKeyDraft('');
      setOutwardDraft('');
      setInwardDraft('');
    } catch (createError) {
      setError((createError as Error).message);
    }
  };

  return (
    <section className="flex min-h-0 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-ink">Link types</h1>
        <span className="font-mono text-meta text-ink-3">{countLabel}</span>
        <span className="flex-1" />
        <Button variant="primary" className="h-8" onClick={() => setComposing((value) => !value)}>
          ＋ New link type
        </Button>
      </div>

      <div className="overflow-hidden rounded-panel border border-hairline bg-raised">
        <div
          className={cn(
            'grid h-9 items-center border-b border-hairline bg-app px-1',
            'font-sans text-label font-medium uppercase text-ink-2',
            GRID,
          )}
        >
          <span className="px-3">Key</span>
          <span className="px-2">Outward</span>
          <span className="px-2">Inward</span>
          <span className="px-2">Direction</span>
        </div>

        {linkTypes.length === 0 ? (
          <p className="m-0 px-4 py-6 text-center font-sans text-meta text-ink-3">
            No link types yet.
          </p>
        ) : (
          linkTypes.map((linkType) => (
            <div
              key={linkType.id}
              className={cn(
                'grid h-11 items-center border-b border-hairline px-1',
                GRID,
                linkType.archivedAt && 'opacity-60',
              )}
            >
              <span className="flex min-w-0 items-center gap-2 px-3">
                <span className="truncate font-mono text-meta text-ink">{linkType.key}</span>
                {linkType.archivedAt ? <ArchChip /> : null}
              </span>
              <span className="min-w-0 px-2">
                <DirectionChip
                  text={linkType.directional ? `${linkType.label} →` : `${linkType.label} ↔`}
                />
              </span>
              <span className="min-w-0 px-2">
                <DirectionChip
                  text={linkType.directional ? `← ${linkType.inverseLabel}` : `${linkType.label} ↔`}
                />
              </span>
              <span className="px-2 font-mono text-meta text-ink-3">
                {linkType.directional ? 'directional' : 'symmetric'}
              </span>
            </div>
          ))
        )}

        {composing ? (
          <form
            className="flex flex-wrap items-center gap-1.5 bg-app px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Input
              size="compact"
              className="w-32 font-mono"
              placeholder="key"
              aria-label="Key"
              autoFocus
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
            <Input
              size="compact"
              className="w-36"
              placeholder="Outward label"
              aria-label="Outward label"
              value={outwardDraft}
              onChange={(event) => setOutwardDraft(event.target.value)}
            />
            <Input
              size="compact"
              className="w-36"
              placeholder="Inward label"
              aria-label="Inward label"
              value={inwardDraft}
              onChange={(event) => setInwardDraft(event.target.value)}
            />
            <Checkbox
              label="directional"
              checked={directional}
              onChange={(event) => setDirectional(event.target.checked)}
            />
            <Button
              type="submit"
              variant="primary"
              size="compact"
              disabled={
                keyDraft.trim().length === 0 ||
                outwardDraft.trim().length === 0 ||
                createLinkType.isPending
              }
              loading={createLinkType.isPending}
            >
              Create link type
            </Button>
            {error ? <span className="font-sans text-meta text-danger">{error}</span> : null}
          </form>
        ) : null}
      </div>
    </section>
  );
}
