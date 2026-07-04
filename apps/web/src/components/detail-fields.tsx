import { useQueryClient } from '@tanstack/react-query';
import type { Board, BoardTicket } from '../api/types';
import { usePatchTicket } from '../api/use-patch-ticket';
import { FieldWidget } from '../registry/field-widget';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';

export function DetailFields({
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

  const typeFields = board.typeFields
    .filter((row) => row.ticketTypeId === ticket.typeId)
    .sort((left, right) => left.position - right.position);

  const saveValue = (fieldKey: string, next: unknown) => {
    if (userId === null) {
      return;
    }
    patch.mutate(
      {
        ticketId: ticket.id,
        actorId: userId,
        expectedUpdatedAt: ticket.updatedAt,
        values: { [fieldKey]: next },
      },
      {
        onError: () => {
          // stale lock or validation error — refetch so the form shows reality
          void queryClient.invalidateQueries({ queryKey: ['board'] });
        },
      },
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 14 }}>
      {userId === null ? (
        <p style={{ color: 'var(--warning)', fontSize: 12.5, margin: 0 }}>
          Pick a user in the header to edit tickets.
        </p>
      ) : null}
      {patch.isError ? (
        <p style={{ color: 'var(--critical)', fontSize: 12.5, margin: 0 }}>
          {(patch.error as Error).message}
        </p>
      ) : null}
      {typeFields.map((typeField) => {
        const field = indexes.fieldById.get(typeField.fieldId);
        if (!field || field.archivedAt) {
          return null;
        }
        return (
          <label key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
              {field.label}
              {typeField.required ? ' *' : ''}
            </span>
            <FieldWidget
              field={field}
              value={ticket.values[field.key]}
              disabled={userId === null || patch.isPending}
              board={board}
              indexes={indexes}
              ticket={ticket}
              onChange={(next) => saveValue(field.key, next)}
            />
          </label>
        );
      })}
    </div>
  );
}
