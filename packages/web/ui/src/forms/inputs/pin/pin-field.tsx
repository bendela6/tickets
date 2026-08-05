import type { InputProps } from '@tickets/form';
import { PinInput } from '../../../components/inputs/pin-input';

export type PinFieldConfig = { length?: number };

/** A fixed-length code. The value is the whole string, not one per cell. */
export function PinField(p: InputProps<PinFieldConfig, string>) {
  return (
    <div onBlur={p.onBlur}>
      <PinInput
        id={p.name}
        value={p.value ?? ''}
        length={p.config.length}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
