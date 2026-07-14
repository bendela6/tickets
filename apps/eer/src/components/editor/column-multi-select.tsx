// A checkbox list standing in for a native multi-select — jsdom (and users)
// handle a list of checkboxes more reliably than <select multiple>. `value`'s
// order is the order the user ticked entries in, not `options`' order:
// composite keys are ordered (`PRIMARY KEY (a, b)` is not `(b, a)`), so
// ticking appends to the end and unticking just removes, never re-sorts.
//
// A ticked option renders as a numbered chip — its 1-based position in
// `value` — so that order is visible, not merely preserved (frame 1c's
// composite-key requirement); an untouched option stays plain, unnumbered
// text. `invalid` red-tints only the TICKED chips, never the untouched
// options, for the one case the selection itself is the mistake (an fk whose
// local/target column counts don't match — see constraints-editor's arity
// check, frame 1e).
//
// The checkbox itself is visually hidden (`sr-only`) rather than removed —
// its aria-label is the only thing every existing caller/test toggles by,
// unticked or ticked, so the accessible name and the click target must stay
// on the SAME element across both states (a prior chip-vs-checkbox split
// would have broken every existing "click this label to toggle" test).

import { cn } from '../../ui/cn';

interface ColumnMultiSelectProps {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  invalid?: boolean;
}

const chipOn = cn('flex items-center gap-1 rounded-full border border-gray-500', 'bg-gray-800 px-2 py-1 text-xs text-gray-50');
const chipOnInvalid = cn('flex items-center gap-1 rounded-full border border-red-600', 'bg-red-950 px-2 py-1 text-xs text-red-300');
const chipOff = 'flex items-center gap-1 px-2 py-1 text-xs text-gray-400';
const badge = cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full', 'bg-blue-600 font-mono text-3xs text-gray-50');
const badgeInvalid = cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full', 'bg-red-600 font-mono text-3xs text-gray-50');

export function ColumnMultiSelect({ options, value, onChange, label, invalid = false }: ColumnMultiSelectProps) {
  const toggle = (col: string, checked: boolean) => {
    onChange(checked ? [...value, col] : value.filter((c) => c !== col));
  };

  return (
    <div className={cn('flex flex-col gap-1 rounded-md border border-gray-600', 'bg-gray-900 px-2 py-1')}>
      {options.length === 0 && <span className="text-2xs text-gray-500">No columns</span>}
      {options.map((col) => {
        const position = value.indexOf(col);
        const checked = position !== -1;
        return (
          <label key={col} className={checked ? (invalid ? chipOnInvalid : chipOn) : chipOff}>
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              aria-label={`${label} ${col}`}
              onChange={(e) => toggle(col, e.target.checked)}
            />
            {checked && <span className={invalid ? badgeInvalid : badge}>{position + 1}</span>}
            {col}
          </label>
        );
      })}
    </div>
  );
}
