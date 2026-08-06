import type { InputProps } from '@tickets/form';
import { CheckboxGroup } from '../../../inputs/checkbox-group';
import type { Option } from '../../../inputs/control';

export type CheckboxGroupFieldConfig = {
  options?: Option[];
  label?: string;
  selectAllLabel?: string;
};

/**
 * Several independent choices, all visible — the counterpart to `multi-select`
 * that shows its options rather than hiding them behind a trigger. Which to use
 * is the decision the two kinds exist to record.
 */
export function CheckboxGroupField(p: InputProps<CheckboxGroupFieldConfig, string[]>) {
  return (
    <div onBlur={p.onBlur}>
      <CheckboxGroup
        id={p.name}
        label={p.config.label ?? p.name}
        options={p.config.options ?? []}
        selectAllLabel={p.config.selectAllLabel}
        value={p.value ?? []}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
