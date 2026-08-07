import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type {
  Board,
  CreatedItem,
  Field,
  Item,
  ItemType,
  ItemTypeField,
  Project,
} from '../api/types';
import { useCreateItem } from '../api/use-create-item';
import { typePill } from '../domain/status';
import { FieldWidget } from '../registry/field-widget';
import { hexToOptionColor, type OptionColor } from '../registry/option-color';
import { useCurrentUser } from '../state/current-user-context';
import { Button, cn, Combobox, DialogClose, DialogContent, DialogFooter, DialogRoot, DialogTitle, FieldError, FieldLabel, FieldWrapper, Input, Pill } from '@tickets/ui';
import { StatusSelect } from '../ui/status-select';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';

// Subtasks are created from a parent item's Subtasks section (SubtaskQuickCreate
// below), never from the global picker — the picker shows them as a disabled row.
const SUBTASK_KEY = 'subtask';

type PlacementRow = { placement: ItemTypeField; field: Field };

// The type's form, resolved through indexes.placementsByType (type → ordered
// field placements) and indexes.fieldById; archived fields drop out just like
// the legacy dialog.
function rowsForType(indexes: BoardIndexes, type: ItemType): PlacementRow[] {
  return (indexes.placementsByType.get(type.id) ?? []).flatMap((placement) => {
    const field = indexes.fieldById.get(placement.fieldId);
    return field && !field.archivedAt ? [{ placement, field }] : [];
  });
}

// 36px icon tile on each type card: type.config.color lands on the nearest
// Instrument option color; colorless types get the neutral inset/ink-2 pair.
const iconColorClasses: Record<OptionColor, string> = {
  red: 'bg-red-3 text-red-9',
  orange: 'bg-orange-3 text-orange-9',
  yellow: 'bg-yellow-3 text-yellow-9',
  green: 'bg-green-3 text-green-9',
  teal: 'bg-teal-3 text-teal-9',
  cyan: 'bg-cyan-3 text-cyan-9',
  blue: 'bg-blue-3 text-blue-9',
  indigo: 'bg-indigo-3 text-indigo-9',
  purple: 'bg-purple-3 text-purple-9',
  pink: 'bg-pink-3 text-pink-9',
  gray: 'bg-gray-3 text-gray-9',
};

function TypeIcon({ type, dashed }: { type: ItemType; dashed?: boolean }) {
  const colored = typeof type.config.color === 'string' && type.config.color.length > 0;
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-36 shrink-0 items-center justify-center rounded-12',
        colored ? iconColorClasses[hexToOptionColor(type.config.color)] : 'bg-surface-inset text-gray-11',
      )}
    >
      {dashed ? (
        <span className="size-10 shrink-0 rounded-none border-2 border-dashed border-gray-9" />
      ) : (
        <span className="size-10 shrink-0 rounded-none bg-current" />
      )}
    </span>
  );
}

function ProjectChip({ project }: { project: Project }) {
  return (
    <span className="inline-flex h-28 shrink-0 items-center gap-7 rounded-8 border-1 border-gray-6 px-10 font-sans text-13/19 font-500 text-gray-12">
      <span className="rounded-4 bg-surface-inset px-5 py-2 font-mono text-11/13 tracking-wider font-500">
        {project.itemPrefix}
      </span>
      {project.name}
    </span>
  );
}

function CloseButton() {
  return (
    <DialogClose asChild>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'flex size-30 shrink-0 items-center justify-center rounded-8 border-1 border-gray-6 bg-transparent',
          'text-gray-11 hover:bg-surface-inset hover:text-gray-12',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-3',
        )}
      >
        ×
      </button>
    </DialogClose>
  );
}

export function NewItemDialog({
  projectKey,
  board,
  indexes,
  open,
  onClose,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const createItem = useCreateItem();
  const titleRef = useRef<HTMLInputElement>(null);

  const selectable = useMemo(
    () => board.types.filter((type) => !type.archivedAt && type.key !== SUBTASK_KEY),
    [board.types],
  );
  const subtaskType =
    board.types.find((type) => !type.archivedAt && type.key === SUBTASK_KEY) ?? null;

  const [pickedTypeId, setPickedTypeId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [statusValue, setStatusValue] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<ReadonlySet<string>>(new Set());
  const [apiError, setApiError] = useState('');

  // Step 1 is skipped entirely when there is only one creatable type.
  const type =
    pickedTypeId !== null
      ? (selectable.find((candidate) => candidate.id === pickedTypeId) ?? null)
      : selectable.length === 1
        ? (selectable[0] ?? null)
        : null;

  const rows = type ? rowsForType(indexes, type) : [];
  const titleRow = rows.find((row) => row.field.key === 'title') ?? null;
  const markdownRows = rows.filter(
    (row) => row.field.type === 'string' && row.field.config.format === 'markdown',
  );
  const gridRows = rows.filter(
    (row) => row !== titleRow && row.field.config.workflow !== true && !markdownRows.includes(row),
  );

  // Creation legality: entry edges (item = null). The workflow field's
  // options double as the status list; default to the initial option
  // (first todo-kind, else first) — mirrors the server's vocab.initialOption.
  const workflowField = type ? indexes.workflowField(type.id) : undefined;
  const entryStatuses = type ? legalStatusTargets(board, indexes, null, type.id) : [];
  const typeStatusOptions =
    type && workflowField ? indexes.optionsForField(type.id, workflowField) : [];
  const initialOption =
    typeStatusOptions.find((option) => option.kind === 'todo') ?? typeStatusOptions[0];
  const defaultStatusValue = initialOption?.value ?? entryStatuses[0]?.value ?? null;
  const effectiveStatusValue = statusValue ?? defaultStatusValue;
  const statusOptions = typeStatusOptions.map((option) => ({
    key: option.value,
    label: option.label,
    kind: option.kind ?? 'todo',
  }));

  const reset = () => {
    setPickedTypeId(null);
    setTitle('');
    setFieldValues({});
    setStatusValue(null);
    setMissingKeys(new Set());
    setApiError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = (next: ItemType) => {
    setFieldValues({});
    setMissingKeys(new Set());
    setApiError('');
    setPickedTypeId(next.id);
  };

  const setValue = (key: string) => (next: unknown) => {
    setFieldValues((previous) => ({ ...previous, [key]: next }));
    setMissingKeys((previous) => {
      if (!previous.has(key)) {
        return previous;
      }
      const cleared = new Set(previous);
      cleared.delete(key);
      return cleared;
    });
  };

  const submit = async () => {
    if (!type || userId === null || title.trim().length === 0 || createItem.isPending) {
      return;
    }
    setApiError('');
    const missing = new Set<string>();
    for (const { placement, field } of [...gridRows, ...markdownRows]) {
      if (!placement.required) {
        continue;
      }
      const value = fieldValues[field.key];
      if (value === undefined || value === null || value === '') {
        missing.add(field.key);
      }
    }
    setMissingKeys(missing);
    if (missing.size > 0) {
      return;
    }
    const values: Record<string, unknown> = { ...fieldValues };
    values[titleRow?.field.key ?? 'title'] = title.trim();
    if (workflowField && effectiveStatusValue !== null) {
      values[workflowField.key] = effectiveStatusValue;
    }
    try {
      const created = await createItem.mutateAsync({
        projectKey,
        actorId: userId,
        typeKey: type.key,
        values,
      });
      reset();
      onClose();
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, t: created.number }),
      });
    } catch (createError) {
      setApiError((createError as Error).message);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!type && /^[1-9]$/.test(event.key)) {
      const candidate = selectable[Number(event.key) - 1];
      if (candidate) {
        event.preventDefault();
        pick(candidate);
      }
      return;
    }
    if (type && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(event) => {
          if (type) {
            event.preventDefault();
            titleRef.current?.focus();
          }
        }}
        className={cn(
          'overflow-hidden p-0',
          type ? 'w-[min(47.5rem,calc(100vw-2rem))]' : 'w-[min(40rem,calc(100vw-2rem))]',
        )}
      >
        {type === null ? (
          <>
            <header className="flex items-center gap-10 border-b-1 border-gray-6 px-20 py-16">
              <DialogTitle>New item</DialogTitle>
              <span className="font-sans text-13/19 text-gray-11">in</span>
              <ProjectChip project={board.project} />
              <span className="flex-1" />
              <CloseButton />
            </header>
            <div className="flex flex-col gap-10 px-20 py-18">
              {selectable.map((candidate, index) => {
                const candidateRows = rowsForType(indexes, candidate);
                const requiredCount = candidateRows.filter((row) => row.placement.required).length;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => pick(candidate)}
                    className={cn(
                      'flex w-full items-center gap-12 rounded-12 border-1 border-gray-6 bg-transparent px-16 py-14 text-left',
                      'hover:border-gray-7 hover:bg-gray-1',
                      'focus-visible:border-indigo-9 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-3',
                    )}
                  >
                    <TypeIcon type={candidate} />
                    <span className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="font-sans text-14 font-600 text-gray-12">
                        {candidate.label}
                      </span>
                      <span className="font-sans text-12/17 text-gray-11">
                        {candidateRows.length} {candidateRows.length === 1 ? 'field' : 'fields'} ·{' '}
                        {requiredCount} required
                      </span>
                    </span>
                    {index < 9 ? (
                      <span
                        aria-hidden
                        className="shrink-0 rounded-4 border-1 border-gray-6 px-6 py-px font-mono text-11/13 tracking-wider text-gray-9"
                      >
                        {index + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {subtaskType ? (
                <div className="flex items-center gap-12 rounded-12 border-1 border-dashed border-gray-6 px-16 py-12 opacity-65">
                  <TypeIcon type={subtaskType} dashed />
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="font-sans text-14 font-600 text-gray-11">
                      {subtaskType.label}
                    </span>
                    <span className="font-sans text-12/17 text-gray-9">
                      Created from a parent item&rsquo;s Subtasks section — not from here
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
            <footer className="border-t-1 border-gray-6 bg-gray-1 px-20 py-12">
              <p className="m-0 font-sans text-12/17 text-gray-11">
                🔒 Type is permanent — it decides this item&rsquo;s form and can&rsquo;t be changed
                after creation.
              </p>
            </footer>
          </>
        ) : (
          <>
            <header className="flex items-center gap-10 border-b-1 border-gray-6 px-20 py-16">
              {selectable.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setPickedTypeId(null)}
                  className={cn(
                    'shrink-0 rounded-6 bg-transparent font-sans text-12/17 font-500 text-indigo-9 hover:text-indigo-10',
                    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-indigo-3',
                  )}
                >
                  ‹ Type
                </button>
              ) : null}
              <DialogTitle className="truncate">New {type.label}</DialogTitle>
              <Pill
                {...typePill}
                label={`${type.label} · 🔒 permanent`}
                className={cn(typePill.className, 'shrink-0')}
              />
              <span className="font-sans text-13/19 text-gray-11">in</span>
              <ProjectChip project={board.project} />
              <span className="flex-1" />
              <CloseButton />
            </header>
            <div className="flex max-h-[62vh] flex-col gap-14 overflow-y-auto px-20 py-18">
              <Input
                ref={titleRef}
                autoFocus
                required
                aria-label="Title"
                placeholder="Title"
                value={title}
                onChange={(next) => setTitle(next)}
                className="h-40 shrink-0 rounded-8 px-13 text-15"
              />
              {/* Composed through the shared `FieldWrapper` rather than a
                  hand-built label/control/error stack, so this dialog inherits
                  design file 20's layout rules: labels move beside the field at
                  >=520px of the field's own box, and the pairs below split into
                  two columns at >=760px of the dialog's.

                  NOT converted to the form engine itself. `FieldWidget`
                  dispatches on a database field definition — `field.type` plus
                  `field.config` — and needs `board`, `indexes` and `typeId`,
                  none of which the engine's `InputProps` carries. Driving this
                  from a FormConfig means a DB-field -> `InputKind` mapping,
                  which is `propsToForm`, which is not scoped yet. */}
              {gridRows.length > 0 ? (
                <div className="@container shrink-0">
                  <div className="flex flex-col gap-12 @form-columns:grid @form-columns:grid-cols-2 @form-columns:gap-x-16">
                    {gridRows.map(({ placement, field }) => (
                      <FieldWrapper
                        key={field.id}
                        name={field.key}
                        label={field.label}
                        required={placement.required}
                        touched={false}
                        loading={false}
                        error={
                          missingKeys.has(field.key)
                            ? `Required for ${type.label.toLowerCase()}s`
                            : undefined
                        }
                      >
                        <FieldWidget
                          field={field}
                          value={fieldValues[field.key]}
                          board={board}
                          indexes={indexes}
                          ticket={null}
                          typeId={type.id}
                          onChange={setValue(field.key)}
                        />
                      </FieldWrapper>
                    ))}
                  </div>
                </div>
              ) : null}
              {markdownRows.map(({ placement, field }) => (
                <div key={field.id} className="shrink-0">
                  <FieldWrapper
                    name={field.key}
                    label={field.label}
                    required={placement.required}
                    touched={false}
                    loading={false}
                    error={
                      missingKeys.has(field.key)
                        ? `Required for ${type.label.toLowerCase()}s`
                        : undefined
                    }
                  >
                    <FieldWidget
                      field={field}
                      value={fieldValues[field.key]}
                      board={board}
                      indexes={indexes}
                      ticket={null}
                      typeId={type.id}
                      onChange={setValue(field.key)}
                    />
                  </FieldWrapper>
                </div>
              ))}
            </div>
            <footer className="flex items-center gap-10 border-t-1 border-gray-6 bg-surface-inset px-20 py-14">
              {workflowField ? (
                <div className="w-192 shrink-0">
                  <StatusSelect
                    statuses={statusOptions}
                    legalTargets={entryStatuses.map((status) => status.value)}
                    value={effectiveStatusValue}
                    onChange={setStatusValue}
                  />
                </div>
              ) : null}
              <span className="flex-1" />
              {apiError ? <FieldError className="m-0">{apiError}</FieldError> : null}
              {userId === null ? (
                <span className="font-sans text-12/17 text-red-9">
                  Pick a user in the header first
                </span>
              ) : (
                <span aria-hidden className="font-mono text-11/13 tracking-wider text-gray-9">
                  ⌘↵ create
                </span>
              )}
              <DialogFooter className="mt-0 border-0 p-0" cancel={<Button variant="ghost" onClick={close}>Cancel</Button>}>
                <Button
                  variant="solid"
                  loading={createItem.isPending}
                  disabled={title.trim().length === 0 || userId === null}
                  onClick={() => void submit()}
                >
                  Create item
                </Button>
              </DialogFooter>
            </footer>
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

// Fast path from a parent item's Subtasks section (design §subtask quick
// create): title + compact type select + Add; ↵ creates. Everything else
// inherits defaults — the server assigns the workflow's entry status.
export function SubtaskQuickCreate({
  projectKey,
  board,
  indexes,
  parent,
  onCreated,
}: {
  projectKey: string;
  board: Board;
  indexes: BoardIndexes;
  parent: Item;
  onCreated: (created: CreatedItem) => void;
}) {
  const { userId } = useCurrentUser();
  const createItem = useCreateItem();

  const types = useMemo(() => board.types.filter((type) => !type.archivedAt), [board.types]);
  const defaultTypeKey =
    types.find((type) => type.key === SUBTASK_KEY)?.key ?? types[0]?.key ?? SUBTASK_KEY;
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const effectiveTypeKey = typeKey ?? defaultTypeKey;

  // Hint only — the server owns numbering; siblings count via the same index
  // the parent detail uses.
  const siblingCount = indexes.childrenByParent.get(parent.id)?.length ?? 0;
  const nextNumber = board.items.reduce((max, item) => Math.max(max, item.number), 0) + 1;

  const create = async () => {
    if (userId === null || title.trim().length === 0 || createItem.isPending) {
      return;
    }
    const created = await createItem.mutateAsync({
      projectKey,
      actorId: userId,
      typeKey: effectiveTypeKey,
      parentId: parent.id,
      values: { title: title.trim() },
    });
    setTitle('');
    onCreated(created);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-10 rounded-12 border-1 border-gray-7 bg-surface-raised py-6 pl-13 pr-6',
        'focus-within:border-indigo-9 focus-within:ring-3 focus-within:ring-indigo-3',
      )}
    >
      <span
        aria-hidden
        className="size-9 shrink-0 rounded-full border-2 border-dashed border-gray-7"
      />
      <input
        value={title}
        placeholder={siblingCount > 0 ? 'Add another subtask…' : 'Add a subtask…'}
        aria-label="Subtask title"
        disabled={userId === null}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void create();
          }
        }}
        className="m-0 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-14 text-gray-12 outline-none placeholder:text-gray-9"
      />
      <span aria-hidden className="hidden shrink-0 font-mono text-10 text-gray-9 sm:inline">
        ↵ creates {board.project.itemPrefix}-{nextNumber}
      </span>
      <Combobox
        size="xs"
        className="w-120 shrink-0"
        options={types.map((type) => ({ value: type.key, label: type.label }))}
        value={effectiveTypeKey}
        onChange={(next) => setTypeKey(next)}
      />
      <Button
        size="sm"
        loading={createItem.isPending}
        disabled={userId === null || title.trim().length === 0}
        onClick={() => void create()}
      >
        Add
      </Button>
    </div>
  );
}
