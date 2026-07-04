import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { Board, BoardTicket } from '../api/types';
import { useCreateLink } from '../api/use-create-link';
import { useDeleteLink } from '../api/use-delete-link';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';

export function DetailLinks({
  board,
  indexes,
  ticket,
}: {
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
}) {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const createLink = useCreateLink();
  const deleteLink = useDeleteLink();
  const [linkTypeKey, setLinkTypeKey] = useState(board.linkTypes[0]?.key ?? 'blocks');
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing');
  const [numberDraft, setNumberDraft] = useState('');
  const [error, setError] = useState('');

  const inputStyle = {
    font: 'inherit',
    fontSize: 12.5,
    color: 'var(--ink)',
    background: 'var(--page)',
    border: '1px solid var(--ring)',
    borderRadius: 6,
    padding: '4px 8px',
  } as const;
  const selectedType = board.linkTypes.find((candidate) => candidate.key === linkTypeKey);

  return (
    <div className="comments" style={{ marginTop: 22 }}>
      <h2>Links</h2>
      {ticket.links.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>No links.</p>
      ) : (
        ticket.links.map((link) => {
          const linkType = board.linkTypes.find((candidate) => candidate.id === link.linkTypeId);
          const outgoing = link.sourceTicketId === ticket.id;
          const otherId = outgoing ? link.targetTicketId : link.sourceTicketId;
          const other = indexes.ticketById.get(otherId);
          if (!linkType || !other) {
            return null;
          }
          return (
            <div
              key={link.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
            >
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                {outgoing ? linkType.label : linkType.inverseLabel}
              </span>
              <button
                type="button"
                className="dep-badge"
                onClick={() =>
                  void navigate({
                    to: '.',
                    search: (previous: Record<string, unknown>) => ({
                      ...previous,
                      t: other.number,
                    }),
                  })
                }
              >
                {board.project.ticketPrefix}-{other.number}
              </button>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>
                {String(other.values['title'] ?? '')}
              </span>
              <button
                type="button"
                className="icon-btn"
                title="Remove link"
                disabled={userId === null}
                onClick={() => {
                  if (userId !== null) {
                    deleteLink.mutate({ linkId: link.id, actorId: userId });
                  }
                }}
              >
                ✕
              </button>
            </div>
          );
        })
      )}
      <div
        style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <select
          style={inputStyle}
          value={linkTypeKey}
          onChange={(event) => setLinkTypeKey(event.target.value)}
        >
          {board.linkTypes.map((linkType) => (
            <option key={linkType.id} value={linkType.key}>
              {linkType.key}
            </option>
          ))}
        </select>
        <select
          style={inputStyle}
          value={direction}
          onChange={(event) => setDirection(event.target.value as 'outgoing' | 'incoming')}
        >
          <option value="outgoing">{selectedType?.label ?? 'outgoing'} →</option>
          <option value="incoming">← {selectedType?.inverseLabel ?? 'incoming'}</option>
        </select>
        <input
          style={{ ...inputStyle, width: 90 }}
          placeholder="number"
          value={numberDraft}
          onChange={(event) => setNumberDraft(event.target.value)}
        />
        <button
          type="button"
          className="btn"
          disabled={userId === null || numberDraft.trim().length === 0}
          onClick={async () => {
            setError('');
            const other = indexes.ticketByNumber.get(Number(numberDraft.trim()));
            if (!other) {
              setError(`no ticket #${numberDraft.trim()}`);
              return;
            }
            if (userId === null) {
              return;
            }
            try {
              await createLink.mutateAsync({
                actorId: userId,
                linkTypeKey,
                sourceTicketId: direction === 'outgoing' ? ticket.id : other.id,
                targetTicketId: direction === 'outgoing' ? other.id : ticket.id,
              });
              setNumberDraft('');
            } catch (linkError) {
              setError((linkError as Error).message);
            }
          }}
        >
          Link
        </button>
        {error ? <span style={{ color: 'var(--critical)', fontSize: 12 }}>{error}</span> : null}
      </div>
    </div>
  );
}
