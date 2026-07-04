import type { ReactNode } from 'react';
import type { Field } from '../api/types';
import { ValueBadge } from '../components/value-badge';
import type { BoardIndexes } from '../utils/index-board';

const empty = <span className="no-progress">—</span>;

// Compact table-cell rendering for one field value. Base renderer comes from
// the storage type; fields.config refines it; option/status configs carry the
// colors. The drawer's editable counterpart is FieldWidget.
export function getCellContent(field: Field, rawValue: unknown, indexes: BoardIndexes): ReactNode {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return empty;
  }
  if (field.type === 'select' || field.type === 'multi_select') {
    const options = indexes.optionsByFieldId.get(field.id) ?? [];
    const values = field.type === 'select' ? [rawValue] : (rawValue as unknown[]);
    return (
      <>
        {values.map((value, index) => {
          const option = options.find((candidate) => candidate.value === value);
          return (
            <ValueBadge
              key={index}
              label={option?.label ?? String(value)}
              color={option?.config.color}
            />
          );
        })}
      </>
    );
  }
  if (field.type === 'status') {
    const status = typeof rawValue === 'string' ? indexes.statusByKey.get(rawValue) : undefined;
    if (!status) {
      return <ValueBadge label={String(rawValue)} />;
    }
    const mark =
      status.kind === 'done' ? 'done' : status.kind === 'dropped' ? 'dropped' : undefined;
    return <ValueBadge label={status.label} color={status.config.color} mark={mark} />;
  }
  if (field.type === 'boolean') {
    return rawValue === true ? '✓' : empty;
  }
  if (field.type === 'date') {
    const date = new Date(String(rawValue));
    return Number.isNaN(date.getTime()) ? String(rawValue) : date.toLocaleDateString();
  }
  if (field.type === 'number') {
    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{String(rawValue)}</span>;
  }
  if (field.type === 'json') {
    const text = JSON.stringify(rawValue);
    return <code>{text.length > 40 ? `${text.slice(0, 40)}…` : text}</code>;
  }
  const text = String(rawValue);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}
