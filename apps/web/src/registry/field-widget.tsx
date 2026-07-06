import { useState } from 'react';
import type { Board, BoardTicket, Field } from '../api/types';
import { MarkdownEditor } from '../components/markdown-editor';
import { Checkbox } from '../ui/checkbox';
import { Combobox } from '../ui/combobox';
import type { ComboOption } from '../ui/combobox-list';
import { DatePicker } from '../ui/date-picker';
import { Input } from '../ui/input';
import { MultiCombobox } from '../ui/multi-combobox';
import { NumberInput } from '../ui/number-input';
import { StatusSelect } from '../ui/status-select';
import { Textarea } from '../ui/textarea';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';
import { hexToOptionColor } from './option-color';

function toComboOptions(field: Field, indexes: BoardIndexes): ComboOption[] {
  const options = indexes.optionsByFieldId.get(field.id) ?? [];
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    color: hexToOptionColor(option.config.color),
  }));
}

// The editable counterpart of getCellContent: one widget per storage type,
// refined by fields.config.widget. Controlled: (value, onChange).
export function FieldWidget({
  field,
  value,
  disabled,
  board,
  indexes,
  ticket,
  onChange,
}: {
  field: Field;
  value: unknown;
  disabled?: boolean;
  board: Board;
  indexes: BoardIndexes;
  ticket: BoardTicket | null;
  onChange: (next: unknown) => void;
}) {
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  // undefined = not editing; commit number edits when focus leaves the control
  // so stepper clicks and typing don't fire one PATCH per keystroke.
  const [numberDraft, setNumberDraft] = useState<number | null | undefined>(undefined);

  if (field.type === 'text' && field.config.widget === 'markdown') {
    return (
      <MarkdownEditor
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onSave={(next) => onChange(next.length > 0 ? next : null)}
      />
    );
  }
  if (field.type === 'text') {
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
    const shown = numberDraft !== undefined ? numberDraft : typeof value === 'number' ? value : null;
    return (
      <span
        className="inline-flex"
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) {
            return; // focus moved within the control (input ↔ steppers)
          }
          if (numberDraft !== undefined && numberDraft !== (typeof value === 'number' ? value : null)) {
            onChange(numberDraft);
          }
          setNumberDraft(undefined);
        }}
      >
        <NumberInput value={shown} onChange={setNumberDraft} disabled={disabled} />
      </span>
    );
  }
  if (field.type === 'date') {
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
  if (field.type === 'select') {
    return (
      <Combobox
        options={toComboOptions(field, indexes)}
        value={typeof value === 'string' ? value : null}
        disabled={disabled}
        clearable
        placeholder="—"
        onChange={(next) => onChange(next)}
      />
    );
  }
  if (field.type === 'multi_select') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <MultiCombobox
        options={toComboOptions(field, indexes)}
        value={selected}
        disabled={disabled}
        placeholder="—"
        onChange={(next) => onChange(next.length > 0 ? next : null)}
      />
    );
  }
  if (field.type === 'status') {
    const targets = legalStatusTargets(board, indexes, ticket);
    const active = [...board.statuses]
      .filter((status) => !status.archivedAt)
      .sort((left, right) => left.position - right.position);
    return (
      <StatusSelect
        statuses={active.map((status) => ({
          key: status.key,
          label: status.label,
          kind: status.kind,
        }))}
        legalTargets={targets.map((status) => status.key)}
        value={typeof value === 'string' ? value : null}
        disabled={disabled}
        onChange={(next) => onChange(next)}
      />
    );
  }
  return null;
}
