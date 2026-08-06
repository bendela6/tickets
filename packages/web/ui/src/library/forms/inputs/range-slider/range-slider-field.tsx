import type { InputProps } from '@tickets/form';
import { RangeSlider } from '../../../inputs/range-slider';

export type RangeFieldConfig = { min?: number; max?: number; step?: number; label?: string };

/** A bounded span of numbers, as `[low, high]`. Never null: two thumbs are
 *  always somewhere, so an absent range would still render as a position. */
export function RangeField(p: InputProps<RangeFieldConfig, [number, number]>) {
  const min = p.config.min ?? 0;
  const max = p.config.max ?? 100;
  return (
    <div onBlur={p.onBlur}>
      <RangeSlider
        id={p.name}
        label={p.config.label ?? p.name}
        value={p.value ?? [min, max]}
        min={min}
        max={max}
        step={p.config.step}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
