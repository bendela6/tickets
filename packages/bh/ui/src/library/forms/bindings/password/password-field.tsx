import type { InputProps } from '@bh/form';
import type { Commit } from '../../../inputs/contract';
import { PasswordInput } from '../../../inputs/components/password-input';

export interface PasswordFieldConfig {
  placeholder?: string;
  /**
   * When the field hands its value to the form: `'change'` (the default) at
   * every keystroke, `'leave'` on Enter and on leaving it, `{ after: 800 }` on
   * those and after a pause in typing.
   * It wins over the form's own `commit`.
   */
  commit?: Commit;
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
        readOnly={p.readOnly}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        onChange={(next) => p.onChange(next)}
        commit={p.config.commit ?? p.commit}
        onDraft={p.onDraft}
      />
    </div>
  );
}
