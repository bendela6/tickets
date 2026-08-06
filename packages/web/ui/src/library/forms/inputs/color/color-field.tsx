import type { InputProps } from '@tickets/form';
import { ColorPicker } from '../../../inputs/color-picker';

export type ColorFieldConfig = { placeholder?: string; label?: string };

/** One of the eleven ramps, held as its hue name. Bounded on purpose: a stored
 *  hue has a rung, and so a fill and a readable text pair. */
export function ColorField(p: InputProps<ColorFieldConfig, string | null>) {
  return (
    <div onBlur={p.onBlur}>
      <ColorPicker
        id={p.name}
        value={p.value ?? null}
        placeholder={p.config.placeholder}
        label={p.config.label}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
