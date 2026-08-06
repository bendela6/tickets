import type { InputProps } from '@tickets/form';
import { DurationInput } from '../../../inputs/duration-input';

export type DurationFieldConfig = { placeholder?: string; budgetMinutes?: number };

/** A LENGTH of time, stored as minutes. Estimates and time tracking use this;
 *  `time` is a clock reading and is not interchangeable with it. */
export function DurationField(p: InputProps<DurationFieldConfig, number | null>) {
  return (
    <div onBlur={p.onBlur}>
      <DurationInput
        id={p.name}
        value={p.value ?? null}
        placeholder={p.config.placeholder}
        budgetMinutes={p.config.budgetMinutes}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
