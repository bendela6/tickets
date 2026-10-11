import type { InputProps } from '@bh/form';
import { PasswordInput } from '../../../inputs/components/password-input';

export interface PasswordFieldConfig {
  placeholder?: string;
}

/** A secret. The reveal is the control's own local state — a form has no
 *  business being able to unmask a password the user did not ask to see. */
export function PasswordField(p: InputProps<PasswordFieldConfig, string>) {
  return (
    <div onBlur={p.onBlur}>
      <PasswordInput
        id={p.name}
        aria-describedby={p.describedBy}
        name={p.name}
        value={p.value ?? ''}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
      />
    </div>
  );
}
