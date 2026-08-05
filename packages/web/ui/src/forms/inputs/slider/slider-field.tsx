import type { InputProps } from '@tickets/form';
import { Slider } from '../../../components/inputs/slider';

export type SliderFieldConfig = {
  min?: number;
  max?: number;
  step?: number;
  /**
   * Accessible name. The primitive requires one and renders it as an
   * `aria-label` rather than visible text — a `div[role="slider"]` cannot be
   * named by a `<label for>` — so this never duplicates the wrapper's caption.
   * Falls back to the field name.
   */
  label?: string;
  /** Spoken form of the value where the bare number would mislead — `42%`, `1.5×`. */
  valueText?: string;
};

/**
 * A bounded number picked by dragging rather than typing.
 *
 * The value is a plain `number`, never null: a thumb has to be drawn somewhere,
 * so "no value" would still render as a position and lie about it. A field that
 * can genuinely be empty is a `number`, not a `slider`. Where the engine has
 * nothing yet, the low bound is the honest starting point — `0` would sit
 * outside the track whenever `min` is above it.
 */
export function SliderField(p: InputProps<SliderFieldConfig, number>) {
  const min = p.config.min ?? 0;
  return (
    <div onBlur={p.onBlur}>
      <Slider
        id={p.name}
        label={p.config.label ?? p.name}
        value={p.value ?? min}
        min={min}
        max={p.config.max}
        step={p.config.step}
        valueText={p.config.valueText}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
