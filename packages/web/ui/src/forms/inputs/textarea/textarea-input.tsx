import { useEffect, useState } from 'react';
import type { InputProps } from '@tickets/form';
import { Textarea } from '../../../components/textarea';

export type TextareaInputConfig = {
  rows?: number;
  placeholder?: string;
};

export function TextareaInput(p: InputProps<TextareaInputConfig, string>) {
  const [internalValue, setInternalValue] = useState(p.value ?? '');

  useEffect(() => {
    setInternalValue(p.value ?? '');
  }, [p.value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    p.onChange(newValue);
  };

  return (
    <Textarea
      id={p.name}
      name={p.name}
      rows={p.config.rows ?? 4}
      value={internalValue}
      placeholder={p.config.placeholder}
      disabled={p.disabled}
      tone={p.error ? 'danger' : undefined}
      onChange={handleChange}
      onBlur={p.onBlur}
    />
  );
}
