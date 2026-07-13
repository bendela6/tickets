// A checkbox list standing in for a native multi-select — jsdom (and users)
// handle a list of checkboxes more reliably than <select multiple>. `value`'s
// order is the order the user ticked entries in, not `options`' order:
// composite keys are ordered (`PRIMARY KEY (a, b)` is not `(b, a)`), so
// ticking appends to the end and unticking just removes, never re-sorts.

import { cn } from '../../ui/cn';

interface ColumnMultiSelectProps {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
}

export function ColumnMultiSelect({ options, value, onChange, label }: ColumnMultiSelectProps) {
  const toggle = (col: string, checked: boolean) => {
    onChange(checked ? [...value, col] : value.filter((c) => c !== col));
  };

  return (
    <div className={cn('flex flex-col gap-1 rounded-md border border-gray-600', 'bg-gray-900 px-2 py-1')}>
      {options.length === 0 && <span className="text-2xs text-gray-500">No columns</span>}
      {options.map((col) => (
        <label key={col} className="flex items-center gap-1 text-xs text-gray-200">
          <input
            type="checkbox"
            checked={value.includes(col)}
            aria-label={`${label} ${col}`}
            onChange={(e) => toggle(col, e.target.checked)}
          />
          {col}
        </label>
      ))}
    </div>
  );
}
