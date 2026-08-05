import type { InputProps } from '@tickets/form';
import { Switch } from '../../../components/inputs/switch';

export type ToggleInputConfig = {
  /** Inline copy beside the switch. FieldWrapper renders the field's caption
   *  above, so this is a second, optional piece of text — and now genuinely
   *  optional: it used to be passed as `''` because Switch demanded a label it
   *  did not need, since the field is already named through `id`. */
  label?: string;
};

export function ToggleInput(p: InputProps<ToggleInputConfig, boolean>) {
  return (
    <Switch
      id={p.name}
      name={p.name}
      label={p.config.label}
      value={Boolean(p.value)}
      disabled={p.disabled}
      onChange={(next) => {
        p.onChange(next);
        // A switch is toggled, never blurred, so call onBlur here to trigger
        // blur-cause validation the way a real blur would.
        p.onBlur();
      }}
    />
  );
}
