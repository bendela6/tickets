// The type picker. Types are stored as strings ("varchar(255)"), so this cell is
// a codec around a <select>: it parses the incoming string, renders the base +
// its params, and emits a formatted string back. `custom…` keeps unrecognised
// spellings (enums, domains, anything not in the drizzle-derived catalogue)
// editable as free text.
//
// NOTE: this is a stopgap. `parseType` no longer reports a `custom` flag — a
// name the catalogue doesn't know now parses as `known: false` instead, since
// there is no free-text escape hatch left in the type model itself. This cell
// still offers one at the UI layer (treating `!known` the way it treated
// `custom`) because Task 11 replaces this component wholesale with a real
// picker; until then, keep it compiling and behaving as before.

import { useEffect, useRef, useState } from 'react';

import { PG_TYPES, formatType, parseType, type PgTypeGroup } from '../../engine/model/pg-types';
import { cn } from '../../ui/cn';

const CUSTOM = '__custom__';
const GROUPS: PgTypeGroup[] = [
  'numeric', 'text', 'boolean', 'temporal', 'uuid', 'json', 'network', 'geometric', 'vector',
];
const cell = cn('rounded border border-gray-600 bg-gray-900 px-1 py-1', 'font-mono text-xs text-gray-50');

export function TypeCell({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const parsed = parseType(value);
  // `!parsed.known` alone can't drive the custom-mode UI: picking "custom…"
  // for a currently-known type (e.g. "integer") emits onChange('') — a value
  // that, in a real caller, doesn't reach this component as a new `value` prop
  // until the NEXT render (dispatch is async, and tests may spy on onChange
  // without ever feeding the result back in). Without this bit of local state,
  // the custom text input would never appear: `value` is still "integer",
  // which is a known type, so `!parsed.known` stays false. It resyncs from the
  // prop whenever `value` actually changes (row reorder, external update,
  // mount) — but NOT when the incoming `value` is merely our own last emission
  // echoed back (the real app re-renders this cell with the just-typed value
  // on every keystroke). Without that distinction, typing a custom name that
  // transiently or finally collides with a catalogue type (e.g. "jsonb_data"
  // passing through "jsonb") would flip `known` to true, snap the picker back
  // to the catalogue option, and unmount the free-text input mid-keystroke.
  const [customMode, setCustomMode] = useState(!parsed.known);
  const lastEmitted = useRef<string | null>(null);
  useEffect(() => {
    if (value === lastEmitted.current) return; // our own echo — not an external change
    setCustomMode(!parsed.known);
  }, [value, parsed.known]);

  const base = customMode ? CUSTOM : parsed.base;
  const spec = PG_TYPES.find((t) => t.sqlName === parsed.base);
  const arity = customMode ? 0 : (spec?.params.length ?? 0);

  const emit = (next: string) => {
    lastEmitted.current = next;
    onChange(next);
  };

  const setBase = (next: string) => {
    if (next === CUSTOM) {
      setCustomMode(true);
      emit(!parsed.known ? parsed.base : '');
      return;
    }
    setCustomMode(false);
    const nextSpec = PG_TYPES.find((t) => t.sqlName === next);
    emit(formatType(next, parsed.params.slice(0, nextSpec?.params.length ?? 0)));
  };

  const setParam = (i: number, v: string) => {
    const params = [...parsed.params];
    params[i] = v;
    emit(formatType(parsed.base, params.slice(0, arity)));
  };

  return (
    <div className="flex grow items-center gap-1">
      <select className={cn(cell, 'grow')} aria-label="type" value={base} onChange={(e) => setBase(e.target.value)}>
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {PG_TYPES.filter((t) => t.group === g).map((t) => (
              <option key={t.sqlName} value={t.sqlName}>
                {t.displayName}
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
          onChange={(e) => emit(e.target.value)}
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
