import type { InputProps } from '@bh/form';
import type { Commit } from '../../../inputs/contract';
import { Input } from '../../../inputs/components/input';

export interface EmailFieldConfig {
  placeholder?: string;
  /**
   * When the field hands its value to the form: `'change'` (the default) at
   * every keystroke, `'leave'` on Enter and on leaving it, `{ after: 800 }` on
   * those and after a pause in typing.
   * It wins over the form's own `commit`.
   */
  commit?: Commit;
}

/**
 * An email address: what a schema's `v.email()` draws.
 *
 * `type="email"` brings up a phone's address keyboard, and `autoComplete`
 * lets the browser offer the reader's own address. It checks nothing: the
 * form turns the browser's checks off, and the field's schema says what is
 * wrong in its own words.
 */
export function EmailField(p: InputProps<EmailFieldConfig, string>) {
  return (
    <Input
      id={p.name}
      aria-describedby={p.describedBy}
      name={p.name}
      type="email"
      autoComplete="email"
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      disabled={p.disabled}
      tone={p.error ? 'danger' : undefined}
      onChange={(next) => p.onChange(next)}
      commit={p.config.commit ?? p.commit}
      onDraft={p.onDraft}
      onBlur={p.onBlur}
    />
  );
}
