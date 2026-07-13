// The type picker. Types are stored as strings ("varchar(255)"), so this cell is
// a codec around a <select>: it parses the incoming string, renders the base +
// its params, and emits a formatted string back. `custom…` keeps enums/domains
// (and any hand-written type) editable.

import { useEffect, useState } from 'react';

import { PG_TYPES, formatType, parseType, type PgTypeGroup } from '../../engine/model/pg-types';
import { cn } from '../../ui/cn';

const CUSTOM = '__custom__';
const GROUPS: PgTypeGroup[] = ['numeric', 'text', 'boolean', 'temporal', 'uuid', 'json', 'binary'];
const cell = cn('rounded border border-gray-600 bg-gray-900 px-1 py-1', 'font-mono text-xs text-gray-50');

export function TypeCell({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const parsed = parseType(value);
  // `parsed.custom` alone can't drive the custom-mode UI: picking "custom…"
  // for a currently-known type (e.g. "int") emits onChange('') — a value that,
  // in a real caller, doesn't reach this component as a new `value` prop until
  // the NEXT render (dispatch is async, and tests may spy on onChange without
  // ever feeding the result back in). Without this bit of local state, the
  // custom text input would never appear: `value` is still "int", which is a
  // known type, so parsed.custom stays false. It resyncs from the prop
  // whenever `value` actually changes (row reorder, external update, mount).
  const [customMode, setCustomMode] = useState(parsed.custom);
  useEffect(() => setCustomMode(parsed.custom), [value, parsed.custom]);

  const base = customMode ? CUSTOM : parsed.base;
  const spec = PG_TYPES.find((t) => t.name === parsed.base);
  const arity = customMode ? 0 : (spec?.params ?? 0);

  const setBase = (next: string) => {
    if (next === CUSTOM) {
      setCustomMode(true);
      onChange(parsed.custom ? parsed.base : '');
      return;
    }
    setCustomMode(false);
    const nextSpec = PG_TYPES.find((t) => t.name === next);
    onChange(formatType(next, parsed.params.slice(0, nextSpec?.params ?? 0)));
  };

  const setParam = (i: number, v: string) => {
    const params = [...parsed.params];
    params[i] = v;
    onChange(formatType(parsed.base, params.slice(0, arity)));
  };

  return (
    <div className="flex grow items-center gap-1">
      <select className={cn(cell, 'grow')} aria-label="type" value={base} onChange={(e) => setBase(e.target.value)}>
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {PG_TYPES.filter((t) => t.group === g).map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM}>custom…</option>
      </select>
      {customMode && (
        <input
          className={cn(cell, 'w-24')}
          aria-label="custom type"
          value={parsed.base}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {Array.from({ length: arity }, (_, i) => (
        <input
          key={i}
          className={cn(cell, 'w-12')}
          aria-label={`type parameter ${i + 1}`}
          value={parsed.params[i] ?? ''}
          onChange={(e) => setParam(i, e.target.value)}
        />
      ))}
    </div>
  );
}
