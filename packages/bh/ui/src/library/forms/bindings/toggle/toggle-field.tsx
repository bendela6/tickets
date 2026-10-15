import type { InputProps } from '@bh/form';
import { Switch } from '../../../inputs/components/switch';
import { useInlineField } from '../../components/inline-field-wrapper';

export interface ToggleFieldConfig {
  /** Inline copy beside the switch. FieldWrapper renders the field's caption
   *  above, so this is a second, optional piece of text — and now genuinely
   *  optional: it used to be passed as `''` because Switch demanded a label it
   *  did not need, since the field is already named through `id`. */
  label?: string;
}

export function ToggleField(p: InputProps<ToggleFieldConfig, boolean>) {
  const inline = useInlineField();
  return (
    <Switch
      id={p.name}
      aria-describedby={p.describedBy}
      name={p.name}
      // In a filter bar's row, the field's label is the text beside it.
      label={p.config.label ?? inline?.label}
      value={Boolean(p.value)}
      readOnly={p.readOnly}
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
