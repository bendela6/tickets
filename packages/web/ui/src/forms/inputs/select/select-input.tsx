import type { InputProps } from '@tickets/form';
import type { Option } from '../../../components/inputs/control';
import { Combobox } from '../../../components/inputs/combobox';

export type SelectInputConfig = {
  /** Resolved options. An author may declare this as an AsyncResolver in the
   *  form config; the engine resolves it and flips `loading` while it does, so
   *  this adapter only ever sees a settled array. */
  options?: Option[];
  placeholder?: string;
};

export function SelectInput(p: InputProps<SelectInputConfig, string | null>) {
  return (
    <div onBlur={p.onBlur}>
      <Combobox
        id={p.name}
        options={p.config.options ?? []}
        value={p.value ?? null}
        placeholder={p.config.placeholder}
        // Disabled while async options are in flight, or the trigger would open
        // onto an empty list and read as "no options" rather than "not yet".
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={p.onChange}
      />
    </div>
  );
}
