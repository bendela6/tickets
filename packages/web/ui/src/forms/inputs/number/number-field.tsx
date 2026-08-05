import type { InputProps } from '@tickets/form';
import { NumberInput } from '../../../components/inputs/number-input';

export type NumberFieldConfig = {
  min?: number;
  max?: number;
  step?: number;
  /** Trailing unit label, e.g. `hours`. Static text, not part of the value. */
  suffix?: string;
};

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

/**
 * Named `NumberField` so it does not shadow the `NumberInput` primitive it
 * wraps.
 *
 * The primitive exposes no `onBlur`, so the wrapper div carries it — React's
 * synthetic blur bubbles, unlike the native event. Clamping happens here
 * rather than in the primitive because `min`/`max` arrive as authored form
 * config, and the primitive is also used outside forms where the caller owns
 * that policy.
 */
export function NumberField(p: InputProps<NumberFieldConfig, number | null>) {
  return (
    <div onBlur={p.onBlur} className="flex items-center gap-8">
      <NumberInput
        id={p.name}
        value={p.value ?? null}
        min={p.config.min}
        max={p.config.max}
        step={p.config.step}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next === null ? null : clamp(next, p.config.min, p.config.max))}
      />
      {p.config.suffix ? (
        <span className="font-sans text-13/19 text-gray-11">{p.config.suffix}</span>
      ) : null}
    </div>
  );
}
