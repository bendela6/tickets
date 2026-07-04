import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { Board } from '../api/types';
import { useCreateTicket } from '../api/use-create-ticket';
import { FieldWidget } from '../registry/field-widget';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';

export function NewTicketDialog({
  projectKey,
  board,
  indexes,
  open,
  onClose,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const createTicket = useCreateTicket();
  const types = board.types
    .filter((type) => !type.archivedAt)
    .sort((left, right) => left.position - right.position);
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? 'task');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');

  if (!open) {
    return null;
  }
  const type = types.find((candidate) => candidate.key === typeKey) ?? types[0];
  const typeFields = board.typeFields
    .filter((row) => row.ticketTypeId === type?.id)
    .sort((left, right) => left.position - right.position);

  const close = () => {
    setValues({});
    setError('');
    onClose();
  };

  const create = async () => {
    setError('');
    if (userId === null) {
      setError('pick a user in the header first');
      return;
    }
    for (const typeField of typeFields) {
      const field = indexes.fieldById.get(typeField.fieldId);
      if (!field || !typeField.required) {
        continue;
      }
      const value = values[field.key];
      if (value === undefined || value === null || value === '') {
        setError(`"${field.label}" is required`);
        return;
      }
    }
    try {
      const created = await createTicket.mutateAsync({
        projectKey,
        actorId: userId,
        typeKey: type?.key ?? 'task',
        values,
      });
      close();
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, t: created.number }),
      });
    } catch (createError) {
      setError((createError as Error).message);
    }
  };

  return (
    <>
      <div className="overlay open" onClick={close} />
      <dialog
        open
        style={{
          position: 'fixed',
          top: '10vh',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
        }}
      >
        <div className="dialog-head">
          <h2>New ticket</h2>
        </div>
        <div className="dialog-form">
          <div className="chipset" role="group" aria-label="Ticket type">
            {types.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={`chip${candidate.key === typeKey ? ' on' : ''}`}
                onClick={() => setTypeKey(candidate.key)}
              >
                {candidate.label}
              </button>
            ))}
          </div>
          {typeFields.map((typeField) => {
            const field = indexes.fieldById.get(typeField.fieldId);
            if (!field || field.archivedAt) {
              return null;
            }
            return (
              <label key={field.id}>
                {field.label}
                {typeField.required ? ' *' : ''}
                <FieldWidget
                  field={field}
                  value={values[field.key]}
                  board={board}
                  indexes={indexes}
                  ticket={null}
                  onChange={(next) => setValues((previous) => ({ ...previous, [field.key]: next }))}
                />
              </label>
            );
          })}
          <div className="error">{error}</div>
          <div className="actions">
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={createTicket.isPending}
              onClick={() => void create()}
            >
              Create
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
