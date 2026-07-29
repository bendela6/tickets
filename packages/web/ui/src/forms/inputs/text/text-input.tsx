import type { InputProps } from '@tickets/form';
import { cn } from '../../../style';
import { Input } from '../../../components/input';

export type TextInputConfig = {
  placeholder?: string;
  mono?: boolean;
  /** Static leading affix, e.g. a fixed URL scheme. Not editable. */
  prefix?: string;
};

export function TextInput(p: InputProps<TextInputConfig, string>) {
  return (
    <div className="flex items-stretch gap-2">
      {p.config.prefix ? (
        <span className="inline-flex items-center rounded-md border-1 border-gray-6 bg-gray-1 px-3 font-sans text-13/19 text-gray-11">
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
        onChange={(e) => p.onChange(e.target.value)}
        onBlur={p.onBlur}
        className={cn(p.config.mono && 'font-mono text-13')}
      />
    </div>
  );
}
