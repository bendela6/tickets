import type { InputProps } from '@tickets/form';
import type { Option } from '../../../components/inputs/control';
import { MultiCombobox } from '../../../components/inputs/multi-combobox';

export type MultiSelectInputConfig = {
  /** Resolved options — see SelectInputConfig. */
  options?: Option[];
  placeholder?: string;
  maxChips?: number;
};

export function MultiSelectInput(p: InputProps<MultiSelectInputConfig, string[]>) {
  return (
    <div onBlur={p.onBlur}>
      <MultiCombobox
        id={p.name}
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
