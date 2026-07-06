import { useMemo, useState, type FormEvent } from 'react';
import type { Board, Field, FieldOption } from '../../api/types';
import {
  CREATABLE_FIELD_TYPES,
  useCreateField,
  useCreateFieldOption,
  usePatchField,
  usePatchFieldOption,
  type CreatableFieldType,
} from '../../api/use-vocab-fields';
import { hexToOptionColor } from '../../registry/option-color';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';
import { Combobox } from '../../ui/combobox';
import { FieldLabel } from '../../ui/field-label';
import { Input } from '../../ui/input';
import { OptionChip, type OptionColor } from '../../ui/option-chip';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Switch } from '../../ui/switch';
import { TypeBadge } from '../../ui/type-badge';
import type { BoardIndexes } from '../../utils/index-board';

// The 11-color option palette. Hexes are the LIGHT-theme design-system values
// from src/styles/instrument.css (--ins-opt-*): the API stores a raw hex and
// every consumer maps it back onto the palette via hexToOptionColor, so we
// persist the canonical hex for each named color.
const PALETTE: { color: OptionColor; hex: string }[] = [
  { color: 'red', hex: '#a03028' },
  { color: 'orange', hex: '#a44e14' },
  { color: 'yellow', hex: '#8a6a10' },
  { color: 'green', hex: '#2e7042' },
  { color: 'teal', hex: '#176d5c' },
  { color: 'cyan', hex: '#14687e' },
  { color: 'blue', hex: '#2a5dae' },
  { color: 'indigo', hex: '#4a44b0' },
  { color: 'purple', hex: '#7b3fa0' },
  { color: 'pink', hex: '#a63368' },
  { color: 'gray', hex: '#5c594f' },
];

// Solid swatch dot per palette color (theme-aware tokens, not the stored hex).
const dotClasses: Record<OptionColor, string> = {
  red: 'bg-opt-red',
  orange: 'bg-opt-orange',
  yellow: 'bg-opt-yellow',
  green: 'bg-opt-green',
  teal: 'bg-opt-teal',
  cyan: 'bg-opt-cyan',
  blue: 'bg-opt-blue',
  indigo: 'bg-opt-indigo',
  purple: 'bg-opt-purple',
  pink: 'bg-opt-pink',
  gray: 'bg-opt-gray',
};

// Label gets a real minimum so it never collapses to an ellipsis on narrow
// content areas; headers stay one line via whitespace-nowrap at the call site.
const GRID_COLUMNS = 'grid-cols-[minmax(150px,1.5fr)_minmax(90px,120px)_90px_minmax(90px,1fr)_110px_24px]';

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function ArchChip() {
  return (
    <span className="inline-flex h-4.25 flex-none items-center rounded-[4px] bg-inset px-1.5 font-mono text-[10px] font-medium text-ink-3">
      ARCH
    </span>
  );
}

/** 11-swatch palette picker in a popover, anchored on the option's color dot. */
function ColorSwatchPicker({
  current,
  onPick,
  disabled,
}: {
  current: OptionColor;
  onPick: (hex: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Option color"
          disabled={disabled}
          className={cn(
            'size-4 flex-none cursor-pointer rounded-full border-2 border-raised shadow-[0_0_0_1px_var(--ins-hairline)]',
            dotClasses[current],
          )}
        />
      </PopoverTrigger>
      <PopoverContent className="p-2.5">
        <div className="mb-2 font-mono text-[10px] font-medium tracking-[0.08em] text-ink-3">
          OPTION COLOR
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {PALETTE.map(({ color, hex }) => (
            <button
              key={color}
              type="button"
              aria-label={`Set color ${color}`}
              onClick={() => {
                onPick(hex);
                setOpen(false);
              }}
              className={cn(
                'size-5.5 cursor-pointer rounded-full',
                dotClasses[color],
                color === current && 'ring-2 ring-accent ring-offset-2 ring-offset-raised',
              )}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** One editable option row: color swatch → palette, rename on blur, archive. */
function OptionRow({ option }: { option: FieldOption }) {
  const patchOption = usePatchFieldOption();
  const color = hexToOptionColor(option.config.color);

  if (option.archivedAt) {
    return (
      <div className="flex h-8.5 items-center gap-2.25 rounded-[9px] px-2.5 font-sans text-meta text-ink-3 opacity-60">
        <span aria-hidden className={cn('size-3 flex-none rounded-full', dotClasses[color])} />
        <span className="line-through">{option.label}</span>
        <span className="font-mono text-[10px]">archived</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => patchOption.mutate({ optionId: option.id, archived: false })}
          className="cursor-pointer hover:text-ink"
        >
          restore
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-9.5 items-center gap-2.25 rounded-[9px] border border-hairline bg-raised px-2.5">
      <ColorSwatchPicker
        current={color}
        disabled={patchOption.isPending}
        onPick={(hex) =>
          patchOption.mutate({ optionId: option.id, config: { ...option.config, color: hex } })
        }
      />
      <input
        key={option.label}
        defaultValue={option.label}
        aria-label={`Option ${option.value} label`}
        disabled={patchOption.isPending}
        onBlur={(event) => {
          const next = event.target.value.trim();
          if (next.length > 0 && next !== option.label) {
            patchOption.mutate({ optionId: option.id, label: next });
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-ui text-ink focus:outline-none"
      />
      <span className="font-mono text-[11px] text-ink-3">{option.value}</span>
      <button
        type="button"
        title="Archive option"
        aria-label={`Archive option ${option.label}`}
        disabled={patchOption.isPending}
        onClick={() => patchOption.mutate({ optionId: option.id, archived: true })}
        className="cursor-pointer font-sans text-meta text-ink-3 hover:text-danger"
      >
        ⌫
      </button>
    </div>
  );
}

/** Dashed "＋ Add option" row that expands into a label composer. */
function AddOptionRow({ fieldId }: { fieldId: number }) {
  const createOption = useCreateFieldOption();
  const [composing, setComposing] = useState(false);
  const [label, setLabel] = useState('');
  const value = slugifyKey(label);

  if (!composing) {
    return (
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="flex h-8.5 cursor-pointer items-center gap-2.25 rounded-[9px] border border-dashed border-control px-2.5 font-sans text-meta font-medium text-ink-3 hover:text-ink-2"
      >
        ＋ Add option
      </button>
    );
  }

  function submit() {
    const trimmed = label.trim();
    if (trimmed.length === 0 || value.length === 0 || createOption.isPending) {
      return;
    }
    createOption.mutate({ fieldId, value, label: trimmed }, { onSuccess: () => setLabel('') });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-9.5 items-center gap-2.25 rounded-[9px] border border-hairline bg-raised px-2.5">
        <Input
          size="compact"
          autoFocus
          value={label}
          aria-label="New option label"
          placeholder="Option label"
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape') {
              setComposing(false);
              setLabel('');
            }
          }}
          className="border-0 bg-transparent px-0 focus:ring-0"
        />
        <span className="font-mono text-[11px] text-ink-3">{value || '—'}</span>
        <Button
          size="compact"
          variant="primary"
          loading={createOption.isPending}
          disabled={value.length === 0}
          onClick={submit}
        >
          Add
        </Button>
        <Button
          size="compact"
          variant="ghost"
          onClick={() => {
            setComposing(false);
            setLabel('');
          }}
        >
          Cancel
        </Button>
      </div>
      {createOption.isError ? (
        <p className="m-0 px-2.5 font-sans text-meta text-danger">
          {(createOption.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}

/** Inline expanded editor under a field row: rename, config, archive, options. */
function FieldEditor({
  board,
  field,
  onClose,
}: {
  board: Board;
  field: Field;
  onClose: () => void;
}) {
  const patchField = usePatchField();
  const [label, setLabel] = useState(field.label);
  const [description, setDescription] = useState(field.config.description ?? '');
  const [widget, setWidget] = useState(field.config.widget ?? 'plain');

  // config replaces entirely on PATCH (docs/api/update-field.md) — start from
  // the stored object and only touch the keys this editor owns. The widget
  // picker is only offered for text fields; leave other types' widget alone.
  const nextConfig: Record<string, unknown> = { ...field.config };
  if (field.type === 'text') {
    if (widget !== 'plain') {
      nextConfig.widget = widget;
    } else {
      delete nextConfig.widget;
    }
  }
  if (description.trim().length > 0) {
    nextConfig.description = description.trim();
  } else {
    delete nextConfig.description;
  }
  const labelDirty = label.trim().length > 0 && label.trim() !== field.label;
  const configDirty = JSON.stringify(nextConfig) !== JSON.stringify(field.config);

  const usedBy = board.typeFields.filter((typeField) => typeField.fieldId === field.id);
  const typeById = new Map(board.types.map((type) => [type.id, type]));
  const valueCount = board.tickets.filter((ticket) => {
    const value = ticket.values[field.key];
    return value !== undefined && value !== null;
  }).length;

  const sortedOptions = [...field.options].sort((left, right) => left.position - right.position);
  const activeOptions = sortedOptions.filter((option) => !option.archivedAt);
  const archivedOptions = sortedOptions.filter((option) => option.archivedAt);

  function save() {
    if (!labelDirty && !configDirty) {
      return;
    }
    patchField.mutate(
      {
        fieldId: field.id,
        ...(labelDirty ? { label: label.trim() } : {}),
        ...(configDirty ? { config: nextConfig } : {}),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="border-b border-hairline bg-app px-4.5 py-4">
      <div className="grid max-w-152 grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.25">
          <FieldLabel htmlFor={`field-label-${field.id}`}>Label</FieldLabel>
          <Input
            id={`field-label-${field.id}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.25">
            <FieldLabel>Key</FieldLabel>
            <Input disabled value={`${field.key} 🔒`} className="font-mono text-[13px]" />
          </div>
          <div className="flex flex-col gap-1.25">
            <FieldLabel>Type</FieldLabel>
            <Input disabled value={`${field.type} 🔒`} className="font-mono text-[13px]" />
          </div>
        </div>
        <div className="flex flex-col gap-1.25">
          <FieldLabel htmlFor={`field-desc-${field.id}`}>Description</FieldLabel>
          <Input
            id={`field-desc-${field.id}`}
            value={description}
            placeholder="Shown as help text on forms"
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {field.type === 'text' ? (
          <div className="flex flex-col gap-1.25">
            <FieldLabel>Widget</FieldLabel>
            <Combobox
              options={[
                { value: 'plain', label: 'Plain text' },
                { value: 'markdown', label: 'Markdown' },
              ]}
              value={widget}
              onChange={(next) => setWidget(next ?? 'plain')}
            />
          </div>
        ) : null}
      </div>

      {usedBy.length > 0 ? (
        <div className="mt-3.5 flex flex-col gap-1.25">
          <FieldLabel>Used by</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.25">
            {usedBy.map((typeField) => (
              <span
                key={typeField.ticketTypeId}
                className="inline-flex h-4.5 items-center gap-1 rounded-[5px] border border-hairline px-1.75 font-sans text-[10px] font-medium text-ink-2"
              >
                {typeById.get(typeField.ticketTypeId)?.label ?? typeField.ticketTypeId}
                {typeField.required ? <span className="text-danger">required</span> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {field.type === 'select' || field.type === 'multi_select' ? (
        <div className="mt-3.5 max-w-152">
          <div className="mb-2 flex items-center gap-2">
            <FieldLabel>Options</FieldLabel>
            <span className="font-mono text-[11px] text-ink-3">value is immutable</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {activeOptions.map((option) => (
              <OptionRow key={option.id} option={option} />
            ))}
            <AddOptionRow fieldId={field.id} />
            {archivedOptions.map((option) => (
              <OptionRow key={option.id} option={option} />
            ))}
          </div>
        </div>
      ) : null}

      {patchField.isError ? (
        <p className="m-0 mt-3 font-sans text-meta text-danger">
          {(patchField.error as Error).message}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <span className="font-mono text-[11px] text-ink-3">
          used by {valueCount} ticket{valueCount === 1 ? '' : 's'}
        </span>
        <span className="flex-1" />
        <Button
          size="compact"
          title={field.system ? 'System fields can’t be archived' : undefined}
          disabled={field.system || patchField.isPending}
          onClick={() =>
            patchField.mutate(
              { fieldId: field.id, archived: !field.archivedAt },
              { onSuccess: onClose },
            )
          }
          className={cn(!field.system && 'text-danger hover:text-danger')}
        >
          {field.archivedAt ? 'Restore field' : 'Archive field'}
        </Button>
        <Button size="compact" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="compact"
          variant="primary"
          loading={patchField.isPending}
          disabled={!labelDirty && !configDirty}
          onClick={save}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/** "＋ New field" composer: label, key (auto-slugged, editable), type. */
function NewFieldComposer({ projectKey, onClose }: { projectKey: string; onClose: () => void }) {
  const createField = useCreateField(projectKey);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [type, setType] = useState<CreatableFieldType>('text');

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    const trimmedKey = key.trim();
    if (trimmedLabel.length === 0 || trimmedKey.length === 0 || createField.isPending) {
      return;
    }
    createField.mutate({ key: trimmedKey, label: trimmedLabel, type }, { onSuccess: onClose });
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3.5 rounded-panel border border-hairline bg-raised p-4 shadow-sm"
    >
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
            options={CREATABLE_FIELD_TYPES.map((candidate) => ({
              value: candidate,
              label: candidate,
            }))}
            value={type}
            onChange={(next) => setType((next as CreatableFieldType | null) ?? 'text')}
          />
        </div>
      </div>
      {createField.isError ? (
        <p className="m-0 mt-2.5 font-sans text-meta text-danger">
          {(createField.error as Error).message}
        </p>
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
          disabled={label.trim().length === 0 || key.trim().length === 0}
        >
          Create field
        </Button>
      </div>
    </form>
  );
}

// Fields CRUD per docs/design/06-settings-admin.html §A: header (count meta,
// show-archived toggle, ＋ New field), fields table, and — adapted from the
// design's side panel — an inline expanded editor under the clicked row.
export function FieldsSettings({
  board,
  indexes,
  projectKey,
}: {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [openFieldId, setOpenFieldId] = useState<number | null>(null);

  const archivedCount = board.fields.filter((field) => field.archivedAt).length;
  const rows = useMemo(
    () => board.fields.filter((field) => showArchived || !field.archivedAt),
    [board.fields, showArchived],
  );
  const typeById = new Map(board.types.map((type) => [type.id, type]));

  return (
    <div className="flex min-h-full flex-col px-6.5 pb-6 pt-5.5">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="m-0 font-sans text-[20px] font-semibold text-ink">Fields</h2>
        <span className="font-mono text-meta text-ink-3">
          {board.fields.length} fields · {archivedCount} archived
        </span>
        <span className="flex-1" />
        <Switch
          label="Show archived"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
        />
        <Button
          size="compact"
          variant="primary"
          className="shrink-0 whitespace-nowrap"
          onClick={() => setComposerOpen(true)}
        >
          ＋ New field
        </Button>
      </div>

      {composerOpen ? (
        <NewFieldComposer projectKey={projectKey} onClose={() => setComposerOpen(false)} />
      ) : null}

      <div className="overflow-hidden rounded-panel border border-hairline bg-raised">
        <div
          className={cn(
            'grid h-9 items-center whitespace-nowrap border-b border-hairline bg-app px-2 font-sans text-[11px] font-medium uppercase tracking-[0.05em] text-ink-2',
            GRID_COLUMNS,
          )}
        >
          <span className="px-2.5">Field</span>
          <span>Key</span>
          <span>Type</span>
          <span>Used by</span>
          <span>Options</span>
          <span />
        </div>
        {rows.map((field) => {
          const open = openFieldId === field.id;
          const usedBy = board.typeFields.filter((typeField) => typeField.fieldId === field.id);
          const activeOptions = (indexes.optionsByFieldId.get(field.id) ?? []).slice();
          const hasOptions = field.type === 'select' || field.type === 'multi_select';
          return (
            <div key={field.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenFieldId(open ? null : field.id)}
                className={cn(
                  'grid h-11 w-full cursor-pointer items-center border-b border-hairline px-2 text-left hover:bg-app',
                  GRID_COLUMNS,
                  field.archivedAt && 'opacity-60',
                  open && 'bg-app',
                )}
              >
                <span className="flex min-w-0 items-center gap-2 px-2.5">
                  <span className="truncate font-sans text-ui font-medium text-ink">
                    {field.label}
                  </span>
                  {field.archivedAt ? <ArchChip /> : null}
                </span>
                <span className="truncate font-mono text-meta text-ink-2">{field.key}</span>
                <span>
                  <TypeBadge label={field.type} className="font-mono text-[11px]" />
                </span>
                <span className="flex min-w-0 items-center gap-1.25">
                  {usedBy.slice(0, 2).map((typeField) => (
                    <span
                      key={typeField.ticketTypeId}
                      className="inline-flex h-4.5 flex-none items-center rounded-[5px] border border-hairline px-1.75 font-sans text-[10px] font-medium text-ink-2"
                    >
                      {typeById.get(typeField.ticketTypeId)?.label ?? typeField.ticketTypeId}
                    </span>
                  ))}
                  {usedBy.length > 2 ? (
                    <span className="font-mono text-[10px] text-ink-3">
                      +{usedBy.length - 2} more
                    </span>
                  ) : null}
                  {usedBy.length === 0 ? (
                    <span className="font-mono text-meta text-ink-3">—</span>
                  ) : null}
                </span>
                <span className="flex min-w-0 items-center gap-1.25">
                  {hasOptions ? (
                    <>
                      {activeOptions.slice(0, 2).map((option) => (
                        <OptionChip
                          key={option.id}
                          color={hexToOptionColor(option.config.color)}
                          label={option.label}
                          className="h-4.5 flex-none px-1.75 text-[10px]"
                        />
                      ))}
                      {activeOptions.length > 2 ? (
                        <span className="font-mono text-[10px] text-ink-3">
                          +{activeOptions.length - 2}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="font-mono text-meta text-ink-3">—</span>
                  )}
                </span>
                <span aria-hidden className="font-sans text-ui text-ink-3">
                  {open ? '⌄' : '›'}
                </span>
              </button>
              {open ? (
                <FieldEditor
                  key={`${field.id}-${field.label}-${field.archivedAt ?? ''}`}
                  board={board}
                  field={field}
                  onClose={() => setOpenFieldId(null)}
                />
              ) : null}
            </div>
          );
        })}
        {rows.length === 0 ? (
          <p className="m-0 px-4.5 py-6 text-center font-sans text-ui text-ink-3">
            No fields yet — create the first one.
          </p>
        ) : null}
      </div>
    </div>
  );
}
