import type { InputProps } from '@tickets/form';
import type { Option } from '../../../inputs/control';
import { RadioGroup } from '../../../inputs/radio-group';

export type RadioFieldConfig = {
  /** Resolved options — an author may declare an AsyncResolver, and the engine
   *  settles it before this adapter ever runs. */
  options?: Option[];
  /** `plain` is a list of marks; `card` makes the whole row the target. */
  variant?: 'plain' | 'card';
  /**
   * The group's accessible name. The primitive requires one because a
   * `<fieldset>` cannot be named from outside — `for` points at a form control
   * and a fieldset is not one — so it renders this as an **`sr-only` legend**.
   * That is why setting it alongside the FieldNode's visible caption does not
   * duplicate anything on screen. Falls back to the field name.
   */
  label?: string;
};

/**
 * The same single choice `select` makes, with every option on screen.
 *
 * Worth its own kind rather than a `select` variant: which one to use is a
 * decision about how many options there are and whether seeing them all matters,
 * and that decision belongs in the stored config where a generated form can make
 * it per column.
 */
export function RadioField(p: InputProps<RadioFieldConfig, string>) {
  return (
    <div onBlur={p.onBlur}>
      <RadioGroup
        name={p.name}
        label={p.config.label ?? p.name}
        options={p.config.options ?? []}
        variant={p.config.variant}
        // A radio group HAS a selection or has none; the primitive takes a
        // plain string, and '' is the spelling for "nothing chosen".
        value={p.value ?? ''}
        disabled={(p.disabled ?? false) || p.loading}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
