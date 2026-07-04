import { useState } from 'react';
import type { BoardTicket } from '../api/types';
import { useTicketEvents } from '../api/use-ticket-events';

function summarizePayload(kind: string, payload: Record<string, unknown>): string {
  if (kind === 'status-changed' || kind === 'value-changed') {
    const fieldKey = typeof payload.fieldKey === 'string' ? payload.fieldKey : 'value';
    return `${fieldKey}: ${JSON.stringify(payload.from) ?? '—'} → ${JSON.stringify(payload.to) ?? '—'}`;
  }
  if (kind === 'link-added' || kind === 'link-removed') {
    return typeof payload.linkTypeKey === 'string' ? payload.linkTypeKey : '';
  }
  return '';
}

export function DetailActivity({ ticket }: { ticket: BoardTicket }) {
  const [open, setOpen] = useState(false);
  const events = useTicketEvents(open ? ticket.id : null);

  return (
    <div className="comments">
      <details onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary
          style={{
            cursor: 'pointer',
            color: 'var(--muted)',
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Activity
        </summary>
        {events.data ? (
          <div style={{ marginTop: 8 }}>
            {events.data.data.map((event) => (
              <div
                key={event.id}
                style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 12.5 }}
              >
                <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{event.actorName}</span>
                <span style={{ color: 'var(--ink-2)' }}>{event.kind}</span>
                <span style={{ color: 'var(--muted)', flex: 1 }}>
                  {summarizePayload(event.kind, event.payload)}
                </span>
                <span style={{ color: 'var(--muted)' }}>
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : open ? (
          <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Loading…</p>
        ) : null}
      </details>
    </div>
  );
}
