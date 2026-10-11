import type { InputProps } from '@bh/form';
import { Textarea } from '../../../inputs/components/textarea';

export interface TextAreaFieldConfig {
  rows?: number;
  placeholder?: string;
}

export function TextAreaField(p: InputProps<TextAreaFieldConfig, string>) {
  return (
    <Textarea
      id={p.name}
      aria-describedby={p.describedBy}
      name={p.name}
      rows={p.config.rows ?? 4}
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      disabled={p.disabled}
      tone={p.error ? 'danger' : undefined}
      onChange={p.onChange}
      onBlur={p.onBlur}
    />
  );
}
