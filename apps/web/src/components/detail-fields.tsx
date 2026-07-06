import { useQueryClient } from '@tanstack/react-query';
import type { Board, BoardTicket } from '../api/types';
import { usePatchTicket } from '../api/use-patch-ticket';
import { FieldWidget } from '../registry/field-widget';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';

// Title and description are rendered as dedicated surfaces (big heading +
// markdown section) by TicketDetail, so the form skips them here.
const LIFTED_KEYS = new Set(['title', 'description']);

// The per-type field form. Two layouts per the design: 'grid' is the drawer's
// compact two-column grid (label left, control right; status lives in the
// drawer header); 'rail' is the full page's stacked right-rail form (label
// above control, status included).
export function DetailFields({
  board,
  indexes,
  ticket,
  layout,
}: {
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket;
  layout: 'grid' | 'rail';
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

  const rows = typeFields.flatMap((typeField) => {
    const field = indexes.fieldById.get(typeField.fieldId);
    if (!field || field.archivedAt || LIFTED_KEYS.has(field.key)) {
      return [];
    }
    if (layout === 'grid' && field.type === 'status') {
      return []; // the drawer header owns the status select
    }
    return [{ typeField, field }];
  });

  return (
    <div className="flex flex-col gap-2.5">
      {userId === null ? (
        <p className="m-0 font-sans text-meta text-kind-blocked">
          Pick a user in the header to edit tickets.
        </p>
      ) : null}
      {patch.isError ? (
        <p className="m-0 font-sans text-meta text-danger">{(patch.error as Error).message}</p>
      ) : null}
      <div
        className={
          layout === 'grid' ? 'grid grid-cols-2 gap-x-4.5 gap-y-2.5' : 'flex flex-col gap-3'
        }
      >
        {rows.map(({ typeField, field }) => (
          <label
            key={field.id}
            className={
              layout === 'grid' ? 'flex min-w-0 items-start gap-2.5' : 'flex flex-col gap-1.25'
            }
          >
            <span
              className={
                layout === 'grid'
                  ? 'w-19 shrink-0 pt-2.5 font-sans text-label font-medium uppercase text-ink-2'
                  : 'font-sans text-label font-medium uppercase text-ink-2'
              }
            >
              {field.label}
              {typeField.required ? <span className="text-danger"> *</span> : null}
            </span>
            <span className="min-w-0 flex-1">
              <FieldWidget
                field={field}
                value={ticket.values[field.key]}
                disabled={userId === null || patch.isPending}
                board={board}
                indexes={indexes}
                ticket={ticket}
                onChange={(next) => saveValue(field.key, next)}
              />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
