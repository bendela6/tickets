import type { ReactNode } from 'react';
import type { BoardTicket, TicketEvent } from '../api/types';
import { useTicketEvents } from '../api/use-ticket-events';
import { Avatar } from '../ui/avatar';
import { RelativeDate } from '../ui/relative-date';
import type { BoardIndexes } from '../utils/index-board';

function ValueChip({ value }: { value: unknown }) {
  const text =
    value === null || value === undefined
      ? '—'
      : typeof value === 'string'
        ? value
        : JSON.stringify(value);
  return (
    <span className="rounded-sm bg-inset px-1.25 py-px font-mono text-[11px] text-ink">{text}</span>
  );
}

// One compact line per event: who did what, from → to where it applies.
function describe(event: TicketEvent): ReactNode {
  const payload = event.payload;
  if (event.kind === 'status-changed' || event.kind === 'value-changed') {
    const fieldKey = typeof payload.fieldKey === 'string' ? payload.fieldKey : 'value';
    return (
      <>
        {event.kind === 'status-changed' ? 'moved' : `set ${fieldKey}`}{' '}
        <ValueChip value={payload.from} /> → <ValueChip value={payload.to} />
      </>
    );
  }
  if (event.kind === 'link-added' || event.kind === 'link-removed') {
    const linkTypeKey = typeof payload.linkTypeKey === 'string' ? payload.linkTypeKey : '';
    return `${event.kind === 'link-added' ? 'added link' : 'removed link'} ${linkTypeKey}`.trim();
  }
  if (event.kind === 'created') {
    return 'created this ticket';
  }
  if (event.kind === 'commented') {
    return 'commented';
  }
  if (event.kind === 'archived' || event.kind === 'unarchived') {
    return `${event.kind} this ticket`;
  }
  if (event.kind === 'parent-changed') {
    return 'changed the parent';
  }
  return event.kind;
}

// Fetches on mount — the drawer only mounts this when its Activity tab is
// active, the full page keeps it in the right rail permanently.
export function DetailActivity({
  ticket,
  indexes,
}: {
  ticket: BoardTicket;
  indexes: BoardIndexes;
}) {
  const events = useTicketEvents(ticket.id);

  if (events.isError) {
    return <p className="m-0 font-sans text-meta text-danger">{(events.error as Error).message}</p>;
  }
  if (!events.data) {
    return <p className="m-0 font-sans text-meta text-ink-3">Loading…</p>;
  }
  if (events.data.data.length === 0) {
    return <p className="m-0 font-sans text-meta text-ink-3">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.75">
      {events.data.data.map((event) => {
        const actor = indexes.userById.get(event.actorId);
        const name = event.actorName ?? actor?.name ?? `user ${event.actorId}`;
        return (
          <div key={event.id} className="flex items-start gap-2.25">
            <Avatar name={name} kind={actor?.kind ?? 'human'} size="sm" className="mt-0.5" />
            <span className="min-w-0 flex-1 font-sans text-meta leading-normal text-ink-2">
              <span className="font-medium text-ink">{name}</span> {describe(event)}
            </span>
            <RelativeDate
              value={event.createdAt}
              className="shrink-0 font-mono text-[10px] text-ink-3"
            />
          </div>
        );
      })}
    </div>
  );
}
