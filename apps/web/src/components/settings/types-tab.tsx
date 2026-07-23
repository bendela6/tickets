import { useState } from 'react';
import type { Board, ItemType } from '../../api/types';
import { useCreateType, useSetChildTypes, useUpdateType } from '../../api/use-admin';
import { useCurrentUser } from '../../state/current-user-context';
import { Button } from '../../ui/button';
import { cn } from '@tickets/ui/cn';
import { FieldLabel } from '../../ui/field-label';
import { Input } from '../../ui/input';
import type { BoardIndexes } from '../../utils/index-board';

export type SettingsTabProps = {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
};

const SWATCHES = [
  '#4E46C6',
  '#2E7D4F',
  '#C25425',
  '#A03028',
  '#2E6FCC',
  '#79756A',
];

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function ArchChip() {
  return (
    <span className="inline-flex h-4.25 shrink-0 items-center rounded-sm bg-inset px-1.5 font-mono text-[10px] font-medium text-ink-3">
      ARCH
    </span>
  );
}

function ColorSwatches({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {SWATCHES.map((hex) => (
        <button
          key={hex}
          type="button"
          disabled={disabled}
          aria-label={`Color ${hex}`}
          aria-pressed={value === hex}
          onClick={() => onChange(hex)}
          className={cn(
            'size-5 shrink-0 rounded-full border-2 transition-shadow',
            value === hex ? 'border-ink' : 'border-transparent hover:border-ink-3',
          )}
          style={{ backgroundColor: hex }}
        />
      ))}
    </div>
  );
}

// Toggling a chip PUTs the *whole* new set to /api/types/:id/child-types
// (type.setChildTypes is a full delete+reinsert replace, not a diff). The
// selections state below is seeded from `board.childTypes` on mount, so a
// toggle sends the existing allowed set plus/minus the one clicked, instead
// of just the single chip — see `childSelections` init in TypesTab.
function ChildTypeChips({
  candidates,
  selected,
  onToggle,
  disabled,
}: {
  candidates: ItemType[];
  selected: number[];
  onToggle: (childTypeId: number) => void;
  disabled: boolean;
}) {
  if (candidates.length === 0) {
    return <p className="m-0 font-sans text-meta text-ink-3">No other types to allow as children.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {candidates.map((candidate) => {
        const active = selected.includes(candidate.id);
        return (
          <button
            key={candidate.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onToggle(candidate.id)}
            className={cn(
              'inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 font-sans text-meta font-medium transition-colors',
              active
                ? 'border-accent bg-accent-subtle text-accent'
                : 'border-control bg-raised text-ink-2 hover:bg-inset',
            )}
          >
            {candidate.label}
          </button>
        );
      })}
    </div>
  );
}

type Draft = { label: string; color: string };

function TypeForm({
  idPrefix,
  draft,
  onChange,
  onCancel,
  onSubmit,
  submitLabel,
  pending,
}: {
  idPrefix: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
}) {
  const nameId = `${idPrefix}-name`;
  return (
    <div className="max-w-105 rounded-panel border border-hairline bg-raised p-3.5">
      <FieldLabel htmlFor={nameId}>Name</FieldLabel>
      <Input
        id={nameId}
        className="mt-1"
        placeholder="Bug"
        value={draft.label}
        onChange={(event) => onChange({ ...draft, label: event.target.value })}
      />
      <ColorSwatches value={draft.color} onChange={(color) => onChange({ ...draft, color })} />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="compact" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="compact"
          disabled={draft.label.trim() === ''}
          loading={pending}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

// Types tab per the task-10 prototype: a list of types (colour dot + label +
// key), create (name/colour), edit label/colour + archive/unarchive, and an
// allowed-child-types chip editor. Layout follows the read-only reference at
// `git show dab1e97:.../types-settings.tsx`, extended with the mutation forms
// that reference lacked (there was no create/edit/child-type API when it was
// written).
export function TypesTab({ board }: SettingsTabProps) {
  const { userId } = useCurrentUser();
  const createType = useCreateType();
  const updateType = useUpdateType();
  const setChildTypes = useSetChildTypes();

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<Draft>({ label: '', color: SWATCHES[0]! });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ label: '', color: SWATCHES[0]! });

  // typeId -> locally-selected child type ids, seeded from the board's
  // current item_type_child_types rows so a toggle diffs against what's
  // actually in the DB instead of overwriting it.
  const [childSelections, setChildSelections] = useState<Record<number, number[]>>(() => {
    const byParent: Record<number, number[]> = {};
    for (const row of board.childTypes) {
      (byParent[row.parentTypeId] ??= []).push(row.childTypeId);
    }
    return byParent;
  });

  const disabled = userId === null;

  const types = [...board.types].sort(
    (left, right) =>
      Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt)) || left.position - right.position,
  );
  const archivedCount = types.filter((type) => type.archivedAt).length;
  const countLabel =
    `${types.length} ${types.length === 1 ? 'type' : 'types'}` +
    (archivedCount > 0 ? ` · ${archivedCount} archived` : '');

  function startCreate() {
    if (disabled) return;
    setEditingId(null);
    setCreateDraft({ label: '', color: SWATCHES[0]! });
    setCreating(true);
  }

  async function submitCreate() {
    if (disabled) return;
    const label = createDraft.label.trim();
    if (label === '') return;
    await createType.mutateAsync({
      actorId: userId,
      schemeId: board.project.schemeId,
      key: slugify(label),
      label,
      config: { color: createDraft.color },
    });
    setCreating(false);
    setCreateDraft({ label: '', color: SWATCHES[0]! });
  }

  function startEdit(type: ItemType) {
    if (disabled) return;
    setCreating(false);
    setEditDraft({ label: type.label, color: type.config.color ?? SWATCHES[0]! });
    setEditingId(type.id);
  }

  async function submitEdit(id: number) {
    if (disabled) return;
    const label = editDraft.label.trim();
    if (label === '') return;
    await updateType.mutateAsync({
      actorId: userId,
      id,
      label,
      config: { color: editDraft.color },
    });
    setEditingId(null);
  }

  async function toggleArchive(type: ItemType) {
    if (disabled) return;
    await updateType.mutateAsync({ actorId: userId, id: type.id, archived: !type.archivedAt });
  }

  async function toggleChild(parentId: number, childTypeId: number) {
    if (disabled) return;
    const current = childSelections[parentId] ?? [];
    const next = current.includes(childTypeId)
      ? current.filter((id) => id !== childTypeId)
      : [...current, childTypeId];
    setChildSelections((prev) => ({ ...prev, [parentId]: next }));
    await setChildTypes.mutateAsync({ actorId: userId, typeId: parentId, childTypeIds: next });
  }

  return (
    <section className="flex min-h-0 flex-col px-6 py-5.5">
      <div className="mb-1.5 flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-ink">Types</h1>
        <span className="font-mono text-meta text-ink-3">{countLabel}</span>
      </div>
      <p className="mb-4 mt-0 font-sans text-meta text-ink-3">
        Create, rename, and archive ticket types, and choose which types may nest under each one.
      </p>

      <div className="mb-4">
        {creating ? (
          <TypeForm
            idPrefix="new-type"
            draft={createDraft}
            onChange={setCreateDraft}
            onCancel={() => setCreating(false)}
            onSubmit={() => void submitCreate()}
            submitLabel="Create type"
            pending={createType.isPending}
          />
        ) : (
          <Button variant="secondary" size="compact" disabled={disabled} onClick={startCreate}>
            + New type
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {types.length === 0 ? (
          <p className="m-0 font-sans text-meta text-ink-3">No ticket types yet.</p>
        ) : (
          types.map((type) => {
            const candidates = types.filter((other) => other.id !== type.id && !other.archivedAt);
            const selected = childSelections[type.id] ?? [];
            return (
              <section
                key={type.id}
                className={cn(
                  'max-w-165 rounded-panel border border-hairline bg-raised p-3.5',
                  type.archivedAt && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-2.5">
                  {type.config.color ? (
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: type.config.color }}
                    />
                  ) : null}
                  <span className="truncate font-sans text-ui font-semibold text-ink">{type.label}</span>
                  <span className="shrink-0 font-mono text-meta text-ink-3">{type.key}</span>
                  {type.archivedAt ? <ArchChip /> : null}
                  <span className="flex-1" />
                  <Button
                    variant="ghost"
                    size="compact"
                    disabled={disabled || Boolean(type.archivedAt)}
                    aria-label={`Edit ${type.label}`}
                    onClick={() => startEdit(type)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="compact"
                    disabled={disabled}
                    aria-label={`${type.archivedAt ? 'Unarchive' : 'Archive'} ${type.label}`}
                    onClick={() => void toggleArchive(type)}
                  >
                    {type.archivedAt ? 'Unarchive' : 'Archive'}
                  </Button>
                </div>

                {editingId === type.id ? (
                  <div className="mt-2.5">
                    <TypeForm
                      idPrefix={`edit-type-${type.id}`}
                      draft={editDraft}
                      onChange={setEditDraft}
                      onCancel={() => setEditingId(null)}
                      onSubmit={() => void submitEdit(type.id)}
                      submitLabel="Save"
                      pending={updateType.isPending}
                    />
                  </div>
                ) : null}

                {!type.archivedAt ? (
                  <div className="mt-2.5">
                    <span className="mb-1.5 block font-sans text-label font-medium uppercase text-ink-3">
                      Allowed children
                    </span>
                    <ChildTypeChips
                      candidates={candidates}
                      selected={selected}
                      disabled={disabled}
                      onToggle={(childTypeId) => void toggleChild(type.id, childTypeId)}
                    />
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
