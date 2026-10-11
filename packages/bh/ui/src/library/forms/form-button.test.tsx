import { defineForm, defineRegistry, Form } from '@bh/form';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldWrapper } from './components/field-wrapper';
import { FormButton } from './form-button';
import { baseInputs, baseLayouts } from './registry';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
});

const form = defineForm(registry).build((b) => {
  return [
    b.text({ name: 'name', label: 'Name', config: {} }),
    b.actions({}, [b.reset({ label: 'Reset' }), b.submit({ label: 'Save' })]),
  ];
});

describe('FormButton', () => {
  it('draws a submit that submits, and a reset that waits for a change', async () => {
    const onSubmit = vi.fn();
    render(<Form registry={registry} form={form} onSubmit={onSubmit} />);
    const save = screen.getByRole('button', { name: 'Save' });
    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(save).toHaveAttribute('type', 'submit');
    expect(reset).toHaveAttribute('type', 'button');
    expect(reset).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Anna' } });
    expect(reset).toBeEnabled();
    fireEvent.click(save);
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Anna' }));
  });

  it('shows a submit running', () => {
    render(<FormButton action="submit" label="Save" disabled loading />);
    expect(screen.getByRole('button', { name: /Save/ })).toHaveAttribute('aria-busy', 'true');
  });
});
