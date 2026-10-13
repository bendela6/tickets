import { toasted } from '../../api/mutation-meta';
import { useState } from 'react';
import type { Board, ItemType } from '../../api/types';
import { useCreateType, useSetChildTypes, useUpdateType } from '../../api/use-admin';
import { DEFAULT_OPTION_COLOR } from '../../registry/option-color';
import { useCurrentUser } from '../../state/current-user-context';
import { ArchChip } from '../arch-chip';
import { slugify } from '../../utils/slugify';
import { Button, cn, ColorPicker, Dot, FieldLabel, HUES, Input, Pill, SectionHeader } from '@bh/ui';
import type { BoardIndexes } from '../../utils/index-board';

export type SettingsTabProps = {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
};

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
  return (
    <div className="flex flex-wrap items-center gap-6">
      {candidates.map((candidate) => {
        const active = selected.includes(candidate.id);
        return (
          <Pill
            key={candidate.id}
            onClick={() => onToggle(candidate.id)}
            pressed={active}
            disabled={disabled}
            shape="round"
            label={candidate.label}
            tone={active ? 'primary' : 'secondary'}
            variant={active ? 'subtle' : 'outline'}
            className={cn(
              'h-24 border-1 px-10 transition-colors',
              active ? 'border-indigo-9' : 'border-gray-7 bg-surface-raised hover:bg-surface-inset',
            )}
          />
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
  const colorId = `${idPrefix}-color`;
  return (
    <div className="max-w-420 rounded-12 border-1 border-gray-6 bg-surface-raised p-14">
      <FieldLabel htmlFor={nameId}>Name</FieldLabel>
      <Input
        id={nameId}
        className="mt-4"
        placeholder="Bug"
        value={draft.label}
        onChange={(next) => onChange({ ...draft, label: next })}
      />
      <FieldLabel htmlFor={colorId} className="mt-10">
        Colour
      </FieldLabel>
      <ColorPicker
        id={colorId}
        className="mt-4"
        value={draft.color}
        onChange={(next) => onChange({ ...draft, color: HUES.find((hue) => hue === next) ?? draft.color })}
      />
      <div className="mt-12 flex justify-end gap-8">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="solid"
          size="sm"
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
  const [createDraft, setCreateDraft] = useState<Draft>({ label: '', color: DEFAULT_OPTION_COLOR });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ label: '', color: DEFAULT_OPTION_COLOR });

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
    setCreateDraft({ label: '', color: DEFAULT_OPTION_COLOR });
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
    setCreateDraft({ label: '', color: DEFAULT_OPTION_COLOR });
  }

  function startEdit(type: ItemType) {
    if (disabled) return;
    setCreating(false);
    setEditDraft({ label: type.label, color: type.config.color ?? DEFAULT_OPTION_COLOR });
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
    <section className="flex min-h-0 flex-col">
      <div className="mb-6 flex items-center gap-12">
        <h2 className="m-0 font-sans text-20 font-600 text-gray-12">Types</h2>
        <span className="font-mono text-12/17 text-gray-9">{countLabel}</span>
      </div>
      <p className="mb-16 mt-0 font-sans text-12/17 text-gray-9">
        Create, rename, and archive ticket types, and choose which types may nest under each one.
      </p>

      <div className="mb-16">
        {creating ? (
          <TypeForm
            idPrefix="new-type"
            draft={createDraft}
            onChange={setCreateDraft}
            onCancel={() => setCreating(false)}
            onSubmit={() => void submitCreate().catch(toasted)}
            submitLabel="Create type"
            pending={createType.isPending}
          />
        ) : (
          <Button variant="outline" size="sm" disabled={disabled} onClick={startCreate}>
            + New type
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-16">
        {types.length === 0 ? (
          <p className="m-0 font-sans text-12/17 text-gray-9">No ticket types yet.</p>
        ) : (
          types.map((type) => {
            // Every live type may be a child, the type itself included: a
            // subticket may hold subtickets.
            const candidates = types.filter((other) => !other.archivedAt);
            const selected = childSelections[type.id] ?? [];
            return (
              <section
                key={type.id}
                className={cn(
                  'max-w-660 rounded-12 border-1 border-gray-6 bg-surface-raised p-14',
                  type.archivedAt && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-10">
                  {type.config.color ? <Dot color={`var(--color-${type.config.color}-9)`} /> : null}
                  <span className="truncate font-sans text-13/19 font-600 text-gray-12">{type.label}</span>
                  <span className="shrink-0 font-mono text-12/17 text-gray-9">{type.key}</span>
                  {type.archivedAt ? <ArchChip /> : null}
                  <span className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled || Boolean(type.archivedAt)}
                    aria-label={`Edit ${type.label}`}
                    onClick={() => startEdit(type)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label={`${type.archivedAt ? 'Unarchive' : 'Archive'} ${type.label}`}
                    onClick={() => void toggleArchive(type).catch(toasted)}
                  >
                    {type.archivedAt ? 'Unarchive' : 'Archive'}
                  </Button>
                </div>

                {editingId === type.id ? (
                  <div className="mt-10">
                    <TypeForm
                      idPrefix={`edit-type-${type.id}`}
                      draft={editDraft}
                      onChange={setEditDraft}
                      onCancel={() => setEditingId(null)}
                      onSubmit={() => void submitEdit(type.id).catch(toasted)}
                      submitLabel="Save"
                      pending={updateType.isPending}
                    />
                  </div>
                ) : null}

                {!type.archivedAt ? (
                  <div className="mt-10">
                    <SectionHeader title="Allowed children" className="mb-6" />
                    <ChildTypeChips
                      candidates={candidates}
                      selected={selected}
                      disabled={disabled}
                      onToggle={(childTypeId) => void toggleChild(type.id, childTypeId).catch(toasted)}
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
