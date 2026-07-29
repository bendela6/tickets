import type { InputProps } from '@tickets/form';
import type { ComboOption } from '../../../components/combobox-list';
import { MultiCombobox } from '../../../components/multi-combobox';

export type MultiSelectInputConfig = {
  /** Resolved options — see SelectInputConfig. */
  options?: ComboOption[];
  placeholder?: string;
  maxChips?: number;
};

export function MultiSelectInput(p: InputProps<MultiSelectInputConfig, string[]>) {
  return (
    <div onBlur={p.onBlur}>
      <MultiCombobox
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
