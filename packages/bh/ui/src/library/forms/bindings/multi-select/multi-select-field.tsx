import type { InputProps } from '@bh/form';
import type { Option } from '../../../inputs/contract';
import { MultiCombobox } from '../../../inputs/components/multi-combobox';

export interface MultiSelectFieldConfig {
  /** Resolved options — see SelectFieldConfig. */
  options?: Option[];
  placeholder?: string;
  maxChips?: number;
}

export function MultiSelectField(p: InputProps<MultiSelectFieldConfig, string[]>) {
  return (
    <div onBlur={p.onBlur}>
      <MultiCombobox
        id={p.name}
        aria-describedby={p.describedBy}
        options={p.config.options ?? []}
        value={p.value ?? []}
        placeholder={p.config.placeholder}
        maxChips={p.config.maxChips}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={p.onChange}
      />
    </div>
  );
}
