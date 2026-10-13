import type { InputProps } from '@bh/form';
import type { Commit } from '../../../inputs/contract';
import { Textarea } from '../../../inputs/components/textarea';

export interface TextAreaFieldConfig {
  rows?: number;
  placeholder?: string;
  /**
   * When the field hands its value to the form: `'change'` (the default) at
   * every keystroke, `'leave'` on leaving it or on Ctrl/Cmd+Enter (Enter is a
   * new line), `{ after: 800 }` on those and after a pause in typing.
   * It wins over the form's own `commit`.
   */
  commit?: Commit;
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
      commit={p.config.commit ?? p.commit}
      onDraft={p.onDraft}
      onBlur={p.onBlur}
    />
  );
}
