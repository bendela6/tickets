import { useRef, useState } from 'react';
import type { Board, Status, StatusConfig, StatusKind, Transition } from '../../api/types';
import {
  useCreateStatus,
  useCreateTransition,
  useDeleteTransition,
  usePatchStatus,
} from '../../api/use-vocab-workflow';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { cn } from '../../ui/cn';
import { Combobox } from '../../ui/combobox';
import type { ComboOption } from '../../ui/combobox-list';
import { ConfirmDialog } from '../../ui/dialog';
import { FieldLabel } from '../../ui/field-label';
import { Input } from '../../ui/input';
import { KindGlyph } from '../../ui/kind-glyph';
import { StatusBadge } from '../../ui/status-badge';
import { TypeBadge } from '../../ui/type-badge';
import type { BoardIndexes } from '../../utils/index-board';

const KIND_ORDER: StatusKind[] = ['todo', 'active', 'blocked', 'done', 'dropped'];

const kindText: Record<StatusKind, string> = {
  todo: 'text-kind-todo',
  active: 'text-kind-active',
  blocked: 'text-kind-blocked',
  done: 'text-kind-done',
  dropped: 'text-kind-dropped',
};

const kindChip: Record<StatusKind, string> = {
  todo: 'bg-kind-todo-subtle text-kind-todo',
  active: 'bg-kind-active-subtle text-kind-active',
  blocked: 'bg-kind-blocked-subtle text-kind-blocked',
  done: 'bg-kind-done-subtle text-kind-done',
  dropped: 'bg-kind-dropped-subtle text-kind-dropped',
};

// Combobox value for the workflow entry stub — fromStatusKey: null on the wire.
const ENTRY = '__entry__';

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Dashed green stub per the design's workflow canvas — marks both the
// `config.initial` status and null-from (entry) edges.
function EntryPill() {
  return (
    <span className="inline-flex h-5.5 shrink-0 items-center rounded-full border-[1.5px] border-dashed border-kind-done bg-transparent px-2.25 font-mono text-[10px] font-medium text-kind-done">
      entry
    </span>
  );
}

export function WorkflowSettings({
  board,
  indexes,
  projectKey,
}: {
  board: Board;
  indexes: BoardIndexes;
  projectKey: string;
}) {
  const createStatus = useCreateStatus(projectKey);
  const patchStatus = usePatchStatus();
  const createTransition = useCreateTransition(projectKey);
  const deleteTransition = useDeleteTransition();

  // ----- statuses -----
  const statuses = [...board.statuses].sort(
    (left, right) =>
      KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
      left.position - right.position,
  );
  const archivedCount = statuses.filter((status) => status.archivedAt !== null).length;

  const [addingStatus, setAddingStatus] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKind, setNewKind] = useState<StatusKind>('todo');
  const [newInitial, setNewInitial] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editInitial, setEditInitial] = useState(false);
  const [editError, setEditError] = useState('');

  const openEditor = (status: Status) => {
    setEditingId(status.id);
    setEditLabel(status.label);
    setEditInitial(Boolean(status.config.initial));
    setEditError('');
  };

  const submitNewStatus = async () => {
    setStatusError('');
    const label = newLabel.trim();
    const key = slugify(label);
    if (label.length === 0 || key.length === 0) {
      return;
    }
    try {
      await createStatus.mutateAsync({
        key,
        label,
        kind: newKind,
        ...(newInitial ? { config: { initial: true } } : {}),
      });
      setNewLabel('');
      setNewKind('todo');
      setNewInitial(false);
      setAddingStatus(false);
    } catch (error) {
      setStatusError((error as Error).message);
    }
  };

  const saveStatusEdit = async (status: Status) => {
    setEditError('');
    // PATCH replaces config entirely — carry color/description along.
    const config: StatusConfig = { ...status.config };
    if (editInitial) {
      config.initial = true;
    } else {
      delete config.initial;
    }
    try {
      await patchStatus.mutateAsync({ statusId: status.id, label: editLabel.trim(), config });
      setEditingId(null);
    } catch (error) {
      setEditError((error as Error).message);
    }
  };

  // ----- transitions -----
  const activeStatuses = statuses.filter((status) => status.archivedAt === null);
  const statusOptions: ComboOption[] = activeStatuses.map((status) => ({
    value: status.key,
    label: status.label,
  }));
  const fromOptions: ComboOption[] = [
    { value: ENTRY, label: 'entry — new ticket' },
    ...statusOptions,
  ];
  const typeOptions: ComboOption[] = [...board.types]
    .filter((type) => type.archivedAt === null)
    .sort((left, right) => left.position - right.position)
    .map((type) => ({ value: type.key, label: type.label }));

  const [fromDraft, setFromDraft] = useState<string | null>(null);
  const [toDraft, setToDraft] = useState<string | null>(null);
  const [typeDraft, setTypeDraft] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Transition | null>(null);
  const composerRef = useRef<HTMLFormElement>(null);

  const transitionLabel = (transition: Transition) => {
    const from = indexes.statusById.get(transition.fromStatusId);
    const to = indexes.statusById.get(transition.toStatusId);
    return `${from?.label ?? 'entry'} → ${to?.label ?? `#${transition.toStatusId}`}`;
  };

  const submitTransition = async () => {
    setTransitionError('');
    if (fromDraft === null || toDraft === null) {
      return;
    }
    try {
      await createTransition.mutateAsync({
        fromStatusKey: fromDraft === ENTRY ? null : fromDraft,
        toStatusKey: toDraft,
        ...(typeDraft !== null ? { ticketTypeKey: typeDraft } : {}),
      });
      setFromDraft(null);
      setToDraft(null);
      setTypeDraft(null);
    } catch (error) {
      setTransitionError((error as Error).message);
    }
  };

  const transitionCount = board.transitions.length;

  return (
    <section className="flex flex-col gap-3.5 font-sans">
      {/* header — design 06-C: h1 + mono meta + add-status on the right */}
      <div className="flex items-center gap-3">
        <h1 className="m-0 font-sans text-[20px] font-semibold text-ink">Workflow</h1>
        <span className="font-mono text-meta text-ink-3">
          {board.project.name} · {transitionCount} transition{transitionCount === 1 ? '' : 's'}
        </span>
        <span className="flex-1" />
        <Button size="compact" onClick={() => setAddingStatus((value) => !value)}>
          ＋ Add status
        </Button>
      </div>

      {/* statuses — list · edit panel · archive */}
      <div className="overflow-hidden rounded-panel border border-hairline bg-raised">
        <div className="flex items-center gap-2.25 border-b border-hairline bg-app px-4 py-2.75">
          <span className="font-sans text-[14px] font-semibold text-ink">Statuses</span>
          <span className="font-mono text-label text-ink-3">
            {statuses.length} status{statuses.length === 1 ? '' : 'es'}
            {archivedCount > 0 ? ` · ${archivedCount} archived` : ''}
          </span>
        </div>
        {statuses.map((status) => {
          const archived = status.archivedAt !== null;
          const editing = editingId === status.id;
          return (
            <div key={status.id} className="border-b border-hairline last:border-b-0">
              <div
                className={cn(
                  'flex h-10.5 items-center gap-2.5 bg-transparent px-4',
                  archived && 'opacity-60',
                )}
              >
                <span className={cn('inline-flex shrink-0', kindText[status.kind])}>
                  <KindGlyph kind={status.kind} />
                </span>
                <span
                  className={cn(
                    'font-sans text-ui font-medium text-ink',
                    archived && 'line-through',
                  )}
                >
                  {status.label}
                </span>
                <span className="font-mono text-meta text-ink-3">{status.key}</span>
                <span
                  className={cn(
                    'inline-flex h-4.5 shrink-0 items-center rounded-[5px] px-1.75 font-mono text-[10px] font-medium',
                    kindChip[status.kind],
                  )}
                >
                  {status.kind}
                </span>
                {status.config.initial ? <EntryPill /> : null}
                {archived ? (
                  <span className="inline-flex h-4.5 shrink-0 items-center rounded-ctrl bg-inset px-1.5 font-mono text-[10px] font-medium text-ink-3">
                    ARCH
                  </span>
                ) : null}
                <span className="flex-1" />
                <button
                  type="button"
                  className="shrink-0 font-sans text-meta font-medium text-ink-3 hover:text-danger disabled:opacity-50"
                  disabled={patchStatus.isPending}
                  onClick={() => patchStatus.mutate({ statusId: status.id, archived: !archived })}
                >
                  {archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${status.label}`}
                  className={cn(
                    'shrink-0 px-1 font-sans text-ui text-ink-3 hover:text-ink',
                    editing && 'text-ink',
                  )}
                  onClick={() => (editing ? setEditingId(null) : openEditor(status))}
                >
                  ›
                </button>
              </div>
              {editing ? (
                <form
                  className="flex flex-col gap-2.5 border-t border-hairline bg-app px-4 py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveStatusEdit(status);
                  }}
                >
                  <div className="flex flex-col gap-1.25">
                    <FieldLabel htmlFor={`status-label-${status.id}`}>Label</FieldLabel>
                    <Input
                      id={`status-label-${status.id}`}
                      size="compact"
                      className="max-w-70"
                      value={editLabel}
                      onChange={(event) => setEditLabel(event.target.value)}
                    />
                  </div>
                  <Checkbox
                    label="Entry status for new tickets"
                    checked={editInitial}
                    onChange={(event) => setEditInitial(event.target.checked)}
                  />
                  <span className="font-mono text-label text-ink-3">
                    key {status.key} · kind {status.kind} 🔒 immutable
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="compact"
                      disabled={editLabel.trim().length === 0 || patchStatus.isPending}
                    >
                      Save
                    </Button>
                    <Button size="compact" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    {editError ? (
                      <span className="font-sans text-meta text-danger">{editError}</span>
                    ) : null}
                  </div>
                </form>
              ) : null}
            </div>
          );
        })}
        {addingStatus ? (
          <form
            className="flex flex-col gap-2.5 border-t border-hairline bg-app px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitNewStatus();
            }}
          >
            <div className="flex flex-col gap-1.25">
              <FieldLabel htmlFor="new-status-label">Label</FieldLabel>
              <div className="flex items-center gap-2.5">
                <Input
                  id="new-status-label"
                  size="compact"
                  className="max-w-70"
                  placeholder="e.g. In review"
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                />
                {newLabel.trim().length > 0 ? (
                  <span className="font-mono text-label text-ink-3">key: {slugify(newLabel)}</span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-1.25">
              <FieldLabel>Kind</FieldLabel>
              <div className="flex flex-wrap items-center gap-1.5">
                {KIND_ORDER.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={newKind === kind}
                    onClick={() => setNewKind(kind)}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-[6px] border px-2 font-sans text-[12px] font-medium',
                      newKind === kind
                        ? 'border-accent bg-accent-subtle text-ink'
                        : 'border-control bg-raised text-ink-2 hover:border-ink-3',
                    )}
                  >
                    <span className={cn('inline-flex', kindText[kind])}>
                      <KindGlyph kind={kind} />
                    </span>
                    {kind}
                  </button>
                ))}
              </div>
            </div>
            <Checkbox
              label="Entry status for new tickets"
              checked={newInitial}
              onChange={(event) => setNewInitial(event.target.checked)}
            />
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                size="compact"
                disabled={slugify(newLabel).length === 0 || createStatus.isPending}
              >
                Add status
              </Button>
              <Button size="compact" onClick={() => setAddingStatus(false)}>
                Cancel
              </Button>
              {statusError ? (
                <span className="font-sans text-meta text-danger">{statusError}</span>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      {/* transitions — the workflow graph as from → to rows */}
      <div className="overflow-hidden rounded-panel border border-hairline bg-raised">
        <div className="flex items-center gap-2.25 border-b border-hairline bg-app px-4 py-2.75">
          <span className="font-sans text-[14px] font-semibold text-ink">Transitions</span>
          <span className="font-mono text-label text-ink-3">
            dashed entry edges mark valid starting statuses
          </span>
        </div>
        {transitionCount === 0 ? (
          <div className="relative flex flex-col items-center justify-center gap-2.5 overflow-hidden bg-transparent px-6 py-12">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-control)_1px,transparent_1px)] bg-[length:22px_22px] opacity-25"
            />
            <span className="relative inline-flex h-10 items-center rounded-[11px] border-[1.5px] border-dashed border-control bg-transparent px-4 font-sans text-ui font-medium text-ink-3">
              any status ⇄ any status
            </span>
            <span className="relative font-sans text-[15px] font-semibold text-ink">
              No transitions defined — everything is allowed
            </span>
            <p className="relative m-0 max-w-90 text-center font-sans text-meta text-ink-2">
              Tickets can move between any two statuses. Add the first edge to start constraining
              moves.
            </p>
            <Button
              variant="primary"
              size="compact"
              className="relative"
              onClick={() => composerRef.current?.querySelector('button')?.focus()}
            >
              ＋ First transition
            </Button>
          </div>
        ) : (
          board.transitions.map((transition) => {
            const from = indexes.statusById.get(transition.fromStatusId);
            const to = indexes.statusById.get(transition.toStatusId);
            const scope =
              transition.ticketTypeId === null
                ? null
                : indexes.typeById.get(transition.ticketTypeId);
            return (
              <div
                key={transition.id}
                className="flex h-10.5 items-center gap-2.5 border-b border-hairline bg-transparent px-4 last:border-b-0"
              >
                {from ? <StatusBadge kind={from.kind} label={from.label} /> : <EntryPill />}
                <span aria-hidden className="shrink-0 font-sans text-ui text-ink-3">
                  →
                </span>
                {to ? (
                  <StatusBadge kind={to.kind} label={to.label} />
                ) : (
                  <span className="font-mono text-meta text-ink-3">#{transition.toStatusId}</span>
                )}
                {scope ? (
                  <TypeBadge label={scope.label} />
                ) : (
                  <span className="font-mono text-label text-ink-3">all types</span>
                )}
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={`Remove transition ${transitionLabel(transition)}`}
                  title="Remove transition"
                  disabled={deleteTransition.isPending}
                  className="shrink-0 px-1 font-sans text-ui text-ink-3 hover:text-danger disabled:opacity-50"
                  onClick={() => setPendingDelete(transition)}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
        <form
          ref={composerRef}
          className="flex flex-wrap items-center gap-1.5 border-t border-hairline bg-app px-4 py-2.75"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTransition();
          }}
        >
          <Combobox
            size="compact"
            className="w-42"
            placeholder="From status"
            options={fromOptions}
            value={fromDraft}
            onChange={setFromDraft}
          />
          <span aria-hidden className="font-sans text-ui text-ink-3">
            →
          </span>
          <Combobox
            size="compact"
            className="w-42"
            placeholder="To status"
            options={statusOptions}
            value={toDraft}
            onChange={setToDraft}
          />
          <Combobox
            size="compact"
            className="w-36"
            placeholder="All types"
            options={typeOptions}
            value={typeDraft}
            onChange={setTypeDraft}
            clearable
          />
          <Button
            type="submit"
            size="compact"
            disabled={fromDraft === null || toDraft === null || createTransition.isPending}
          >
            Add
          </Button>
          {transitionError ? (
            <span className="font-sans text-meta text-danger">{transitionError}</span>
          ) : null}
          <span className="ml-auto font-mono text-label text-ink-3">
            empty scope = every type may use this move
          </span>
        </form>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        title="Remove transition?"
        body={
          pendingDelete
            ? `${transitionLabel(pendingDelete)} will no longer be a legal move.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (pendingDelete) {
            deleteTransition.mutate(pendingDelete.id);
          }
        }}
      />
    </section>
  );
}
