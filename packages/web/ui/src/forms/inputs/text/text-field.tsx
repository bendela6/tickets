import type { InputProps } from '@tickets/form';
import { cn } from '../../../style';
import { Input } from '../../../components/inputs/input';

export type TextFieldConfig = {
  placeholder?: string;
  mono?: boolean;
  /** Static leading affix, e.g. a fixed URL scheme. Not editable. */
  prefix?: string;
};

export function TextField(p: InputProps<TextFieldConfig, string>) {
  return (
    <div className="flex items-stretch gap-8">
      {p.config.prefix ? (
        <span className="inline-flex items-center rounded-md border-1 border-gray-6 bg-gray-1 px-12 font-sans text-13/19 text-gray-11">
          {p.config.prefix}
        </span>
      ) : null}
      <Input
        id={p.name}
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
        onBlur={p.onBlur}
        className={cn(p.config.mono && 'font-mono text-13')}
      />
    </div>
  );
}
