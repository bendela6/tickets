import type { InputProps } from '@tickets/form';
import { Textarea } from '../../../inputs/components/textarea';

export type TextAreaFieldConfig = {
  rows?: number;
  placeholder?: string;
};

export function TextAreaField(p: InputProps<TextAreaFieldConfig, string>) {
  return (
    <Textarea
      id={p.name}
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
