import type { InputProps } from '@bh/form';
import { Input } from '../../../inputs/components/input';

export interface EmailFieldConfig {
  placeholder?: string;
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
      onBlur={p.onBlur}
    />
  );
}
