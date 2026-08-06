import { useQueryClient } from '@tanstack/react-query';
import type { Board, Item } from '../api/types';
import { usePatchItem } from '../api/use-patch-item';
import { FieldWidget } from '../registry/field-widget';
import { SectionHeader } from '@tickets/ui';
import { useCurrentUser } from '../state/current-user-context';
import type { BoardIndexes } from '../utils/index-board';

// Title and description are rendered as dedicated surfaces (big heading +
// markdown section) by ItemDetail, so the form skips them here.
const LIFTED_KEYS = new Set(['title', 'description']);

// The per-type field form.
//
// `layout` no longer picks the VISUAL shape — design file 20 makes that a
// function of the container's width, and the same rules now live in
// `FieldWrapper`: labels move beside the field at >=520px, and fields pair into
// two columns at >=760px. Both are container queries, so the drawer stacks and
// the wide page pairs without either caller being told which it is.
//
// What `layout` still decides is what the container SHEDS, which is a genuine
// per-container judgement rather than a width: the drawer's header owns the
// status select, so the drawer must not draw it twice. That is the "honest
// container" idea from the design file, and it cannot be derived from a width.
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
    <div className="flex flex-col gap-10">
      {userId === null ? (
        <p className="m-0 font-sans text-12/17 text-orange-9">
          Pick a user in the header to edit items.
        </p>
      ) : null}
      {patch.isError ? (
        <p className="m-0 font-sans text-12/17 text-red-9">{(patch.error as Error).message}</p>
      ) : null}
      {/* The container both rules below measure themselves against. An element
          cannot query the container it establishes, so this wrapper exists
          purely to be measured. */}
      <div className="@container">
        <div className="flex flex-col gap-12 @form-columns:grid @form-columns:grid-cols-2 @form-columns:gap-x-18 @form-columns:gap-y-10">
          {rows.map(({ placement, field }) => (
            // Each field measures its own box too, so a field sitting in one
            // half of the two-column grid asks about the ~370px it actually
            // has rather than the form's full width — and correctly keeps its
            // label on top, since 370px cannot hold a 104px label column plus
            // a usable control.
            <label key={field.id} className="@container">
              <span className="flex flex-col gap-5 @form-labels:flex-row @form-labels:items-start @form-labels:gap-10">
                <SectionHeader
                  title={
                    <>
                      {field.label}
                      {placement.required ? <span className="text-red-9"> *</span> : null}
                    </>
                  }
                  className="@form-labels:w-104 @form-labels:shrink-0 @form-labels:pt-10"
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
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
