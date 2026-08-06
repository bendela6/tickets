import type { InputProps } from '@tickets/form';
import { TimePicker } from '../../../inputs/components/time-picker';

export type TimeFieldConfig = { stepMinutes?: number; placeholder?: string };

/** A time of DAY as `HH:MM`. Distinct from `duration`, which is a length — the
 *  two look alike and mean entirely different things. */
export function TimeField(p: InputProps<TimeFieldConfig, string | null>) {
  return (
    <div onBlur={p.onBlur}>
      <TimePicker
        id={p.name}
        value={p.value ?? null}
        stepMinutes={p.config.stepMinutes}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
