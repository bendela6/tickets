import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, BoardTicket } from '../api/types';
import { usePatchTicket } from '../api/use-patch-ticket';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';
import { ValueBadge } from './value-badge';

// Status badge that turns into a transition-filtered select on click —
// the one inline edit the table offers; everything else edits in the drawer.
export function InlineStatusCell({
  board,
  indexes,
  ticket,
}: {
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
}) {
  const { userId } = useCurrentUser();
  const patch = usePatchTicket();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const statusField = indexes.statusField;
  if (!statusField) {
    return null;
  }
  const raw = ticket.values[statusField.key];
  const status = typeof raw === 'string' ? indexes.statusByKey.get(raw) : undefined;

  if (!editing) {
    const mark =
      status?.kind === 'done' ? 'done' : status?.kind === 'dropped' ? 'dropped' : undefined;
    return (
      <button
        type="button"
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
        }}
        title={userId === null ? 'Pick a user in the header to edit' : 'Change status'}
        onClick={(event) => {
          event.stopPropagation();
          if (userId !== null) {
            setEditing(true);
          }
        }}
      >
        <ValueBadge
          label={status?.label ?? String(raw ?? '—')}
          color={status?.config.color}
          mark={mark}
        />
      </button>
    );
  }
  return (
    <select
      autoFocus
      style={{
        font: 'inherit',
        fontSize: 12.5,
        color: 'var(--ink)',
        background: 'var(--surface)',
        border: '1px solid var(--ring)',
        borderRadius: 6,
        padding: '2px 6px',
      }}
      value={typeof raw === 'string' ? raw : ''}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => setEditing(false)}
      onChange={(event) => {
        event.stopPropagation();
        setEditing(false);
        if (userId === null || event.target.value === raw) {
          return;
        }
        patch.mutate(
          {
            ticketId: ticket.id,
            actorId: userId,
            expectedUpdatedAt: ticket.updatedAt,
            values: { [statusField.key]: event.target.value },
          },
          { onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }) },
        );
      }}
    >
      {legalStatusTargets(board, indexes, ticket).map((target) => (
        <option key={target.id} value={target.key}>
          {target.label}
        </option>
      ))}
    </select>
  );
}
