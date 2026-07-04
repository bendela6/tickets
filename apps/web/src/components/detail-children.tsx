import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { Board, BoardTicket } from '../api/types';
import { useCreateTicket } from '../api/use-create-ticket';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';
import { getCellContent } from '../registry/get-cell-content';

export function DetailChildren({
  projectKey,
  board,
  indexes,
  ticket,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
}) {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const createTicket = useCreateTicket();
  const [title, setTitle] = useState('');
  const children = (indexes.childrenByParent.get(ticket.id) ?? []).sort(
    (left, right) => left.number - right.number,
  );
  const statusField = indexes.statusField;

  const openChild = (childNumber: number) => {
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, t: childNumber }),
    });
  };

  return (
    <div className="subtasks">
      <h2>Subtasks</h2>
      {children.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>No subtasks.</p>
      ) : (
        children.map((child) => (
          <div
            key={child.id}
            className="subtask"
            style={{ cursor: 'pointer' }}
            onClick={() => openChild(child.number)}
          >
            <span className="st-id">
              {board.project.ticketPrefix}-{child.number}
            </span>
            <div className="st-main">
              <div className="st-title">{String(child.values['title'] ?? '')}</div>
            </div>
            {statusField
              ? getCellContent(statusField, child.values[statusField.key], indexes)
              : null}
          </div>
        ))
      )}
      <form
        className="subtask-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (userId === null || title.trim().length === 0) {
            return;
          }
          await createTicket.mutateAsync({
            projectKey,
            actorId: userId,
            typeKey: 'subtask',
            parentId: ticket.id,
            values: { title: title.trim() },
          });
          setTitle('');
        }}
      >
        <input
          placeholder="Add a subtask…"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={userId === null}
        />
        <button type="submit" className="btn" disabled={userId === null}>
          Add
        </button>
      </form>
    </div>
  );
}
