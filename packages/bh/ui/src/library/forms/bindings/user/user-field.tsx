import type { InputProps } from '@bh/form';
import { UserPicker, type Person } from '../../../inputs/components/user-picker';
import type { Option } from '../../../inputs/contract';
import { useInlineField } from '../../components/inline-field-wrapper';
import { peopleOf } from '../people-of';

export interface UserFieldConfig {
  /** Resolved people. An author may declare an AsyncResolver; the engine settles
   *  it before this adapter runs. */
  people?: Person[];
  /**
   * People as options, as a filter form gives a ref field's rows: each
   * option's value is the person's id, its label their name. `people` wins.
   */
  options?: Option[];
  multiple?: boolean;
  placeholder?: string;
}

/** People, as an array of ids in BOTH modes — 'nobody assigned' has exactly one
 *  spelling, so a consumer needs no guard. */
export function UserField(p: InputProps<UserFieldConfig, string[]>) {
  // In a filter bar's row: the row's size, and the label inside the trigger.
  const inline = useInlineField();
  return (
    <div onBlur={p.onBlur}>
      <UserPicker
        id={p.name}
        aria-describedby={p.describedBy}
        people={peopleOf(p.config)}
        value={p.value ?? []}
        multiple={p.config.multiple}
        placeholder={p.config.placeholder}
        prefix={inline?.label === undefined ? undefined : `${inline.label}:`}
        size={inline?.size}
        readOnly={p.readOnly}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
