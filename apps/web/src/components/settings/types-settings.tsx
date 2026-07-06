import type { Board } from '../../api/types';
import { cn } from '../../ui/cn';
import { TypeBadge } from '../../ui/type-badge';
import type { BoardIndexes } from '../../utils/index-board';

function ArchChip() {
  return (
    <span className="inline-flex h-[17px] shrink-0 items-center rounded-[4px] bg-inset px-1.5 font-mono text-[10px] font-medium text-ink-3">
      ARCH
    </span>
  );
}

// Read-only rendering of the type→field mapping, per the form-builder screen in
// docs/design/06-settings-admin.html §158–241: one card per type, its fields in
// position order (which IS the form order), mono field type, accent "required"
// badge. There is no API to mutate type_fields, so no drag/toggles here.
export function TypesSettings({
  board,
  indexes,
}: {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
}) {
  const types = [...board.types].sort(
    (left, right) =>
      Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt)) ||
      left.position - right.position,
  );
  const archivedCount = types.filter((type) => type.archivedAt).length;
  const countLabel =
    `${types.length} ${types.length === 1 ? 'type' : 'types'}` +
    (archivedCount > 0 ? ` · ${archivedCount} archived` : '');

  return (
    <section className="flex min-h-0 flex-col">
      <div className="mb-1.5 flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-ink">Types</h1>
        <span className="font-mono text-meta text-ink-3">{countLabel}</span>
      </div>
      <p className="mb-4 mt-0 font-sans text-meta text-ink-3">
        Field order here is the form order — read-only for now, editable mapping coming with the
        API.
      </p>

      <div className="flex flex-col gap-4">
        {types.length === 0 ? (
          <p className="m-0 font-sans text-meta text-ink-3">No ticket types yet.</p>
        ) : (
          types.map((type) => {
            const rows = board.typeFields
              .filter((typeField) => typeField.ticketTypeId === type.id)
              .sort((left, right) => left.position - right.position);
            const requiredCount = rows.filter((typeField) => typeField.required).length;
            return (
              <section
                key={type.id}
                className={cn(
                  'max-w-[660px] rounded-panel border border-hairline bg-raised p-3.5',
                  type.archivedAt && 'opacity-60',
                )}
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  {type.config.color ? (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: type.config.color }}
                    />
                  ) : null}
                  <TypeBadge label={type.label} />
                  <span className="truncate font-sans text-ui font-semibold text-ink">
                    {type.label}
                  </span>
                  <span className="shrink-0 font-mono text-meta text-ink-3">{type.key}</span>
                  {type.archivedAt ? <ArchChip /> : null}
                  <span className="flex-1" />
                  <span className="shrink-0 font-mono text-meta text-ink-3">
                    fields: {rows.length}
                    {requiredCount > 0 ? ` · ${requiredCount} required` : ''}
                  </span>
                </div>

                {rows.length === 0 ? (
                  <p className="m-0 font-sans text-meta text-ink-3">No fields attached.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {rows.map((typeField, index) => {
                      const field = indexes.fieldById.get(typeField.fieldId);
                      return (
                        <div
                          key={typeField.fieldId}
                          className={cn(
                            'flex h-10 items-center gap-2.5 rounded-[9px] border border-hairline px-3',
                            field?.archivedAt && 'opacity-60',
                          )}
                        >
                          <span className="w-4 shrink-0 text-right font-mono text-meta text-ink-3">
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate font-sans text-ui font-medium text-ink">
                            {field?.label ?? `field #${typeField.fieldId}`}
                          </span>
                          <span className="shrink-0 rounded-ctrl bg-inset px-1.75 py-0.5 font-mono text-[11px] text-ink-2">
                            {field?.type ?? '?'}
                          </span>
                          {field?.archivedAt ? <ArchChip /> : null}
                          <span className="flex-1" />
                          {typeField.required ? (
                            <span className="inline-flex h-5 shrink-0 items-center rounded-ctrl bg-accent-subtle px-2 font-sans text-label font-medium text-accent">
                              required
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
