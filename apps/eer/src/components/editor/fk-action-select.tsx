// The ON DELETE / ON UPDATE action select used by an fk constraint row in
// ConstraintsEditor — split out on its own (rather than inlined there) purely
// to keep that file's size down; no behaviour of its own beyond the dropdown.

import type { FkAction } from '../../engine/model/types';
import { cn } from '../../ui/cn';

const input = cn('rounded border border-gray-600 bg-gray-900 px-2 py-1', 'text-xs text-gray-50');
const selectCls = cn(input, 'shrink-0');

const FK_ACTIONS: { value: FkAction | ''; label: string }[] = [
  { value: '', label: '–' },
  { value: 'cascade', label: 'cascade' },
  { value: 'restrict', label: 'restrict' },
  { value: 'set null', label: 'set null' },
  { value: 'set default', label: 'set default' },
  { value: 'no action', label: 'no action' },
];

interface FkActionSelectProps {
  label: string;
  value: FkAction | null;
  onChange: (next: FkAction | null) => void;
}

export function FkActionSelect({ label, value, onChange }: FkActionSelectProps) {
  return (
    <label className="flex items-center gap-1 text-2xs text-gray-400">
      {label}
      <select
        className={selectCls}
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as FkAction | null)}
      >
        {FK_ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
