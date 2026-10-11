import type { InputProps } from '@bh/form';
import { ColorPicker } from '../../../inputs/components/color-picker';

export interface ColorFieldConfig {
  placeholder?: string;
  label?: string;
}

/** One of the eleven ramps, held as its hue name. Bounded on purpose: a stored
 *  hue has a rung, and so a fill and a readable text pair. */
export function ColorField(p: InputProps<ColorFieldConfig, string | null>) {
  return (
    <div onBlur={p.onBlur}>
      <ColorPicker
        id={p.name}
        aria-describedby={p.describedBy}
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
