import { toasted } from '../../api/mutation-meta';
import { useState } from 'react';
import type { Option, StatusKind, Transition } from '../../api/types';
import {
  useCreateOption,
  useCreateTransition,
  useDeleteTransition,
  useUpdateOption,
  useUpdatePlacement,
} from '../../api/use-admin';
import { KIND_ICON, KIND_TONE, statusPill } from '../../domain/status';
import { DEFAULT_OPTION_COLOR } from '../../registry/option-color';
import { useCurrentUser } from '../../state/current-user-context';
import { ArchChip } from '../arch-chip';
import { slugify } from '../../utils/slugify';
import {
  Button,
  Card,
  Checkbox,
  cn,
  ColorPicker,
  Combobox,
  type Option as ComboOption,
  Dot,
  FieldLabel,
  HUES,
  Icon,
  Input,
  Pill,
  ScreenState,
  SegmentedControl,
  Tabs,
} from '@bh/ui';
import type { SettingsTabProps } from './types-tab';

const KIND_ORDER: StatusKind[] = ['todo', 'active', 'blocked', 'done', 'dropped'];

// Combobox value for "starts here" — fromOptionId: null on the wire, meaning
// this edge is a creation/entry move rather than a move between two options.
const ENTRY = '__entry__';

// Dashed pill marking the null-from "entry" edge — the move that happens
// when an item is created directly into a status, mirrors the design's
// workflow canvas treatment for the start of the graph.
function EntryPill() {
  return (
    <Pill
      tone="green"
      variant="outline"
      shape="round"
      label="entry"
      className="border-dashed font-mono"
    />
  );
}

// One of the five kinds, as bh's segmented control: a choice of one among a
// few short words, read without opening anything.
function KindPicker({
  value,
  onChange,
}: {
  value: StatusKind;
  onChange: (kind: StatusKind) => void;
}) {
  return (
    <SegmentedControl
      label="Kind"
      size="xs"
      className="self-start"
      options={KIND_ORDER.map((kind) => ({
        value: kind,
        label: kind.charAt(0).toUpperCase() + kind.slice(1),
        icon: KIND_ICON[kind],
      }))}
      value={value}
      onChange={(next) => onChange(KIND_ORDER.find((kind) => kind === next) ?? value)}
    />
  );
}

type OptionDraft = { label: string; kind: StatusKind; color: string };

function OptionForm({
  idPrefix,
  draft,
  onChange,
  onCancel,
  onSubmit,
  submitLabel,
  pending,
  valueHint,
}: {
  idPrefix: string;
  draft: OptionDraft;
  onChange: (draft: OptionDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  valueHint?: string;
}) {
  const labelId = `${idPrefix}-label`;
  const colorId = `${idPrefix}-color`;
  return (
    <div className="flex flex-col gap-10 border-t-1 border-gray-6 bg-gray-1 px-16 py-12">
      <div className="flex flex-col gap-5">
        <FieldLabel htmlFor={labelId}>Label</FieldLabel>
        <div className="flex items-center gap-10">
          <Input
            id={labelId}
            size="xs"
            className="max-w-280"
            placeholder="e.g. In review"
            value={draft.label}
            onChange={(next) => onChange({ ...draft, label: next })}
          />
          {valueHint ? <span className="font-mono text-11/13 tracking-wider text-gray-9">{valueHint}</span> : null}
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <FieldLabel>Kind</FieldLabel>
        <KindPicker value={draft.kind} onChange={(kind) => onChange({ ...draft, kind })} />
      </div>
      <div className="flex flex-col gap-5">
        <FieldLabel htmlFor={colorId}>Colour</FieldLabel>
        <ColorPicker
          id={colorId}
          size="xs"
          className="max-w-280"
          value={draft.color}
          onChange={(next) => onChange({ ...draft, color: HUES.find((hue) => hue === next) ?? draft.color })}
        />
      </div>
      <div className="flex items-center gap-8">
        <Button
          variant="solid"
          size="sm"
          disabled={draft.label.trim() === ''}
          loading={pending}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Workflow tab per the task-12 prototype: pick a type, then manage its
// statuses (the workflow field's options it takes) and the transition graph
// scoped to that type. Layout follows the read-only reference at
// `git show dab1e97:.../workflow-settings.tsx`, rebuilt against the new
// model where a "status" is an option (kind != null) on a shared option set
// and a transition references options directly instead of a status table.
export function WorkflowTab({ board, indexes, projectKey }: SettingsTabProps) {
  const { userId } = useCurrentUser();
  const disabled = userId === null;
  const createOption = useCreateOption();
  const updateOption = useUpdateOption();
  const updatePlacement = useUpdatePlacement();
  const createTransition = useCreateTransition();
  const deleteTransition = useDeleteTransition();

  const activeTypes = [...board.types]
    .filter((type) => !type.archivedAt)
    .sort((left, right) => left.position - right.position);

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const activeTypeId = selectedTypeId ?? activeTypes[0]?.id ?? null;

  const workflowField = activeTypeId !== null ? indexes.workflowField(activeTypeId) : undefined;

  // A type may take only some of the field's shared options: its placement's
  // allowlist (absent = it takes them all), as indexes.optionsForField reads it.
  const allowedOptionIds =
    workflowField !== undefined && activeTypeId !== null
      ? indexes.placement(activeTypeId, workflowField.id)?.configOverride?.allowedOptionIds
      : undefined;

  // The type's own statuses in option order, INCLUDING archived ones —
  // indexes.optionsForField drops archived rows, but this panel needs to
  // show/restore them, so read straight off board.options (the source of
  // truth) instead.
  const options: Option[] =
    workflowField?.optionSetId != null
      ? [...board.options]
          .filter(
            (option) =>
              option.optionSetId === workflowField.optionSetId &&
              (allowedOptionIds === undefined || allowedOptionIds.includes(option.id)),
          )
          .sort((left, right) => left.position - right.position)
      : [];
  const activeOptions = options.filter((option) => !option.archivedAt);
  const archivedCount = options.length - activeOptions.length;

  // Edges applicable to the selected type: scoped directly to it, or scoped
  // to "all types" (itemTypeId === null) — mirrors the server's resolution.
  const transitions: Transition[] = workflowField
    ? board.transitions.filter(
        (t) => t.fieldId === workflowField.id && (t.itemTypeId === null || t.itemTypeId === activeTypeId),
      )
    : [];

  // ----- options -----
  const [addingOption, setAddingOption] = useState(false);
  const [newOption, setNewOption] = useState<OptionDraft>({ label: '', kind: 'todo', color: DEFAULT_OPTION_COLOR });

  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editOption, setEditOption] = useState<OptionDraft>({ label: '', kind: 'todo', color: DEFAULT_OPTION_COLOR });

  function startCreateOption() {
    if (disabled) return;
    setEditingOptionId(null);
    setNewOption({ label: '', kind: 'todo', color: DEFAULT_OPTION_COLOR });
    setAddingOption(true);
  }

  async function submitCreateOption() {
    if (disabled || userId === null || workflowField === undefined || activeTypeId === null) return;
    const label = newOption.label.trim();
    const value = slugify(label);
    if (label === '' || value === '') return;
    const created = await createOption.mutateAsync({
      actorId: userId,
      fieldId: workflowField.id,
      value,
      label,
      kind: newOption.kind,
      config: { color: newOption.color },
    });
    // The option joins the field's shared set; a type that takes only some of
    // it would not list it, so it joins this type's allowlist too.
    if (allowedOptionIds !== undefined) {
      await updatePlacement.mutateAsync({
        actorId: userId,
        itemTypeId: activeTypeId,
        fieldId: workflowField.id,
        allowedOptionIds: [...allowedOptionIds, created.id],
      });
    }
    setAddingOption(false);
  }

  function startEditOption(option: Option) {
    if (disabled) return;
    setAddingOption(false);
    setEditOption({
      label: option.label,
      kind: (option.kind ?? 'todo') as StatusKind,
      color: option.config.color ?? DEFAULT_OPTION_COLOR,
    });
    setEditingOptionId(option.id);
  }

  async function submitEditOption(option: Option) {
    if (disabled || userId === null) return;
    const label = editOption.label.trim();
    if (label === '') return;
    // option.update REPLACES config wholesale — spread the option's current
    // config so unrelated keys (e.g. icon) survive a label/kind/colour edit.
    await updateOption.mutateAsync({
      actorId: userId,
      id: option.id,
      label,
      kind: editOption.kind,
      config: { ...option.config, color: editOption.color },
    });
    setEditingOptionId(null);
  }

  async function toggleArchiveOption(option: Option) {
    if (disabled || userId === null) return;
    await updateOption.mutateAsync({ actorId: userId, id: option.id, archived: !option.archivedAt });
  }

  // ----- transitions -----
  const toOptions: ComboOption[] = activeOptions.map((option) => ({
    value: String(option.id),
    label: option.label,
    color: option.config.color ?? 'gray',
  }));
  const fromOptions: ComboOption[] = [{ value: ENTRY, label: 'Entry — new item' }, ...toOptions];

  // Guard picker offers the selected type's placed fields, keyed by field
  // KEY (not id) — the server matches guard.requiresField against the
  // field's key (see runTransitionGuard's fieldByTypeKey lookup).
  const guardFieldOptions: ComboOption[] = (
    activeTypeId !== null ? (indexes.placementsByType.get(activeTypeId) ?? []) : []
  )
    .map((placement) => indexes.fieldById.get(placement.fieldId))
    .filter((field): field is NonNullable<typeof field> => field !== undefined && field.archivedAt === null)
    .map((field) => ({ value: field.key, label: field.label }));

  const [edgeFrom, setEdgeFrom] = useState<string | null>(null);
  const [edgeTo, setEdgeTo] = useState<string | null>(null);
  const [edgeRequiresComment, setEdgeRequiresComment] = useState(false);
  const [edgeRequiresField, setEdgeRequiresField] = useState<string | null>(null);

  function transitionLabel(t: Transition): string {
    const from = t.fromOptionId !== null ? indexes.optionById.get(t.fromOptionId) : undefined;
    const to = indexes.optionById.get(t.toOptionId);
    return `${from?.label ?? 'entry'} → ${to?.label ?? `#${t.toOptionId}`}`;
  }

  async function submitEdge() {
    if (disabled || userId === null || workflowField === undefined || activeTypeId === null) return;
    if (edgeFrom === null || edgeTo === null) return;
    // Only send `config` when a guard input was actually set — an empty
    // `{}`/`{guard:{}}` would still be a truthy config on the server.
    const guard: { requiresComment?: boolean; requiresField?: string } = {};
    if (edgeRequiresComment) guard.requiresComment = true;
    if (edgeRequiresField !== null) guard.requiresField = edgeRequiresField;
    const hasGuard = Object.keys(guard).length > 0;
    await createTransition.mutateAsync({
      actorId: userId,
      fieldId: workflowField.id,
      fromOptionId: edgeFrom === ENTRY ? null : Number(edgeFrom),
      toOptionId: Number(edgeTo),
      itemTypeId: activeTypeId,
      ...(hasGuard ? { config: { guard } } : {}),
    });
    setEdgeFrom(null);
    setEdgeTo(null);
    setEdgeRequiresComment(false);
    setEdgeRequiresField(null);
  }

  async function removeEdge(t: Transition) {
    if (disabled || userId === null) return;
    await deleteTransition.mutateAsync({ actorId: userId, id: t.id });
  }

  return (
    <section className="flex min-h-0 flex-col">
      <div className="mb-6 flex items-center gap-12">
        <h2 className="m-0 font-sans text-20 font-600 text-gray-12">Workflow</h2>
        <span className="font-mono text-12/17 text-gray-9">{projectKey}</span>
      </div>
      <p className="mb-16 mt-0 font-sans text-12/17 text-gray-9">
        Pick a type, then manage its workflow statuses and the moves allowed between them.
      </p>

      {activeTypes.length === 0 ? (
        <ScreenState className="px-12 py-20" title="No ticket types yet." body="Create one on the Types tab first." />
      ) : (
        <>
          <Tabs
            variant="pill"
            className="mb-16 flex-wrap"
            items={activeTypes.map((type) => ({ value: String(type.id), label: type.label }))}
            value={String(activeTypeId)}
            onChange={(next) => setSelectedTypeId(Number(next))}
            label="Type"
          />

          {workflowField === undefined ? (
            <p className="m-0 font-sans text-12/17 text-gray-9">
              No workflow field is placed on this type — place a field with a workflow status set on the
              Fields tab first.
            </p>
          ) : (
            <>
              {/* options — the statuses this type takes from its workflow field */}
              <Card role="region" aria-label="Options" className="mb-16">
                <div className="flex items-center gap-9 border-b-1 border-gray-6 bg-gray-1 px-16 py-11">
                  <span className="font-sans text-14 font-600 text-gray-12">Options</span>
                  <span className="font-mono text-11/13 tracking-wider text-gray-9">
                    {options.length} option{options.length === 1 ? '' : 's'}
                    {archivedCount > 0 ? ` · ${archivedCount} archived` : ''}
                  </span>
                  <span className="flex-1" />
                  <Button size="sm" disabled={disabled} onClick={startCreateOption}>
                    + Add option
                  </Button>
                </div>
                {options.length === 0 ? (
                  <ScreenState className="px-12 py-20" title="No options yet on this workflow field." />
                ) : (
                  options.map((option) => {
                    const archived = option.archivedAt !== null;
                    const editing = editingOptionId === option.id;
                    const kind = (option.kind ?? 'todo') as StatusKind;
                    return (
                      <div key={option.id} className="border-b-1 border-gray-6 last:border-b-0">
                        <div className={cn('flex h-42 items-center gap-10 px-16', archived && 'opacity-60')}>
                          <span className="inline-flex shrink-0">
                            <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size="xs" />
                          </span>
                          <span
                            className={cn('font-sans text-13/19 font-500 text-gray-12', archived && 'line-through')}
                          >
                            {option.label}
                          </span>
                          <span className="font-mono text-12/17 text-gray-9">{option.value}</span>
                          <Pill {...statusPill(kind)} label={kind} />
                          {option.config.color ? <Dot color={`var(--color-${option.config.color}-9)`} /> : null}
                          {archived ? <ArchChip /> : null}
                          <span className="flex-1" />
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={disabled || archived}
                            aria-label={`Edit ${option.label}`}
                            onClick={() => (editing ? setEditingOptionId(null) : startEditOption(option))}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={disabled}
                            aria-label={`${archived ? 'Restore' : 'Archive'} ${option.label}`}
                            onClick={() => void toggleArchiveOption(option).catch(toasted)}
                          >
                            {archived ? 'Restore' : 'Archive'}
                          </Button>
                        </div>
                        {editing ? (
                          <OptionForm
                            idPrefix={`edit-option-${option.id}`}
                            draft={editOption}
                            onChange={setEditOption}
                            onCancel={() => setEditingOptionId(null)}
                            onSubmit={() => void submitEditOption(option).catch(toasted)}
                            submitLabel="Save"
                            pending={updateOption.isPending}
                            valueHint={`value ${option.value} 🔒 immutable`}
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}
                {addingOption ? (
                  <OptionForm
                    idPrefix="new-option"
                    draft={newOption}
                    onChange={setNewOption}
                    onCancel={() => setAddingOption(false)}
                    onSubmit={() => void submitCreateOption().catch(toasted)}
                    submitLabel="Create option"
                    pending={createOption.isPending || updatePlacement.isPending}
                    valueHint={newOption.label.trim() ? `value: ${slugify(newOption.label)}` : undefined}
                  />
                ) : null}
              </Card>

              {/* transitions — the graph of allowed moves for this type */}
              <Card>
                <div className="flex items-center gap-9 border-b-1 border-gray-6 bg-gray-1 px-16 py-11">
                  <span className="font-sans text-14 font-600 text-gray-12">Transitions</span>
                  <span className="font-mono text-11/13 tracking-wider text-gray-9">
                    {transitions.length} edge{transitions.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div role="region" aria-label="Transitions">
                  {transitions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-6 px-24 py-32 text-center">
                      <span className="font-sans text-15 font-600 text-gray-12">
                        No edges defined — any move is allowed
                      </span>
                      <p className="m-0 max-w-360 font-sans text-12/17 text-gray-11">
                        Items using this type can move between any two options. Add the first edge to start
                        constraining moves.
                      </p>
                    </div>
                  ) : (
                    transitions.map((t) => {
                      const from = t.fromOptionId !== null ? indexes.optionById.get(t.fromOptionId) : undefined;
                      const to = indexes.optionById.get(t.toOptionId);
                      return (
                        <div
                          key={t.id}
                          className="flex h-42 items-center gap-10 border-b-1 border-gray-6 px-16 last:border-b-0"
                        >
                          {from ? (
                            <Pill {...statusPill((from.kind ?? 'todo') as StatusKind)} label={from.label} />
                          ) : (
                            <EntryPill />
                          )}
                          <span aria-hidden className="shrink-0 font-sans text-13/19 text-gray-9">
                            →
                          </span>
                          {to ? (
                            <Pill {...statusPill((to.kind ?? 'todo') as StatusKind)} label={to.label} />
                          ) : (
                            <span className="font-mono text-12/17 text-gray-9">#{t.toOptionId}</span>
                          )}
                          {t.itemTypeId === null ? (
                            <span className="font-mono text-11/13 tracking-wider text-gray-9">all types</span>
                          ) : null}
                          {t.config?.guard?.requiresComment ? (
                            <span className="font-mono text-11/13 tracking-wider text-gray-9">requires comment</span>
                          ) : null}
                          {t.config?.guard?.requiresField ? (
                            <span className="font-mono text-11/13 tracking-wider text-gray-9">
                              requires{' '}
                              {indexes.fieldByKey.get(t.config.guard.requiresField)?.label ??
                                t.config.guard.requiresField}
                            </span>
                          ) : null}
                          <span className="flex-1" />
                          <Button
                            variant="ghost"
                            tone="neutral"
                            size="xs"
                            icon="x"
                            label="Remove transition"
                            aria-label={`Remove transition ${transitionLabel(t)}`}
                            disabled={disabled || deleteTransition.isPending}
                            className="text-gray-9 hover:text-red-11"
                            onClick={() => void removeEdge(t).catch(toasted)}
                          />
                        </div>
                      );
                    })
                  )}
                  <form
                    className="flex flex-wrap items-center gap-6 border-t-1 border-gray-6 bg-gray-1 px-16 py-11"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitEdge().catch(toasted);
                    }}
                  >
                    <Combobox
                      size="xs"
                      className="w-176"
                      placeholder="From option"
                      options={fromOptions}
                      value={edgeFrom}
                      onChange={setEdgeFrom}
                      disabled={disabled}
                    />
                    <span aria-hidden className="font-sans text-13/19 text-gray-9">
                      →
                    </span>
                    <Combobox
                      size="xs"
                      className="w-176"
                      placeholder="To option"
                      options={toOptions}
                      value={edgeTo}
                      onChange={setEdgeTo}
                      disabled={disabled}
                    />
                    <Checkbox
                      label="Requires a comment"
                      description="The item needs a comment before it can make this move."
                      value={edgeRequiresComment}
                      onChange={(next) => setEdgeRequiresComment(next)}
                      disabled={disabled}
                    />
                    <Combobox
                      size="xs"
                      className="w-176"
                      placeholder="Requires field"
                      options={guardFieldOptions}
                      value={edgeRequiresField}
                      onChange={setEdgeRequiresField}
                      disabled={disabled}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={disabled || edgeFrom === null || edgeTo === null || createTransition.isPending}
                    >
                      Add edge
                    </Button>
                    <span className="ml-auto font-mono text-11/13 tracking-wider text-gray-9">
                      empty set = every move allowed
                    </span>
                  </form>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </section>
  );
}
