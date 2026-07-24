import { useState, type FormEvent } from 'react';
import type { Field, FieldType, ItemTypeField } from '../../api/types';
import {
  useCreateField,
  usePlaceField,
  useUnplaceField,
  useUpdateField,
  useUpdatePlacement,
} from '../../api/use-admin';
import { typePill } from '../../domain/status';
import { hexToOptionColor } from '../../registry/option-color';
import { useCurrentUser } from '../../state/current-user-context';
import { Button } from '../../ui/button';
import { cn } from '@tickets/ui/cn';
import { Pill } from '@tickets/ui/pill';
import { Tabs } from '@tickets/ui/tabs';
import { Combobox } from '../../ui/combobox';
import type { ComboOption } from '../../ui/combobox-list';
import { FieldLabel } from '../../ui/field-label';
import { Input } from '../../ui/input';
import { MultiCombobox } from '../../ui/multi-combobox';
import { Switch } from '../../ui/switch';
import type { BoardIndexes } from '../../utils/index-board';
import type { SettingsTabProps } from './types-tab';

const FIELD_TYPES: FieldType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'option',
  'user',
  'json',
];

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function ArchChip() {
  return (
    <span className="inline-flex h-4.25 shrink-0 items-center rounded-sm bg-inset px-1.5 font-mono text-[10px] font-medium text-ink-3">
      ARCH
    </span>
  );
}

// Field | Type | Required | Allowed options | Order | unplace-icon.
const GRID_COLUMNS = 'grid-cols-[minmax(140px,1.5fr)_88px_84px_minmax(170px,1fr)_60px_32px]';

/** One placement row: required toggle, option allowlist (option fields only), reorder, unplace. */
function PlacementRow({
  field,
  placement,
  placements,
  index,
  indexes,
  typeId,
  disabled,
}: {
  field: Field;
  placement: ItemTypeField;
  placements: ItemTypeField[];
  index: number;
  indexes: BoardIndexes;
  typeId: number;
  disabled: boolean;
}) {
  const { userId } = useCurrentUser();
  const updatePlacement = useUpdatePlacement();
  const unplaceField = useUnplaceField();

  const fullOptions = field.optionSetId !== null ? (indexes.optionsBySetId.get(field.optionSetId) ?? []) : [];
  const allowedIds = placement.configOverride?.allowedOptionIds ?? fullOptions.map((option) => option.id);
  const comboOptions: ComboOption[] = fullOptions.map((option) => ({
    value: String(option.id),
    label: option.label,
    color: hexToOptionColor(option.config.color),
  }));

  function move(direction: -1 | 1) {
    if (disabled || userId === null) return;
    const neighbor = placements[index + direction];
    if (!neighbor) return;
    updatePlacement.mutate({ actorId: userId, itemTypeId: typeId, fieldId: field.id, position: neighbor.position });
    updatePlacement.mutate({
      actorId: userId,
      itemTypeId: typeId,
      fieldId: neighbor.fieldId,
      position: placement.position,
    });
  }

  return (
    <div className={cn('grid items-center gap-2 border-b border-hairline px-2.5 py-2', GRID_COLUMNS)}>
      <span className="truncate font-sans text-ui font-medium text-ink">{field.label}</span>
      <Pill {...typePill} label={field.type} className={cn(typePill.className, 'font-mono text-[11px]')} />
      <Switch
        label="Required"
        checked={placement.required}
        disabled={disabled || updatePlacement.isPending}
        onChange={(event) => {
          if (userId === null) return;
          updatePlacement.mutate({
            actorId: userId,
            itemTypeId: typeId,
            fieldId: field.id,
            required: event.target.checked,
          });
        }}
      />
      {field.type === 'option' ? (
        <MultiCombobox
          options={comboOptions}
          value={allowedIds.map(String)}
          onChange={(next) => {
            if (userId === null) return;
            updatePlacement.mutate({
              actorId: userId,
              itemTypeId: typeId,
              fieldId: field.id,
              allowedOptionIds: next.map(Number),
            });
          }}
          placeholder="All options allowed"
          size="compact"
          disabled={disabled}
        />
      ) : (
        <span className="font-mono text-meta text-ink-3">—</span>
      )}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={`Move ${field.label} up`}
          disabled={disabled || index === 0}
          onClick={() => move(-1)}
          className="flex size-5.5 cursor-pointer items-center justify-center rounded-ctrl font-sans text-[11px] text-ink-3 hover:bg-inset hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Move ${field.label} down`}
          disabled={disabled || index === placements.length - 1}
          onClick={() => move(1)}
          className="flex size-5.5 cursor-pointer items-center justify-center rounded-ctrl font-sans text-[11px] text-ink-3 hover:bg-inset hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↓
        </button>
      </div>
      <button
        type="button"
        title="Unplace field"
        aria-label={`Unplace ${field.label}`}
        disabled={disabled}
        onClick={() => {
          if (userId === null) return;
          unplaceField.mutate({ actorId: userId, itemTypeId: typeId, fieldId: field.id });
        }}
        className="flex size-5.5 cursor-pointer items-center justify-center rounded-ctrl font-sans text-ui text-ink-3 hover:bg-inset hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⌫
      </button>
    </div>
  );
}

/** "＋ New field" composer: label, key (auto-slugged, editable), type — creates AND places on `typeId`. */
function NewFieldComposer({
  typeId,
  disabled,
  onClose,
}: {
  typeId: number;
  disabled: boolean;
  onClose: () => void;
}) {
  const { userId } = useCurrentUser();
  const createField = useCreateField();
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<FieldType>('string');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || userId === null || createField.isPending) return;
    const trimmedLabel = label.trim();
    const trimmedKey = key.trim();
    if (trimmedLabel.length === 0 || trimmedKey.length === 0) return;
    createField.mutate(
      { actorId: userId, itemTypeId: typeId, key: trimmedKey, label: trimmedLabel, type },
      { onSuccess: onClose },
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-panel border border-hairline bg-raised p-3.5">
      <div className="mb-3 font-sans text-ui font-semibold text-ink">New field</div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
        <div className="flex flex-col gap-1.25">
          <FieldLabel htmlFor="new-field-label">Label</FieldLabel>
          <Input
            id="new-field-label"
            autoFocus
            value={label}
            placeholder="e.g. Severity"
            onChange={(event) => {
              setLabel(event.target.value);
              if (!keyTouched) {
                setKey(slugifyKey(event.target.value));
              }
            }}
          />
        </div>
        <div className="flex flex-col gap-1.25">
          <FieldLabel htmlFor="new-field-key">Key</FieldLabel>
          <Input
            id="new-field-key"
            value={key}
            placeholder="severity"
            onChange={(event) => {
              setKeyTouched(true);
              setKey(event.target.value);
            }}
            className="font-mono text-[13px]"
          />
        </div>
        <div className="flex flex-col gap-1.25">
          <FieldLabel id="new-field-type">Type</FieldLabel>
          <Combobox
            options={FIELD_TYPES.map((candidate) => ({ value: candidate, label: candidate }))}
            value={type}
            onChange={(next) => setType((next as FieldType | null) ?? 'string')}
          />
        </div>
      </div>
      {createField.isError ? (
        <p className="m-0 mt-2.5 font-sans text-meta text-danger">{(createField.error as Error).message}</p>
      ) : null}
      <div className="mt-3.5 flex items-center justify-end gap-2">
        <Button size="compact" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="compact"
          variant="primary"
          loading={createField.isPending}
          disabled={disabled || label.trim().length === 0 || key.trim().length === 0}
        >
          Create field
        </Button>
      </div>
    </form>
  );
}

// Fields tab per the task-11 brief: pick a type, edit its field placements
// (required toggle, option allowlist, reorder, unplace), place an existing
// library field, create a new one, and archive a library field scheme-wide.
// Layout follows the read-only reference at
// `git show dab1e97:.../fields-settings.tsx`, rebuilt against the new
// library+placement model (`board.fields` / `board.placements`).
export function FieldsTab({ board, indexes }: SettingsTabProps) {
  const { userId } = useCurrentUser();
  const disabled = userId === null;
  const placeField = usePlaceField();
  const updateField = useUpdateField();

  const activeTypes = [...board.types]
    .filter((type) => !type.archivedAt)
    .sort((left, right) => left.position - right.position);

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pickFieldId, setPickFieldId] = useState<string | null>(null);

  const activeTypeId = selectedTypeId ?? activeTypes[0]?.id ?? null;
  const placements = activeTypeId !== null ? (indexes.placementsByType.get(activeTypeId) ?? []) : [];
  const placedFieldIds = new Set(placements.map((placement) => placement.fieldId));

  const pickableFields = board.fields.filter((field) => !field.archivedAt && !placedFieldIds.has(field.id));
  const pickOptions: ComboOption[] = pickableFields.map((field) => ({
    value: String(field.id),
    label: `${field.label} · ${field.type}`,
  }));

  function submitPlace() {
    if (disabled || userId === null || activeTypeId === null || pickFieldId === null) return;
    placeField.mutate(
      { actorId: userId, itemTypeId: activeTypeId, fieldId: Number(pickFieldId) },
      { onSuccess: () => setPickFieldId(null) },
    );
  }

  const sortedFields = [...board.fields].sort((left, right) => left.label.localeCompare(right.label));

  return (
    <section className="flex min-h-0 flex-col px-6 py-5.5">
      <div className="mb-1.5 flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-ink">Fields</h1>
        <span className="font-mono text-meta text-ink-3">
          {board.fields.length} field{board.fields.length === 1 ? '' : 's'} in this scheme
        </span>
      </div>
      <p className="mb-4 mt-0 font-sans text-meta text-ink-3">
        Choose a type, then place library fields onto it, reorder them, and set which are required.
      </p>

      {activeTypes.length === 0 ? (
        <p className="m-0 font-sans text-meta text-ink-3">No ticket types yet — create one on the Types tab first.</p>
      ) : (
        <>
          <Tabs
            variant="pill"
            className="mb-4 flex-wrap"
            items={activeTypes.map((type) => ({ value: String(type.id), label: type.label }))}
            value={String(activeTypeId)}
            onChange={(next) => setSelectedTypeId(Number(next))}
            label="Type"
          />

          {activeTypeId !== null ? (
            <>
              <div
                role="region"
                aria-label="Placements"
                className="mb-4 overflow-hidden rounded-panel border border-hairline bg-raised"
              >
                <div
                  className={cn(
                    'grid h-8.5 items-center border-b border-hairline bg-app px-2.5 font-sans text-[11px] font-medium uppercase tracking-wider text-ink-2',
                    GRID_COLUMNS,
                  )}
                >
                  <span>Field</span>
                  <span>Type</span>
                  <span>Required</span>
                  <span>Allowed options</span>
                  <span>Order</span>
                  <span />
                </div>
                {placements.map((placement, index) => {
                  const field = indexes.fieldById.get(placement.fieldId);
                  if (!field) return null;
                  return (
                    <PlacementRow
                      key={placement.fieldId}
                      field={field}
                      placement={placement}
                      placements={placements}
                      index={index}
                      indexes={indexes}
                      typeId={activeTypeId}
                      disabled={disabled}
                    />
                  );
                })}
                {placements.length === 0 ? (
                  <p className="m-0 px-3 py-5 text-center font-sans text-meta text-ink-3">
                    No fields placed on this type yet.
                  </p>
                ) : null}
              </div>

              <div className="mb-5 flex items-center gap-2">
                <Combobox
                  options={pickOptions}
                  value={pickFieldId}
                  onChange={setPickFieldId}
                  placeholder="Choose a field to place…"
                  size="compact"
                  disabled={disabled || pickOptions.length === 0}
                  className="w-72"
                />
                <Button
                  size="compact"
                  variant="primary"
                  disabled={disabled || pickFieldId === null || placeField.isPending}
                  loading={placeField.isPending}
                  onClick={submitPlace}
                >
                  Place field
                </Button>
                <span className="flex-1" />
                <Button
                  size="compact"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => setComposerOpen((open) => !open)}
                >
                  + New field
                </Button>
              </div>

              {composerOpen ? (
                <NewFieldComposer typeId={activeTypeId} disabled={disabled} onClose={() => setComposerOpen(false)} />
              ) : null}
            </>
          ) : null}
        </>
      )}

      <div className="mt-2">
        <h2 className="mb-2 font-sans text-ui font-semibold text-ink">Field library</h2>
        <div
          role="region"
          aria-label="Field library"
          className="overflow-hidden rounded-panel border border-hairline bg-raised"
        >
          {sortedFields.map((field) => {
            const placedCount = board.placements.filter((placement) => placement.fieldId === field.id).length;
            return (
              <div
                key={field.id}
                className={cn(
                  'flex items-center gap-2.5 border-b border-hairline px-2.5 py-2',
                  field.archivedAt && 'opacity-60',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-sans text-ui text-ink">{field.label}</span>
                {field.archivedAt ? <ArchChip /> : null}
                <Pill {...typePill} label={field.type} className={cn(typePill.className, 'font-mono text-[11px]')} />
                <span className="w-16 shrink-0 font-mono text-meta text-ink-3">
                  {placedCount} type{placedCount === 1 ? '' : 's'}
                </span>
                <Button
                  size="compact"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`${field.archivedAt ? 'Restore' : 'Archive'} ${field.label}`}
                  onClick={() => {
                    if (userId === null) return;
                    updateField.mutate({ actorId: userId, id: field.id, archived: !field.archivedAt });
                  }}
                >
                  {field.archivedAt ? 'Restore' : 'Archive'}
                </Button>
              </div>
            );
          })}
          {sortedFields.length === 0 ? (
            <p className="m-0 px-3 py-5 text-center font-sans text-meta text-ink-3">No fields yet.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
