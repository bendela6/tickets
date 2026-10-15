import type { InputProps } from '@bh/form';
import { DateRangePicker, type DateRange } from '../../../inputs/components/date-range-picker';
import { useInlineField } from '../../components/inline-field-wrapper';

export interface DateRangeFieldConfig {
  placeholder?: string;
}

/** A span of days as a `[start, end]` pair of ISO strings. Either half may be
 *  null: a half-picked range is a real state a form can hold. */
export function DateRangeField(p: InputProps<DateRangeFieldConfig, DateRange>) {
  // In a filter bar's row: the row's size, and the label inside the trigger.
  const inline = useInlineField();
  return (
    <div onBlur={p.onBlur}>
      <DateRangePicker
        id={p.name}
        aria-describedby={p.describedBy}
        value={p.value ?? [null, null]}
        placeholder={p.config.placeholder}
        prefix={inline?.label === undefined ? undefined : `${inline.label}:`}
        size={inline?.size}
        readOnly={p.readOnly}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
