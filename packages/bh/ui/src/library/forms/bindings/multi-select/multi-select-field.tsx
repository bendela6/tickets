import type { InputProps } from '@bh/form';
import type { Option } from '../../../inputs/contract';
import { MultiCombobox } from '../../../inputs/components/multi-combobox';
import { useInlineField } from '../../components/inline-field-wrapper';
import { withHues } from '../option-hues';

export interface MultiSelectFieldConfig {
  /** Resolved options — see SelectFieldConfig. */
  options?: Option[];
  placeholder?: string;
  maxChips?: number;
  /**
   * In a filter form: fill each option's `count` with the rows picking it
   * would show, from the form's `countsBy` (a presets field's from its
   * `countFor`). The control itself reads only the options.
   */
  counts?: boolean;
}

export function MultiSelectField(p: InputProps<MultiSelectFieldConfig, string[]>) {
  // In a filter bar's row: the row's size, and the label inside the trigger.
  const inline = useInlineField();
  return (
    <div onBlur={p.onBlur}>
      <MultiCombobox
        id={p.name}
        aria-describedby={p.describedBy}
        aria-label={p.label}
        options={withHues(p.config.options)}
        value={p.value ?? []}
        placeholder={p.config.placeholder}
        prefix={inline?.label === undefined ? undefined : `${inline.label}:`}
        size={inline?.size}
        maxChips={p.config.maxChips}
        readOnly={p.readOnly}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={p.onChange}
      />
    </div>
  );
}
