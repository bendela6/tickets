import type { InputProps } from '@bh/form';
import type { Option } from '../../../inputs/contract';
import { Combobox } from '../../../inputs/components/combobox';
import { useInlineField } from '../../components/inline-field-wrapper';
import { withHues } from '../option-hues';

export interface SelectFieldConfig {
  /** Resolved options. An author may declare this as an AsyncResolver in the
   *  form config; the engine resolves it and flips `loading` while it does, so
   *  this adapter only ever sees a settled array. */
  options?: Option[];
  placeholder?: string;
  /**
   * In a filter form: fill each option's `count` with the rows picking it
   * would show, from the form's `countsBy` (a presets field's from its
   * `countFor`). The control itself reads only the options.
   */
  counts?: boolean;
}

export function SelectField(p: InputProps<SelectFieldConfig, string | null>) {
  // In a filter bar's row: the row's size, and the label inside the trigger.
  const inline = useInlineField();
  return (
    <div onBlur={p.onBlur}>
      <Combobox
        id={p.name}
        aria-describedby={p.describedBy}
        options={withHues(p.config.options)}
        value={p.value ?? null}
        placeholder={p.config.placeholder}
        prefix={inline?.label === undefined ? undefined : `${inline.label}:`}
        size={inline?.size}
        // Disabled while async options are in flight, or the trigger would open
        // onto an empty list and read as "no options" rather than "not yet".
        readOnly={p.readOnly}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={p.onChange}
      />
    </div>
  );
}
