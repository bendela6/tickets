// The type picker (frame 1d of the EER Modal Spec). Anchored under the type
// cell that owns it (see type-cell.tsx). Type is only ever PICKED here — there
// is no text-entry commit path; the filter input narrows the list, it never
// becomes the value. Built-in types are grouped by PgTypeGroup and laid out in
// three CSS columns; the model's enums get their own violet section at the
// bottom, never mixed into the built-ins. An invalid (unknown) current value
// pins to the top, red and aria-disabled — the only way out is picking a real
// type, which is what makes an unrecognised type block export visibly.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import type { EnumDecl } from '../../engine/model/types';
import { PG_TYPES, type PgTypeDescriptor, type PgTypeGroup } from '../../engine/model/pg-types';
import { cn } from '../../ui/cn';
import { runtimeStyle } from '../../ui/runtime-style';

const GROUPS: PgTypeGroup[] = [
  'numeric', 'text', 'boolean', 'temporal', 'uuid', 'json', 'network', 'geometric', 'vector',
];

// A row the keyboard cursor can land on — built-in types and enums, NOT the
// pinned invalid entry (it is display-only, never selectable).
interface SelectableRow {
  key: string;
  base: string;
}

export interface TypePickerProps {
  value: string; // current base, for the blue "current value" highlight
  enums: EnumDecl[];
  // The current base when it parses as neither a catalogue type nor a
  // declared enum — pinned to the top, red, unselectable.
  unknownBase?: string | null;
  onPick: (base: string) => void;
  onClose: () => void;
}

function signatureFor(d: PgTypeDescriptor): string | null {
  return d.params.length ? `(${d.params.map((p) => p.name).join(',')})` : null;
}

const optionRow = 'cursor-pointer truncate rounded px-2 py-1 text-xs text-gray-50';
const groupLabel = 'text-2xs font-semibold uppercase tracking-wide text-gray-400';

export function TypePicker({ value, enums, unknownBase, onPick, onClose }: TypePickerProps) {
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = filter.trim().toLowerCase();

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        types: PG_TYPES.filter(
          (t) => t.group === group && (q === '' || t.displayName.toLowerCase().includes(q) || group.includes(q)),
        ),
      })).filter((g) => g.types.length > 0),
    [q],
  );

  const filteredEnums = useMemo(
    () => enums.filter((e) => q === '' || e.name.toLowerCase().includes(q)),
    [enums, q],
  );

  // Flat keyboard-navigable order: built-ins (grouped) then enums. The pinned
  // invalid entry is excluded — it is never a cursor target.
  const selectable: SelectableRow[] = useMemo(
    () => [
      ...groups.flatMap((g) => g.types.map((t) => ({ key: t.sqlName, base: t.sqlName }))),
      ...filteredEnums.map((e) => ({ key: `enum:${e.name}`, base: e.name })),
    ],
    [groups, filteredEnums],
  );

  const initialCursor = Math.max(
    selectable.findIndex((r) => r.base === value),
    0,
  );
  const [cursor, setCursor] = useState(initialCursor);
  const cursorKey = selectable[cursor]?.key;

  const move = (delta: number) => {
    setCursor((c) => {
      const n = selectable.length;
      if (n === 0) return c;
      return (c + delta + n) % n;
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = selectable[cursor];
      if (row) onPick(row.base);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="listbox"
      aria-label="Type"
      className={cn(
        'absolute top-full left-0 z-10 mt-1 w-(--picker-w) rounded-lg border border-gray-500',
        'bg-gray-800 p-2 shadow-xl',
      )}
      style={runtimeStyle({ '--picker-w': '672px' })}
      onKeyDown={onKeyDown}
    >
      <input
        ref={inputRef}
        className="mb-2 w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-50"
        placeholder="Filter types…"
        aria-label="Filter types…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {unknownBase && (
        <div
          role="option"
          aria-selected={false}
          aria-disabled="true"
          className="mb-2 truncate rounded bg-red-950 px-2 py-1 text-xs text-red-400"
        >
          {unknownBase} — unknown type
        </div>
      )}

      <div className="columns-3 gap-4">
        {groups.map((g) => (
          <div key={g.group} role="group" aria-label={g.group} className="mb-2 break-inside-avoid">
            <div className={groupLabel}>{g.group}</div>
            {g.types.map((t) => {
              const isCursor = cursorKey === t.sqlName;
              const isCurrent = t.sqlName === value;
              const sig = signatureFor(t);
              return (
                <div
                  key={t.sqlName}
                  role="option"
                  aria-selected={isCurrent}
                  className={cn(
                    optionRow,
                    isCurrent && 'ring-1 ring-blue-500',
                    isCursor ? 'bg-gray-700' : isCurrent && 'bg-blue-600',
                  )}
                  onMouseEnter={() => setCursor(selectable.findIndex((r) => r.key === t.sqlName))}
                  onClick={() => onPick(t.sqlName)}
                >
                  {t.displayName}
                  {sig && ' '}
                  {sig && <span className="text-gray-400">{sig}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {filteredEnums.length > 0 && (
        <div role="group" aria-label="Enums in this model" className="mt-2 border-t border-gray-600 pt-2">
          <div className={cn(groupLabel, 'text-violet-300')}>Enums in this model</div>
          {filteredEnums.map((e) => {
            const key = `enum:${e.name}`;
            const isCursor = cursorKey === key;
            const isCurrent = e.name === value;
            return (
              <div
                key={e.name}
                role="option"
                aria-selected={isCurrent}
                className={cn(
                  optionRow,
                  'text-violet-200',
                  isCurrent && 'ring-1 ring-blue-500',
                  isCursor ? 'bg-gray-700' : isCurrent && 'bg-blue-600',
                )}
                onMouseEnter={() => setCursor(selectable.findIndex((r) => r.key === key))}
                onClick={() => onPick(e.name)}
              >
                {e.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
