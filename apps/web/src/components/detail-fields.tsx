import { useQueryClient } from '@tanstack/react-query';
import type { Board, Item } from '../api/types';
import { usePatchItem } from '../api/use-patch-item';
import { FieldWidget } from '../registry/field-widget';
import { SectionHeader } from '@tickets/ui/section-header';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';

// Title and description are rendered as dedicated surfaces (big heading +
// markdown section) by ItemDetail, so the form skips them here.
const LIFTED_KEYS = new Set(['title', 'description']);

// The per-type field form. Two layouts per the design: 'grid' is the drawer's
// compact two-column grid (label left, control right; status lives in the
// drawer header); 'rail' is the full page's stacked right-rail form (label
// above control, status included).
export function DetailFields({
  board,
  indexes,
  item,
  layout,
}: {
  board: Board;
  indexes: BoardIndexes;
  item: Item;
  layout: 'grid' | 'rail';
}) {
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const queryClient = useQueryClient();

  const placements = indexes.placementsByType.get(item.typeId) ?? [];

  const saveValue = (fieldKey: string, next: unknown) => {
    if (userId === null) {
      return;
    }
    patch.mutate(
      {
        itemId: item.id,
        actorId: userId,
        expectedUpdatedAt: item.updatedAt,
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

  const rows = placements.flatMap((placement) => {
    const field = indexes.fieldById.get(placement.fieldId);
    if (!field || field.archivedAt || LIFTED_KEYS.has(field.key)) {
      return [];
    }
    if (layout === 'grid' && field.config.workflow === true) {
      return []; // the drawer header owns the status select
    }
    return [{ placement, field }];
  });

  return (
    <div className="flex flex-col gap-2.5">
      {userId === null ? (
        <p className="m-0 font-sans text-meta text-opt-orange">
          Pick a user in the header to edit items.
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
        {rows.map(({ placement, field }) => (
          <label
            key={field.id}
            className={
              layout === 'grid' ? 'flex min-w-0 items-start gap-2.5' : 'flex flex-col gap-1.25'
            }
          >
            <SectionHeader
              title={
                <>
                  {field.label}
                  {placement.required ? <span className="text-danger"> *</span> : null}
                </>
              }
              className={layout === 'grid' ? 'w-19 shrink-0 pt-2.5' : undefined}
            />
            <span className="min-w-0 flex-1">
              <FieldWidget
                field={field}
                value={item.values[field.key]}
                disabled={userId === null || patch.isPending}
                board={board}
                indexes={indexes}
                ticket={item}
                typeId={item.typeId}
                onChange={(next) => saveValue(field.key, next)}
              />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
