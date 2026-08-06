import type { InputProps } from '@tickets/form';
import { DateRangePicker, type DateRange } from '../../../inputs/date-range-picker';

export type DateRangeFieldConfig = { placeholder?: string };

/** A span of days as a `[start, end]` pair of ISO strings. Either half may be
 *  null: a half-picked range is a real state a form can hold. */
export function DateRangeField(p: InputProps<DateRangeFieldConfig, DateRange>) {
  return (
    <div onBlur={p.onBlur}>
      <DateRangePicker
        id={p.name}
        value={p.value ?? [null, null]}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
