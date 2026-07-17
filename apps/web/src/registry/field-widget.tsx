import { useState } from 'react';
import type { Board, Field, Item } from '../api/types';
import { MarkdownEditor } from '../components/markdown-editor';
import { Checkbox } from '../ui/checkbox';
import { Combobox } from '../ui/combobox';
import type { ComboOption } from '../ui/combobox-list';
import { DatePicker } from '../ui/date-picker';
import { Input } from '../ui/input';
import { MultiCombobox } from '../ui/multi-combobox';
import { NumberInput } from '../ui/number-input';
import { Textarea } from '../ui/textarea';
import type { BoardIndexes } from '../utils/index-board';
import { hexToOptionColor, kindColor } from './option-color';

function toComboOptions(typeId: number, field: Field, indexes: BoardIndexes): ComboOption[] {
  const options = indexes.optionsForField(typeId, field);
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    color: field.config.workflow === true ? kindColor(option.kind) : hexToOptionColor(option.config.color),
  }));
}

// The editable counterpart of getCellContent: one widget per storage type,
// refined by fields.config.format/multiple. Controlled: (value, onChange).
// The workflow field (config.workflow===true) is just an option field here —
// its color source is kindColor instead of hexToOptionColor; the kind-grouped
// picker with legal-target narrowing (StatusSelect + legalStatusTargets)
// lives in the callers that own status transitions (drawer header, board
// status cell), not in this generic widget.
export function FieldWidget({
  field,
  value,
  disabled,
  board,
  indexes,
  ticket,
  typeId,
  onChange,
}: {
  field: Field;
  value: unknown;
  disabled?: boolean;
  board: Board;
  indexes: BoardIndexes;
  ticket: Item | null;
  typeId: number;
  onChange: (next: unknown) => void;
}) {
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  // undefined = not editing; commit number edits when focus leaves the control
  // so stepper clicks and typing don't fire one PATCH per keystroke.
  const [numberDraft, setNumberDraft] = useState<number | null | undefined>(undefined);
  void ticket; // reserved: transition-aware editing (legal targets) lives with the status control, not here

  if (field.type === 'string' && field.config.format === 'markdown') {
    return (
      <MarkdownEditor
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onSave={(next) => onChange(next.length > 0 ? next : null)}
      />
    );
  }
  if (field.type === 'string') {
    return (
      <Input
        defaultValue={typeof value === 'string' ? value : ''}
        disabled={disabled}
        aria-label={field.label}
        onBlur={(event) => {
          const next = event.target.value;
          if (next !== (value ?? '')) {
            onChange(next.length > 0 ? next : null);
          }
        }}
      />
    );
  }
  if (field.type === 'number') {
    const shown =
      numberDraft !== undefined ? numberDraft : typeof value === 'number' ? value : null;
    return (
      <span
        className="inline-flex"
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return; // focus moved within the control (input ↔ steppers)
          }
          if (
            numberDraft !== undefined &&
            numberDraft !== (typeof value === 'number' ? value : null)
          ) {
            onChange(numberDraft);
          }
          setNumberDraft(undefined);
        }}
      >
        <NumberInput value={shown} onChange={setNumberDraft} disabled={disabled} />
      </span>
    );
  }
  if (field.type === 'date' || field.type === 'datetime') {
    return (
      <DatePicker
        value={typeof value === 'string' ? value : null}
        disabled={disabled}
        onChange={(next) => {
          if (next !== value) {
            onChange(next);
          }
        }}
      />
    );
  }
  if (field.type === 'boolean') {
    return (
      <Checkbox
        label=""
        aria-label={field.label}
        checked={value === true}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }
  if (field.type === 'json') {
    const shown =
      jsonDraft ?? (value === null || value === undefined ? '' : JSON.stringify(value, null, 2));
    let invalid = false;
    if (jsonDraft !== null && jsonDraft.trim().length > 0) {
      try {
        JSON.parse(jsonDraft);
      } catch {
        invalid = true;
      }
    }
    return (
      <Textarea
        rows={4}
        invalid={invalid}
        className="font-mono text-meta"
        aria-label={field.label}
        value={shown}
        disabled={disabled}
        onChange={(event) => setJsonDraft(event.target.value)}
        onBlur={() => {
          if (jsonDraft === null) {
            return;
          }
          if (jsonDraft.trim().length === 0) {
            onChange(null);
            setJsonDraft(null);
            return;
          }
          try {
            onChange(JSON.parse(jsonDraft));
            setJsonDraft(null);
          } catch {
            // keep the invalid draft on screen until fixed
          }
        }}
      />
    );
  }
  if (field.type === 'option') {
    const options = toComboOptions(typeId, field, indexes);
    if (field.config.multiple === true) {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <MultiCombobox
          options={options}
          value={selected}
          disabled={disabled}
          placeholder="—"
          onChange={(next) => onChange(next.length > 0 ? next : null)}
        />
      );
    }
    return (
      <Combobox
        options={options}
        value={typeof value === 'string' ? value : null}
        disabled={disabled}
        clearable
        placeholder="—"
        onChange={(next) => onChange(next)}
      />
    );
  }
  if (field.type === 'user') {
    const users = board.users.filter((user) => !user.archivedAt);
    const options: ComboOption[] = users.map((user) => ({ value: String(user.id), label: user.name }));
    const currentId =
      typeof value === 'number'
        ? value
        : value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)
          ? Number((value as { id: number }).id)
          : null;
    return (
      <Combobox
        options={options}
        value={currentId === null ? null : String(currentId)}
        disabled={disabled}
        clearable
        placeholder="Unassigned"
        onChange={(next) => onChange(next === null ? null : Number(next))}
      />
    );
  }
  return null;
}
