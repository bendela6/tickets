import { useState } from 'react';
import type { ItemType, LinkType } from '../../api/types';
import { useCreateLinkType, useSetTargetTypes, useUpdateLinkType } from '../../api/use-admin';
import { useCurrentUser } from '../../state/current-user-context';
import { Button, Checkbox, cn, Combobox, type ComboOption, FieldLabel, Input, Pill, SectionHeader } from '@tickets/ui';
import type { SettingsTabProps } from './types-tab';

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

function ArchChip() {
  return (
    <span className="inline-flex h-4.25 shrink-0 items-center rounded-sm bg-surface-inset px-1.5 font-mono text-[10px] font-medium text-gray-9">
      ARCH
    </span>
  );
}

// Same folded-direction chip text as detail-links: outgoing "label →",
// incoming "← inverseLabel", symmetric "label ↔".
function DirectionChip({ text }: { text: string }) {
  return <Pill tone="secondary" label={text} className="h-5 rounded-md text-label" />;
}

// Toggling a chip PUTs the *whole* new set to /api/link-types/:id/target-types
// (linkType.setTargetTypes is a full delete+reinsert replace, not a diff).
// The selections state below is seeded from `board.targetTypes` on mount, so
// a toggle sends the existing target set plus/minus the one clicked, instead
// of just the single chip — see `targetSelections` init in LinksTab, and the
// identical fix already applied for child-types in TypesTab.
function TargetTypeChips({
  candidates,
  selected,
  onToggle,
  disabled,
}: {
  candidates: ItemType[];
  selected: number[];
  onToggle: (targetTypeId: number) => void;
  disabled: boolean;
}) {
  if (candidates.length === 0) {
    return <p className="m-0 font-sans text-meta text-gray-9">No ticket types to target.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {candidates.map((candidate) => {
        const active = selected.includes(candidate.id);
        return (
          <Pill
            key={candidate.id}
            onClick={() => onToggle(candidate.id)}
            pressed={active}
            disabled={disabled}
            shape="full"
            label={candidate.label}
            tone={active ? 'primary' : 'secondary'}
            emphasis={active ? 'subtle' : 'outline'}
            className={cn(
              'h-6 border px-2.5 transition-colors',
              active ? 'border-indigo-9' : 'border-gray-7 bg-surface-raised hover:bg-surface-inset',
            )}
          />
        );
      })}
    </div>
  );
}

type CreateDraft = { itemTypeId: number | null; label: string; inverseLabel: string; directional: boolean };
type EditDraft = { label: string; inverseLabel: string; directional: boolean };

function CreateForm({
  types,
  draft,
  onChange,
  onCancel,
  onSubmit,
  pending,
}: {
  types: ItemType[];
  draft: CreateDraft;
  onChange: (draft: CreateDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const typeOptions: ComboOption[] = types.map((type) => ({ value: String(type.id), label: type.label }));
  const canSubmit = draft.itemTypeId !== null && draft.label.trim() !== '';
  return (
    <div className="max-w-130 rounded-xl border border-gray-6 bg-surface-raised p-3.5">
      <div className="flex flex-col gap-2.5">
        <div>
          <FieldLabel>Type</FieldLabel>
          <Combobox
            className="mt-1 w-48"
            placeholder="Type"
            options={typeOptions}
            value={draft.itemTypeId === null ? null : String(draft.itemTypeId)}
            onChange={(value) => onChange({ ...draft, itemTypeId: value === null ? null : Number(value) })}
          />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex-1">
            <FieldLabel htmlFor="new-link-outward">Outward label</FieldLabel>
            <Input
              id="new-link-outward"
              className="mt-1"
              placeholder="Blocks"
              value={draft.label}
              onChange={(event) => onChange({ ...draft, label: event.target.value })}
            />
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="new-link-inward">Inward label</FieldLabel>
            <Input
              id="new-link-inward"
              className="mt-1"
              placeholder="Is blocked by"
              value={draft.inverseLabel}
              onChange={(event) => onChange({ ...draft, inverseLabel: event.target.value })}
            />
          </div>
        </div>
        <Checkbox
          label="Directional"
          checked={draft.directional}
          onChange={(event) => onChange({ ...draft, directional: event.target.checked })}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="compact" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="compact" disabled={!canSubmit} loading={pending} onClick={onSubmit}>
          Create link type
        </Button>
      </div>
    </div>
  );
}

function EditForm({
  draft,
  onChange,
  onCancel,
  onSubmit,
  pending,
}: {
  draft: EditDraft;
  onChange: (draft: EditDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-2.5 max-w-130 rounded-xl border border-gray-6 bg-surface-raised p-3.5">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex-1">
            <FieldLabel htmlFor="edit-link-outward">Outward label</FieldLabel>
            <Input
              id="edit-link-outward"
              className="mt-1"
              value={draft.label}
              onChange={(event) => onChange({ ...draft, label: event.target.value })}
            />
          </div>
          <div className="flex-1">
            <FieldLabel htmlFor="edit-link-inward">Inward label</FieldLabel>
            <Input
              id="edit-link-inward"
              className="mt-1"
              value={draft.inverseLabel}
              onChange={(event) => onChange({ ...draft, inverseLabel: event.target.value })}
            />
          </div>
        </div>
        <Checkbox
          label="Directional"
          checked={draft.directional}
          onChange={(event) => onChange({ ...draft, directional: event.target.checked })}
        />
      </div>
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
          Save
        </Button>
      </div>
    </div>
  );
}

// Links tab per the task-13 prototype: a list of link types (each owned by
// one item type), create (owning type + outward/inward labels + direction →
// useCreateLinkType), edit label/inverseLabel/directional + archive
// (useUpdateLinkType), and a target-type chip editor (useSetTargetTypes).
// Layout follows the read-only reference at
// `git show dab1e97:.../link-types-settings.tsx`, rebuilt against the new
// model where a link type belongs to exactly one owning item type
// (`linkType.itemTypeId`) instead of being project-scoped, and extended with
// the target-type chip editor the old reference never had an API for.
//
// board.targetTypes (link_type_target_types rows) is a task-13 addition to
// the board payload — see apps/api/src/read/board.ts — added specifically so
// this chip editor can seed from the real current set. setTargetTypes is a
// full delete+reinsert replace on the server, so an editor that started
// empty would silently wipe a link type's existing targets on the first
// toggle; see ChildTypeChips in types-tab.tsx for the identical fix already
// shipped for allowed-child-types.
export function LinksTab({ board }: SettingsTabProps) {
  const { userId } = useCurrentUser();
  const disabled = userId === null;
  const createLinkType = useCreateLinkType();
  const updateLinkType = useUpdateLinkType();
  const setTargetTypes = useSetTargetTypes();

  const typeById = new Map(board.types.map((type) => [type.id, type]));
  const activeTypes = [...board.types]
    .filter((type) => !type.archivedAt)
    .sort((left, right) => left.position - right.position);

  const linkTypes = [...board.linkTypes].sort(
    (left, right) =>
      Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt)) || left.position - right.position,
  );
  const archivedCount = linkTypes.filter((linkType) => linkType.archivedAt).length;
  const countLabel =
    `${linkTypes.length} ${linkTypes.length === 1 ? 'link type' : 'link types'}` +
    (archivedCount > 0 ? ` · ${archivedCount} archived` : '');

  // linkTypeId -> locally-selected target type ids, seeded from the board's
  // current link_type_target_types rows so a toggle diffs against what's
  // actually in the DB instead of overwriting it.
  const [targetSelections, setTargetSelections] = useState<Record<number, number[]>>(() => {
    const byLinkType: Record<number, number[]> = {};
    for (const row of board.targetTypes) {
      (byLinkType[row.linkTypeId] ??= []).push(row.targetTypeId);
    }
    return byLinkType;
  });

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    itemTypeId: null,
    label: '',
    inverseLabel: '',
    directional: true,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ label: '', inverseLabel: '', directional: true });

  function startCreate() {
    if (disabled) return;
    setEditingId(null);
    setCreateDraft({ itemTypeId: null, label: '', inverseLabel: '', directional: true });
    setCreating(true);
  }

  async function submitCreate() {
    if (disabled || userId === null) return;
    const label = createDraft.label.trim();
    if (label === '' || createDraft.itemTypeId === null) return;
    // per the API doc, symmetric types use the same label both ways
    const inverseLabel = createDraft.inverseLabel.trim() || label;
    await createLinkType.mutateAsync({
      actorId: userId,
      itemTypeId: createDraft.itemTypeId,
      key: slugify(label),
      label,
      inverseLabel,
      directional: createDraft.directional,
    });
    setCreating(false);
    setCreateDraft({ itemTypeId: null, label: '', inverseLabel: '', directional: true });
  }

  function startEdit(linkType: LinkType) {
    if (disabled) return;
    setCreating(false);
    setEditDraft({
      label: linkType.label,
      inverseLabel: linkType.inverseLabel,
      directional: linkType.directional,
    });
    setEditingId(linkType.id);
  }

  async function submitEdit(id: number) {
    if (disabled || userId === null) return;
    const label = editDraft.label.trim();
    if (label === '') return;
    const inverseLabel = editDraft.inverseLabel.trim() || label;
    await updateLinkType.mutateAsync({
      actorId: userId,
      id,
      label,
      inverseLabel,
      directional: editDraft.directional,
    });
    setEditingId(null);
  }

  async function toggleArchive(linkType: LinkType) {
    if (disabled || userId === null) return;
    await updateLinkType.mutateAsync({ actorId: userId, id: linkType.id, archived: !linkType.archivedAt });
  }

  async function toggleTarget(linkTypeId: number, targetTypeId: number) {
    if (disabled || userId === null) return;
    const current = targetSelections[linkTypeId] ?? [];
    const next = current.includes(targetTypeId)
      ? current.filter((id) => id !== targetTypeId)
      : [...current, targetTypeId];
    setTargetSelections((prev) => ({ ...prev, [linkTypeId]: next }));
    await setTargetTypes.mutateAsync({ actorId: userId, linkTypeId, targetTypeIds: next });
  }

  return (
    <section className="flex min-h-0 flex-col px-6 py-5.5">
      <div className="mb-1.5 flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-gray-12">Links</h1>
        <span className="font-mono text-meta text-gray-9">{countLabel}</span>
      </div>
      <p className="mb-4 mt-0 font-sans text-meta text-gray-9">
        Create link types owned by a ticket type, and choose which types they may target.
      </p>

      <div className="mb-4">
        {creating ? (
          <CreateForm
            types={activeTypes}
            draft={createDraft}
            onChange={setCreateDraft}
            onCancel={() => setCreating(false)}
            onSubmit={() => void submitCreate()}
            pending={createLinkType.isPending}
          />
        ) : (
          <Button
            variant="secondary"
            size="compact"
            disabled={disabled || activeTypes.length === 0}
            onClick={startCreate}
          >
            + New link type
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {linkTypes.length === 0 ? (
          <p className="m-0 font-sans text-meta text-gray-9">No link types yet.</p>
        ) : (
          linkTypes.map((linkType) => {
            const owningType = typeById.get(linkType.itemTypeId);
            const selected = targetSelections[linkType.id] ?? [];
            return (
              <section
                key={linkType.id}
                className={cn(
                  'max-w-165 rounded-xl border border-gray-6 bg-surface-raised p-3.5',
                  linkType.archivedAt && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="truncate font-sans text-ui font-semibold text-gray-12">{linkType.label}</span>
                  <span className="font-mono text-meta text-gray-9">{linkType.key}</span>
                  <DirectionChip
                    text={linkType.directional ? `→ ${linkType.label}` : `${linkType.label} ↔`}
                  />
                  <DirectionChip
                    text={
                      linkType.directional ? linkType.inverseLabel : linkType.label
                    }
                  />
                  {owningType ? (
                    <span className="font-mono text-label text-gray-9">on {owningType.label}</span>
                  ) : null}
                  {linkType.archivedAt ? <ArchChip /> : null}
                  <span className="flex-1" />
                  <Button
                    variant="ghost"
                    size="compact"
                    disabled={disabled || Boolean(linkType.archivedAt)}
                    aria-label={`Edit ${linkType.label}`}
                    onClick={() => startEdit(linkType)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="compact"
                    disabled={disabled}
                    aria-label={`${linkType.archivedAt ? 'Unarchive' : 'Archive'} ${linkType.label}`}
                    onClick={() => void toggleArchive(linkType)}
                  >
                    {linkType.archivedAt ? 'Unarchive' : 'Archive'}
                  </Button>
                </div>

                {editingId === linkType.id ? (
                  <EditForm
                    draft={editDraft}
                    onChange={setEditDraft}
                    onCancel={() => setEditingId(null)}
                    onSubmit={() => void submitEdit(linkType.id)}
                    pending={updateLinkType.isPending}
                  />
                ) : null}

                {!linkType.archivedAt ? (
                  <div className="mt-2.5">
                    <SectionHeader title="Target types" className="mb-1.5" />
                    <TargetTypeChips
                      candidates={activeTypes}
                      selected={selected}
                      disabled={disabled}
                      onToggle={(targetTypeId) => void toggleTarget(linkType.id, targetTypeId)}
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
