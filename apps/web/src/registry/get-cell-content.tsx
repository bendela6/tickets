import type { ReactNode } from 'react';
import type { Field } from '../api/types';
import { OptionChip } from '../ui/option-chip';
import { formatExact } from '../ui/relative-date';
import { StatusBadge } from '../ui/status-badge';
import type { BoardIndexes } from '../utils/index-board';
import { hexToOptionColor } from './option-color';

const empty = <span className="text-ink-3">—</span>;

function formatDateTime(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatExact(raw)} ${hours}:${minutes}`;
}

// Compact table-cell rendering for one field value. Base renderer comes from
// the storage type; fields.config refines it; option configs carry the
// colors (as hex, mapped onto the Instrument palette), except the workflow
// field (config.workflow===true) whose color/glyph come from Option.kind via
// StatusBadge. typeId narrows options to the item's type (per-type allowlist).
// The drawer's editable counterpart is FieldWidget.
export function getCellContent(
  field: Field,
  rawValue: unknown,
  indexes: BoardIndexes,
  typeId: number,
): ReactNode {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return empty;
  }
  if (field.type === 'option') {
    const values = field.config.multiple === true ? (rawValue as unknown[]) : [rawValue];
    if (field.config.workflow === true) {
      const value = values[0];
      const option = typeof value === 'string' ? indexes.optionByValue(field, value) : undefined;
      if (!option || option.kind === null) {
        return <OptionChip label={String(value)} color="gray" />;
      }
      return <StatusBadge kind={option.kind} label={option.label} />;
    }
    const options = indexes.optionsForField(typeId, field);
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
  if (field.type === 'user') {
    if (typeof rawValue === 'number') {
      const user = indexes.userById.get(rawValue);
      return user ? user.name : `#${rawValue}`;
    }
    if (typeof rawValue === 'object' && 'name' in (rawValue as Record<string, unknown>)) {
      return String((rawValue as { name: unknown }).name);
    }
    return String(rawValue);
  }
  if (field.type === 'boolean') {
    return rawValue === true ? <span className="text-kind-done">✓</span> : empty;
  }
  if (field.type === 'date') {
    const date = new Date(String(rawValue));
    return Number.isNaN(date.getTime()) ? String(rawValue) : formatExact(String(rawValue));
  }
  if (field.type === 'datetime') {
    return formatDateTime(String(rawValue));
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
