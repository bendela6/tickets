// The type picker's trigger + inline controls. Types are stored as strings
// ("varchar(255)"), so this cell is a codec around that string: it parses the
// incoming value, renders a button showing the current type (opening
// <TypePicker/> to change it), param inputs grown from the picked type's
// descriptor, and an `[]` array toggle.
//
// There is NO free-text path any more — the old custom-mode ref hack (kept
// alive through Tasks 1-10 so this file would keep compiling while the type
// model grew a `known: false` state instead of a `custom` flag) is gone.
// `parseType` no longer reports `custom`; a name the catalogue doesn't know
// AND that isn't one of the model's declared enums renders as an INVALID
// selection (red trigger, picker forced open, pinned unselectable option at
// the top of the list) rather than an editable text field. The only way out
// is picking a real type.

import { useEffect, useRef, useState } from 'react';

import { descriptorFor, formatType, parseType, type ArrayDimension } from '../../engine/model/pg-types';
import type { EnumDecl } from '../../engine/model/types';
import { cn } from '@tickets/ui/cn';
import { TypePicker } from './type-picker';

const cell = cn('rounded border border-gray-600 bg-gray-900 px-1 py-1', 'font-mono text-xs text-gray-50');
const invalidCell = cn('rounded border border-red-600 bg-red-950 px-1 py-1', 'font-mono text-xs text-red-400');
const paramInput = cn(cell, 'w-12');

export interface TypeCellProps {
  value: string;
  onChange: (t: string) => void;
  // The model's declared enums — a value matching one of these is a valid
  // pick even though the pg-types catalogue itself has never heard of it.
  // Optional: a bare <TypeCell/> with no model in scope just has no enums.
  enums?: EnumDecl[];
}

export function TypeCell({ value, onChange, enums = [] }: TypeCellProps) {
  const parsed = parseType(value);
  const isEnum = enums.some((e) => e.name === parsed.base);
  const valid = parsed.known || isEnum;

  const [manualOpen, setManualOpen] = useState(false);
  // An invalid value forces the picker open — there is no sensible "closed"
  // display for a type that can't export, and no other way to resolve it.
  const open = manualOpen || !valid;

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setManualOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const spec = descriptorFor(parsed.base);
  const arity = valid ? (spec?.params.length ?? 0) : 0;
  const isArray = parsed.arrays.length > 0;

  const pick = (base: string) => {
    const nextSpec = descriptorFor(base);
    const params = nextSpec ? parsed.params.slice(0, nextSpec.params.length) : [];
    onChange(formatType(base, params, parsed.arrays));
    setManualOpen(false);
  };

  const setParam = (i: number, v: string) => {
    const params = [...parsed.params];
    params[i] = v;
    onChange(formatType(parsed.base, params.slice(0, arity), parsed.arrays));
  };

  const toggleArray = (checked: boolean) => {
    const arrays: ArrayDimension[] = checked ? [{ size: null }] : [];
    onChange(formatType(parsed.base, parsed.params, arrays));
  };

  const display = valid ? (spec?.displayName ?? parsed.base) : parsed.base;

  return (
    <div ref={containerRef} className="relative flex grow items-center gap-1">
      <button
        type="button"
        className={cn(valid ? cell : invalidCell, 'grow truncate text-left')}
        aria-label="type"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setManualOpen((o) => !o)}
      >
        {display}
      </button>

      {Array.from({ length: arity }, (_, i) => (
        <input
          key={spec!.params[i]!.name}
          className={paramInput}
          aria-label={spec!.params[i]!.name}
          value={parsed.params[i] ?? ''}
          onChange={(e) => setParam(i, e.target.value)}
        />
      ))}

      <label className="flex shrink-0 items-center gap-1 text-2xs text-gray-400">
        <input type="checkbox" aria-label="[]" checked={isArray} onChange={(e) => toggleArray(e.target.checked)} />
        []
      </label>

      {open && (
        <TypePicker
          value={parsed.base}
          enums={enums}
          unknownBase={valid ? null : parsed.base}
          onPick={pick}
          onClose={() => setManualOpen(false)}
        />
      )}
    </div>
  );
}
