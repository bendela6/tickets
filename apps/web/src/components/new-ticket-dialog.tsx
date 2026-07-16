import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type {
  Board,
  BoardTicket,
  CreatedTicket,
  Field,
  Project,
  TicketType,
  TypeField,
} from '../api/types';
import { useCreateItem } from '../api/use-create-item';
import { FieldWidget } from '../registry/field-widget';
import { hexToOptionColor } from '../registry/option-color';
import { useCurrentUser } from '../state/current-user-context';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import { Combobox } from '../ui/combobox';
import { DialogClose, DialogContent, DialogRoot, DialogTitle } from '../ui/dialog';
import { FieldError } from '../ui/field-error';
import { FieldLabel } from '../ui/field-label';
import { Input } from '../ui/input';
import type { OptionColor } from '../ui/option-chip';
import { StatusSelect } from '../ui/status-select';
import { TypeBadge } from '../ui/type-badge';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';

// Subtasks are created from a parent ticket's Subtasks section (SubtaskQuickCreate
// below), never from the global picker — the picker shows them as a disabled row.
const SUBTASK_KEY = 'subtask';

type TypeFieldRow = { typeField: TypeField; field: Field };

// The type's form, resolved through board.typeFields (type → ordered field ids)
// and indexes.fieldById; archived fields drop out just like the legacy dialog.
function rowsForType(board: Board, indexes: BoardIndexes, type: TicketType): TypeFieldRow[] {
  return board.typeFields
    .filter((row) => row.ticketTypeId === type.id)
    .sort((left, right) => left.position - right.position)
    .flatMap((typeField) => {
      const field = indexes.fieldById.get(typeField.fieldId);
      return field && !field.archivedAt ? [{ typeField, field }] : [];
    });
}

// 36px icon tile on each type card: type.config.color lands on the nearest
// Instrument option color; colorless types get the neutral inset/ink-2 pair.
const iconColorClasses: Record<OptionColor, string> = {
  red: 'bg-opt-red-subtle text-opt-red',
  orange: 'bg-opt-orange-subtle text-opt-orange',
  yellow: 'bg-opt-yellow-subtle text-opt-yellow',
  green: 'bg-opt-green-subtle text-opt-green',
  teal: 'bg-opt-teal-subtle text-opt-teal',
  cyan: 'bg-opt-cyan-subtle text-opt-cyan',
  blue: 'bg-opt-blue-subtle text-opt-blue',
  indigo: 'bg-opt-indigo-subtle text-opt-indigo',
  purple: 'bg-opt-purple-subtle text-opt-purple',
  pink: 'bg-opt-pink-subtle text-opt-pink',
  gray: 'bg-opt-gray-subtle text-opt-gray',
};

function TypeIcon({ type, dashed }: { type: TicketType; dashed?: boolean }) {
  const colored = typeof type.config.color === 'string' && type.config.color.length > 0;
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
        colored ? iconColorClasses[hexToOptionColor(type.config.color)] : 'bg-inset text-ink-2',
      )}
    >
      {dashed ? (
        <span className="size-2.5 shrink-0 rounded-xs border-[1.5px] border-dashed border-ink-3" />
      ) : (
        <span className="size-2.5 shrink-0 rounded-xs bg-current" />
      )}
    </span>
  );
}

function ProjectChip({ project }: { project: Project }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1.75 rounded-[7px] border border-hairline px-2.5 font-sans text-ui font-medium text-ink">
      <span className="rounded-sm bg-inset px-1.25 py-0.5 font-mono text-label font-medium">
        {project.ticketPrefix}
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
          'flex size-7.5 shrink-0 items-center justify-center rounded-[7px] border border-hairline bg-transparent',
          'text-ink-2 hover:bg-inset hover:text-ink',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
        )}
      >
        ×
      </button>
    </DialogClose>
  );
}

export function NewTicketDialog({
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
  const createTicket = useCreateItem();
  const titleRef = useRef<HTMLInputElement>(null);

  const selectable = useMemo(
    () =>
      board.types
        .filter((type) => !type.archivedAt && type.key !== SUBTASK_KEY)
        .sort((left, right) => left.position - right.position),
    [board.types],
  );
  const subtaskType =
    board.types.find((type) => !type.archivedAt && type.key === SUBTASK_KEY) ?? null;

  const [pickedTypeId, setPickedTypeId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [statusKey, setStatusKey] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<ReadonlySet<string>>(new Set());
  const [apiError, setApiError] = useState('');

  // Step 1 is skipped entirely when there is only one creatable type.
  const type =
    pickedTypeId !== null
      ? (selectable.find((candidate) => candidate.id === pickedTypeId) ?? null)
      : selectable.length === 1
        ? (selectable[0] ?? null)
        : null;

  const rows = type ? rowsForType(board, indexes, type) : [];
  const titleRow = rows.find((row) => row.field.key === 'title') ?? null;
  const markdownRows = rows.filter(
    (row) => row.field.type === 'text' && row.field.config.widget === 'markdown',
  );
  const gridRows = rows.filter(
    (row) => row !== titleRow && row.field.type !== 'status' && !markdownRows.includes(row),
  );

  // Creation legality: entry edges (ticket = null). Default to the workflow's
  // marked-initial status, else the first legal entry status.
  const entryStatuses = legalStatusTargets(board, indexes, null);
  const defaultStatusKey =
    entryStatuses.find((status) => status.config.initial)?.key ?? entryStatuses[0]?.key ?? null;
  const effectiveStatusKey = statusKey ?? defaultStatusKey;
  const activeStatuses = [...board.statuses]
    .filter((status) => !status.archivedAt)
    .sort((left, right) => left.position - right.position);

  const reset = () => {
    setPickedTypeId(null);
    setTitle('');
    setFieldValues({});
    setStatusKey(null);
    setMissingKeys(new Set());
    setApiError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = (next: TicketType) => {
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
    if (!type || userId === null || title.trim().length === 0 || createTicket.isPending) {
      return;
    }
    setApiError('');
    const missing = new Set<string>();
    for (const { typeField, field } of [...gridRows, ...markdownRows]) {
      if (!typeField.required) {
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
    if (indexes.statusField && effectiveStatusKey !== null) {
      values[indexes.statusField.key] = effectiveStatusKey;
    }
    try {
      const created = await createTicket.mutateAsync({
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
            <header className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
              <DialogTitle>New ticket</DialogTitle>
              <span className="font-sans text-ui text-ink-2">in</span>
              <ProjectChip project={board.project} />
              <span className="flex-1" />
              <CloseButton />
            </header>
            <div className="flex flex-col gap-2.5 px-5 py-4.5">
              {selectable.map((candidate, index) => {
                const candidateRows = rowsForType(board, indexes, candidate);
                const requiredCount = candidateRows.filter((row) => row.typeField.required).length;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => pick(candidate)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-panel border border-hairline bg-transparent px-4 py-3.5 text-left',
                      'hover:border-control hover:bg-app',
                      'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
                    )}
                  >
                    <TypeIcon type={candidate} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-sans text-[14px] font-semibold text-ink">
                        {candidate.label}
                      </span>
                      <span className="font-sans text-meta text-ink-2">
                        {candidateRows.length} {candidateRows.length === 1 ? 'field' : 'fields'} ·{' '}
                        {requiredCount} required
                      </span>
                    </span>
                    {index < 9 ? (
                      <span
                        aria-hidden
                        className="shrink-0 rounded-sm border border-hairline px-1.5 py-px font-mono text-label text-ink-3"
                      >
                        {index + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {subtaskType ? (
                <div className="flex items-center gap-3 rounded-panel border border-dashed border-hairline px-4 py-3 opacity-65">
                  <TypeIcon type={subtaskType} dashed />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-sans text-[14px] font-semibold text-ink-2">
                      {subtaskType.label}
                    </span>
                    <span className="font-sans text-meta text-ink-3">
                      Created from a parent ticket&rsquo;s Subtasks section — not from here
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
            <footer className="border-t border-hairline bg-app px-5 py-3">
              <p className="m-0 font-sans text-meta text-ink-2">
                🔒 Type is permanent — it decides this ticket&rsquo;s form and can&rsquo;t be
                changed after creation.
              </p>
            </footer>
          </>
        ) : (
          <>
            <header className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
              {selectable.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setPickedTypeId(null)}
                  className={cn(
                    'shrink-0 rounded-ctrl bg-transparent font-sans text-meta font-medium text-accent hover:text-accent-hover',
                    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
                  )}
                >
                  ‹ Type
                </button>
              ) : null}
              <DialogTitle className="truncate">New {type.label}</DialogTitle>
              <TypeBadge label={`${type.label} · 🔒 permanent`} className="shrink-0" />
              <span className="font-sans text-ui text-ink-2">in</span>
              <ProjectChip project={board.project} />
              <span className="flex-1" />
              <CloseButton />
            </header>
            <div className="flex max-h-[62vh] flex-col gap-3.5 overflow-y-auto px-5 py-4.5">
              <Input
                ref={titleRef}
                autoFocus
                required
                aria-label="Title"
                placeholder="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 shrink-0 rounded-[9px] px-3.25 text-[15px]"
              />
              {gridRows.length > 0 ? (
                <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-3">
                  {gridRows.map(({ typeField, field }) => (
                    <div key={field.id} className="flex min-w-0 flex-col gap-1.25">
                      <FieldLabel required={typeField.required}>{field.label}</FieldLabel>
                      <FieldWidget
                        field={field}
                        value={fieldValues[field.key]}
                        board={board}
                        indexes={indexes}
                        ticket={null}
                        onChange={setValue(field.key)}
                      />
                      {missingKeys.has(field.key) ? (
                        <FieldError className="m-0">
                          Required for {type.label.toLowerCase()}s
                        </FieldError>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {markdownRows.map(({ typeField, field }) => (
                <div key={field.id} className="flex shrink-0 flex-col gap-1.25">
                  <FieldLabel required={typeField.required}>{field.label}</FieldLabel>
                  <FieldWidget
                    field={field}
                    value={fieldValues[field.key]}
                    board={board}
                    indexes={indexes}
                    ticket={null}
                    onChange={setValue(field.key)}
                  />
                  {missingKeys.has(field.key) ? (
                    <FieldError className="m-0">
                      Required for {type.label.toLowerCase()}s
                    </FieldError>
                  ) : null}
                </div>
              ))}
            </div>
            <footer className="flex items-center gap-2.5 border-t border-hairline bg-inset px-5 py-3.5">
              {indexes.statusField ? (
                <div className="w-48 shrink-0">
                  <StatusSelect
                    statuses={activeStatuses.map((status) => ({
                      key: status.key,
                      label: status.label,
                      kind: status.kind,
                    }))}
                    legalTargets={entryStatuses.map((status) => status.key)}
                    value={effectiveStatusKey}
                    onChange={setStatusKey}
                  />
                </div>
              ) : null}
              <span className="flex-1" />
              {apiError ? <FieldError className="m-0">{apiError}</FieldError> : null}
              {userId === null ? (
                <span className="font-sans text-meta text-danger">
                  Pick a user in the header first
                </span>
              ) : (
                <span aria-hidden className="font-mono text-label text-ink-3">
                  ⌘↵ create
                </span>
              )}
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={createTicket.isPending}
                disabled={title.trim().length === 0 || userId === null}
                onClick={() => void submit()}
              >
                Create ticket
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

// Fast path from a parent ticket's Subtasks section (design §subtask quick
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
  parent: BoardTicket;
  onCreated: (created: CreatedTicket) => void;
}) {
  const { userId } = useCurrentUser();
  const createTicket = useCreateItem();

  const types = useMemo(
    () =>
      board.types
        .filter((type) => !type.archivedAt)
        .sort((left, right) => left.position - right.position),
    [board.types],
  );
  const defaultTypeKey =
    types.find((type) => type.key === SUBTASK_KEY)?.key ?? types[0]?.key ?? SUBTASK_KEY;
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const effectiveTypeKey = typeKey ?? defaultTypeKey;

  // Hint only — the server owns numbering; siblings count via the same index
  // the parent detail uses.
  const siblingCount = indexes.childrenByParent.get(parent.id)?.length ?? 0;
  const nextNumber = board.tickets.reduce((max, ticket) => Math.max(max, ticket.number), 0) + 1;

  const create = async () => {
    if (userId === null || title.trim().length === 0 || createTicket.isPending) {
      return;
    }
    const created = await createTicket.mutateAsync({
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
        'flex items-center gap-2.5 rounded-[10px] border border-control bg-raised py-1.5 pl-3.25 pr-1.5',
        'focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-subtle',
      )}
    >
      <span
        aria-hidden
        className="size-2.25 shrink-0 rounded-full border-[1.5px] border-dashed border-control"
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
        className="m-0 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-[14px] text-ink outline-none placeholder:text-ink-3"
      />
      <span aria-hidden className="hidden shrink-0 font-mono text-[10px] text-ink-3 sm:inline">
        ↵ creates {board.project.ticketPrefix}-{nextNumber}
      </span>
      <Combobox
        size="compact"
        className="w-30 shrink-0"
        options={types.map((type) => ({ value: type.key, label: type.label }))}
        value={effectiveTypeKey}
        onChange={(next) => setTypeKey(next)}
      />
      <Button
        size="compact"
        loading={createTicket.isPending}
        disabled={userId === null || title.trim().length === 0}
        onClick={() => void create()}
      >
        Add
      </Button>
    </div>
  );
}
