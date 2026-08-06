import type { InputProps } from '@tickets/form';
import { UserPicker, type Person } from '../../../inputs/user-picker';

export type UserFieldConfig = {
  /** Resolved people. An author may declare an AsyncResolver; the engine settles
   *  it before this adapter runs. */
  people?: Person[];
  multiple?: boolean;
  placeholder?: string;
};

/** People, as an array of ids in BOTH modes — 'nobody assigned' has exactly one
 *  spelling, so a consumer needs no guard. */
export function UserField(p: InputProps<UserFieldConfig, string[]>) {
  return (
    <div onBlur={p.onBlur}>
      <UserPicker
        id={p.name}
        people={p.config.people ?? []}
        value={p.value ?? []}
        multiple={p.config.multiple}
        placeholder={p.config.placeholder}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
