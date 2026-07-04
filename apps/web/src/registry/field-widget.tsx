import { useState } from 'react';
import type { Board, BoardTicket, Field } from '../api/types';
import { MarkdownEditor } from '../components/markdown-editor';
import type { BoardIndexes } from '../utils/index-board';
import { legalStatusTargets } from '../utils/legal-status-targets';

const inputStyle = {
  font: 'inherit',
  fontSize: 13,
  color: 'var(--ink)',
  background: 'var(--page)',
  border: '1px solid var(--ring)',
  borderRadius: 8,
  padding: '6px 10px',
  width: '100%',
} as const;

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
      <input
        style={inputStyle}
        defaultValue={typeof value === 'string' ? value : ''}
        disabled={disabled}
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
    return (
      <input
        type="number"
        style={inputStyle}
        defaultValue={typeof value === 'number' ? value : ''}
        disabled={disabled}
        onBlur={(event) => {
          const raw = event.target.value;
          const next = raw === '' ? null : Number(raw);
          if (next !== value) {
            onChange(next);
          }
        }}
      />
    );
  }
  if (field.type === 'date') {
    const current = typeof value === 'string' ? value.slice(0, 10) : '';
    return (
      <input
        type="date"
        style={inputStyle}
        defaultValue={current}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          const next = raw === '' ? null : `${raw}T00:00:00Z`;
          if (raw !== current) {
            onChange(next);
          }
        }}
      />
    );
  }
  if (field.type === 'boolean') {
    return (
      <input
        type="checkbox"
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
      <textarea
        rows={4}
        style={{ ...inputStyle, borderColor: invalid ? 'var(--critical)' : 'var(--ring)' }}
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
    const options = indexes.optionsByFieldId.get(field.id) ?? [];
    return (
      <select
        style={inputStyle}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'multi_select') {
    const options = indexes.optionsByFieldId.get(field.id) ?? [];
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {options.map((option) => (
          <label
            key={option.id}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, option.value]
                  : selected.filter((entry) => entry !== option.value);
                onChange(next.length > 0 ? next : null);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'status') {
    const targets = legalStatusTargets(board, indexes, ticket);
    return (
      <select
        style={inputStyle}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {targets.map((status) => (
          <option key={status.id} value={status.key} title={status.config.description}>
            {status.label}
          </option>
        ))}
      </select>
    );
  }
  return null;
}
