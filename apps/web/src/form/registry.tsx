import { defineRegistry, type InputProps } from '@tickets/form';

import { DirectoryPicker } from '../components/terminal/directory-picker';
import { cn, FieldError, FieldLabel, Input } from '@tickets/ui';

function TextInput(p: InputProps<{ placeholder?: string; mono?: boolean }, string>) {
  return (
    <Input
      name={p.name}
      value={p.value ?? ''}
      placeholder={p.config.placeholder}
      disabled={p.disabled}
      onChange={(e) => p.onChange(e.target.value)}
      onBlur={p.onBlur}
      className={cn(p.config.mono && 'font-mono text-13')}
    />
  );
}

function DirectoryInput(p: InputProps<Record<string, never>, string>) {
  return <DirectoryPicker value={p.value ?? ''} onChange={(next) => { p.onChange(next); p.onBlur(); }} />;
}

export const formRegistry = defineRegistry({
  inputs: {
    text: { Component: TextInput, defaultValue: '' },
    directory: { Component: DirectoryInput, defaultValue: '' },
  },
  layouts: {},
  field: {
    Component: ({ label, required, error, children }) => (
      <div className="block">
        {label ? <FieldLabel required={required}>{label}</FieldLabel> : null}
        {children}
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    ),
  },
});

export type AppFormRegistry = typeof formRegistry;
