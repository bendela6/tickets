import type { InputProps } from '@tickets/form';
import { Switch } from '../../../components/switch';

export type ToggleInputConfig = {
  /** Inline copy beside the switch. The field's caption is rendered above by
   *  FieldWrapper, so this is a second, optional piece of text. */
  label?: string;
};

export function ToggleInput(p: InputProps<ToggleInputConfig, boolean>) {
  return (
    <Switch
      id={p.name}
      name={p.name}
      label={p.config.label ?? ''}
      checked={Boolean(p.value)}
      disabled={p.disabled}
      onChange={(e) => {
        p.onChange(e.target.checked);
        // A switch is toggled, never blurred, so call onBlur here to trigger
        // blur-cause validation the way a real blur would.
        p.onBlur();
      }}
    />
  );
}
