import type { InputProps } from '@bh/form';
import { cn } from '../../../../style';
import type { Commit } from '../../../inputs/contract';
import { Input } from '../../../inputs/components/input';

export interface TextFieldConfig {
  placeholder?: string;
  mono?: boolean;
  /** Static leading affix, e.g. a fixed URL scheme. Not editable. */
  prefix?: string;
  /**
   * When the field hands its value to the form: `'change'` (the default) at
   * every keystroke, `'leave'` on Enter and on leaving it, `{ after: 800 }` on
   * those and after a pause in typing.
   * It wins over the form's own `commit`.
   */
  commit?: Commit;
}

export function TextField(p: InputProps<TextFieldConfig, string>) {
  return (
    <div className="flex items-stretch gap-8">
      {p.config.prefix ? (
        <span className="rounded-6 border-gray-6 bg-gray-1 text-13/19 text-gray-11 inline-flex items-center border-1 px-12 font-sans">
          {p.config.prefix}
        </span>
      ) : null}
      <Input
        id={p.name}
        aria-describedby={p.describedBy}
        name={p.name}
        type="text"
        // The engine can hand back undefined before a default lands; an
        // undefined `value` would flip the input to uncontrolled mid-life.
        value={p.value ?? ''}
        placeholder={p.config.placeholder}
        disabled={p.disabled}
        tone={p.error ? 'danger' : undefined}
        // Wrapped rather than passed straight through, to drop the event the
        // control offers second. A form field has no use for modifier keys,
        // and `p.onChange` takes exactly one argument — handing it a second
        // would be passing something the form layer never asked for.
        onChange={(next) => p.onChange(next)}
        commit={p.config.commit ?? p.commit}
        onDraft={p.onDraft}
        onBlur={p.onBlur}
        className={cn(p.config.mono && 'text-13 font-mono')}
      />
    </div>
  );
}
