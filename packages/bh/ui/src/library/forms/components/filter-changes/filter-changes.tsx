import type { FilterChangesProps } from '@bh/form';

/**
 * Says a filter form holds changes its Apply hasn't applied yet: "1 change
 * waiting", and nothing while there are none. A filter form that applies
 * with a button draws it in its `changes` slot, before its Clear and Apply;
 * it is the registry's `filter.changes`.
 */
export function FilterChanges({ count }: FilterChangesProps) {
  return (
    // Polite and always there, so a screen reader hears the first change too.
    <output
      aria-live="polite"
      // An inline row puts it at its end, before the form's buttons.
      data-row-end=""
      className="text-12 text-gray-11 shrink-0 font-sans whitespace-nowrap empty:hidden"
    >
      {count > 0 ? `${count} ${count === 1 ? 'change' : 'changes'} waiting` : null}
    </output>
  );
}
