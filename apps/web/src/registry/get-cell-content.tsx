import type { ReactNode } from 'react';
import type { Field } from '../api/types';
import { OptionChip } from '../ui/option-chip';
import { formatExact } from '../ui/relative-date';
import { StatusBadge } from '../ui/status-badge';
import type { BoardIndexes } from '../utils/index-board';
import { hexToOptionColor } from './option-color';

const empty = <span className="text-ink-3">—</span>;

// Compact table-cell rendering for one field value. Base renderer comes from
// the storage type; fields.config refines it; option/status configs carry the
// colors (as hex, mapped onto the Instrument palette). The drawer's editable
// counterpart is FieldWidget.
export function getCellContent(field: Field, rawValue: unknown, indexes: BoardIndexes): ReactNode {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return empty;
  }
  if (field.type === 'select' || field.type === 'multi_select') {
    const options = indexes.optionsByFieldId.get(field.id) ?? [];
    const values = field.type === 'select' ? [rawValue] : (rawValue as unknown[]);
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {values.map((value, index) => {
          const option = options.find((candidate) => candidate.value === value);
          return (
            <OptionChip
              key={index}
              label={option?.label ?? String(value)}
              color={hexToOptionColor(option?.config.color)}
            />
          );
        })}
      </span>
    );
  }
  if (field.type === 'status') {
    const status = typeof rawValue === 'string' ? indexes.statusByKey.get(rawValue) : undefined;
    if (!status) {
      return <OptionChip label={String(rawValue)} color="gray" />;
    }
    return <StatusBadge kind={status.kind} label={status.label} />;
  }
  if (field.type === 'boolean') {
    return rawValue === true ? <span className="text-kind-done">✓</span> : empty;
  }
  if (field.type === 'date') {
    const date = new Date(String(rawValue));
    return Number.isNaN(date.getTime()) ? String(rawValue) : formatExact(String(rawValue));
  }
  if (field.type === 'number') {
    return <span className="tabular-nums">{String(rawValue)}</span>;
  }
  if (field.type === 'json') {
    const text = JSON.stringify(rawValue);
    return (
      <code className="font-mono text-meta text-ink-2">
        {text.length > 40 ? `${text.slice(0, 40)}…` : text}
      </code>
    );
  }
  const text = String(rawValue);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}
