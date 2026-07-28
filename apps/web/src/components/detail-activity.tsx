import { docToText, parseDoc } from '@tickets/richtext';
import type { ReactNode } from 'react';
import type { ActivityEntry, Item } from '../api/types';
import { useItemActivity } from '../api/use-item-activity';
import { Avatar, RelativeDate } from '@tickets/ui';
import { avatarFor } from '../domain/actor';
import type { BoardIndexes } from '../utils/index-board';

// Matches the excerpt length the api projection uses for comment bodies
// (apps/api/src/projection/item-activity.ts) so field-changed diffs read
// consistently with comment excerpts.
const CHIP_EXCERPT_LENGTH = 140;

function chipText(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value !== 'string') {
    return JSON.stringify(value);
  }
  // field_changed from/to values may be a serialized tiptap doc (e.g. a
  // description edit) — render plain text, not raw doc JSON.
  const doc = parseDoc(value);
  const text = doc ? docToText(doc) : value;
  return text.length > CHIP_EXCERPT_LENGTH
    ? `${text.slice(0, CHIP_EXCERPT_LENGTH)}…`
    : text;
}

function ValueChip({ value }: { value: unknown }) {
  const text = chipText(value);
  return (
    <span className="rounded-sm bg-surface-inset px-1.25 py-px font-mono text-11 text-gray-12">{text}</span>
  );
}

// One compact line per entry: what happened, read from the SP3 projection's
// self-contained summary (apps/api/src/projection/item-activity.ts
// summarize()) — field_changed stores the raw {fieldKey,from,to} payload,
// comment.added stores {commentId,excerpt}, item.created stores
// {typeKey,number,title}; the rest (reparented/archived/restored/linked/
// unlinked) store their event payload verbatim.
function describe(entry: ActivityEntry): ReactNode {
  const summary = entry.summary;
  if (entry.kind === 'item.created') {
    return 'created';
  }
  if (entry.kind === 'item.field_changed') {
    const fieldKey =
      typeof summary.field === 'string'
        ? summary.field
        : typeof summary.fieldKey === 'string'
          ? summary.fieldKey
          : 'value';
    return (
      <>
        {fieldKey}: <ValueChip value={summary.from} /> → <ValueChip value={summary.to} />
      </>
    );
  }
  if (entry.kind === 'comment.added') {
    return typeof summary.excerpt === 'string' && summary.excerpt.length > 0
      ? summary.excerpt
      : 'commented';
  }
  if (entry.kind === 'item.linked' || entry.kind === 'item.unlinked') {
    const linkTypeKey = typeof summary.linkTypeKey === 'string' ? summary.linkTypeKey : '';
    return `${entry.kind === 'item.linked' ? 'linked' : 'unlinked'} ${linkTypeKey}`.trim();
  }
  if (entry.kind === 'item.archived' || entry.kind === 'item.restored') {
    return entry.kind === 'item.archived' ? 'archived' : 'restored';
  }
  if (entry.kind === 'item.reparented') {
    return 'changed the parent';
  }
  // fallback: a readable form of the raw kind, e.g. 'item.field_changed'
  return entry.kind.replace(/[._]/g, ' ');
}

// Fetches on mount — the drawer only mounts this when its Activity tab is
// active, the full page keeps it in the right rail permanently.
export function DetailActivity({ item, indexes }: { item: Item; indexes: BoardIndexes }) {
  const activity = useItemActivity(item.id);

  if (activity.isError) {
    return (
      <p className="m-0 font-sans text-12/17 text-red-9">{(activity.error as Error).message}</p>
    );
  }
  if (!activity.data) {
    return <p className="m-0 font-sans text-12/17 text-gray-9">Loading…</p>;
  }
  if (activity.data.length === 0) {
    return <p className="m-0 font-sans text-12/17 text-gray-9">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.75">
      {activity.data.map((entry) => {
        const actor = indexes.userById.get(entry.actorId);
        const name = actor?.name ?? `user ${entry.actorId}`;
        return (
          <div key={entry.id} className="flex items-start gap-2.25">
            <Avatar name={name} {...avatarFor(actor?.kind ?? 'human')} size="sm" className="mt-0.5" />
            <span className="min-w-0 flex-1 font-sans text-12/17 leading-normal text-gray-11">
              <span className="font-500 text-gray-12">{name}</span> {describe(entry)}
            </span>
            <RelativeDate value={entry.at} className="shrink-0 font-mono text-10 text-gray-9" />
          </div>
        );
      })}
    </div>
  );
}
