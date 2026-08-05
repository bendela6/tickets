import type { InputProps } from '@tickets/form';
import { DatePicker } from '../../../components/inputs/date-picker';

export type DateFieldConfig = {
  placeholder?: string;
  /** Earliest / latest selectable day, ISO `yyyy-mm-dd` — the same shape the
   *  value carries, so a bound and a value are interchangeable strings. */
  min?: string;
  max?: string;
};

/**
 * A calendar day, held as an ISO string.
 *
 * Not a `Date`: a calendar day has neither a time nor a zone, and a `Date` has
 * both — `new Date('2026-07-09')` west of Greenwich is the evening of the 8th,
 * which is how a stored due-date quietly goes off by one. The primitive already
 * takes and returns the string form, so this adapter passes it straight through.
 */
export function DateField(p: InputProps<DateFieldConfig, string | null>) {
  return (
    <div onBlur={p.onBlur}>
      <DatePicker
        id={p.name}
        value={p.value ?? null}
        placeholder={p.config.placeholder}
        min={p.config.min}
        max={p.config.max}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
